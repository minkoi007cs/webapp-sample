import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoUsCase } from '../../common/entities/gous-case.entity';
import { GoUsMember } from '../../common/entities/gous-member.entity';
import { GoUsDocument } from '../../common/entities/gous-document.entity';
import { GoUsTask } from '../../common/entities/gous-task.entity';
import { GoUsExpense } from '../../common/entities/gous-expense.entity';
import {
  GoUsStage,
  MemberRoleInCase,
  ProcessStatus,
  DocumentCategory,
  DocumentStatus,
  TaskPriority,
  TaskStatus,
  ExpenseCategory,
  ExpensePaymentStatus,
} from '../../common/enums/gous.enums';
import { UpdateGoUsCaseDto } from './dto/case.dto';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CreateGoUsExpenseDto, UpdateGoUsExpenseDto } from './dto/expense.dto';
import { CalculateCspaDto, CspaResult } from './dto/cspa.dto';

@Injectable()
export class GoUsService {
  constructor(
    @InjectRepository(GoUsCase)
    private caseRepo: Repository<GoUsCase>,
    @InjectRepository(GoUsMember)
    private memberRepo: Repository<GoUsMember>,
    @InjectRepository(GoUsDocument)
    private docRepo: Repository<GoUsDocument>,
    @InjectRepository(GoUsTask)
    private taskRepo: Repository<GoUsTask>,
    @InjectRepository(GoUsExpense)
    private expenseRepo: Repository<GoUsExpense>,
  ) {}

  /**
   * Lấy hồ sơ F4 của gia đình hoặc tự động khởi tạo hồ sơ mẫu chuẩn F4 nếu chưa có
   */
  async getOrCreateCase(familyId: string): Promise<GoUsCase> {
    let gCase = await this.caseRepo.findOne({
      where: { familyId },
      relations: ['members', 'documents', 'tasks', 'expenses'],
    });

    if (!gCase) {
      gCase = this.caseRepo.create({
        familyId,
        visaCategory: 'F4 - Anh/Chị/Em công dân Mỹ',
        currentStage: GoUsStage.NVC_CASE_CREATION,
      });
      gCase = await this.caseRepo.save(gCase);
      await this.seedDefaultF4Roadmap(gCase);

      gCase = await this.caseRepo.findOne({
        where: { id: gCase.id },
        relations: ['members', 'documents', 'tasks', 'expenses'],
      });
    }

    return gCase!;
  }

  async updateCase(familyId: string, dto: UpdateGoUsCaseDto): Promise<GoUsCase> {
    const gCase = await this.getOrCreateCase(familyId);
    Object.assign(gCase, dto);
    const saved = await this.caseRepo.save(gCase);

    // Tự động tính lại CSPA cho các con nếu có thay đổi ngày ưu tiên / ngày chấp thuận
    if (dto.priorityDate || dto.approvalDate) {
      await this.recalculateAllMembersCspa(saved);
    }

    return this.getOrCreateCase(familyId);
  }

  // ================= MEMBERS =================
  async getMembers(familyId: string): Promise<GoUsMember[]> {
    const gCase = await this.getOrCreateCase(familyId);
    return this.memberRepo.find({
      where: { caseId: gCase.id },
      order: { roleInCase: 'ASC', createdAt: 'ASC' },
    });
  }

  async addMember(familyId: string, dto: CreateMemberDto): Promise<GoUsMember> {
    const gCase = await this.getOrCreateCase(familyId);
    const member = this.memberRepo.create({
      ...dto,
      caseId: gCase.id,
    });

    if (dto.roleInCase === MemberRoleInCase.CHILD && dto.dob && gCase.priorityDate && gCase.approvalDate) {
      const cspa = this.calculateCspa({
        dob: dto.dob,
        priorityDate: gCase.priorityDate,
        approvalDate: gCase.approvalDate,
      });
      member.cspaAge = cspa.cspaAge;
      member.cspaStatus = cspa.cspaStatus;
    }

    return this.memberRepo.save(member);
  }

  async updateMember(familyId: string, memberId: string, dto: UpdateMemberDto): Promise<GoUsMember> {
    const gCase = await this.getOrCreateCase(familyId);
    const member = await this.memberRepo.findOne({
      where: { id: memberId, caseId: gCase.id },
    });
    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên trong hồ sơ');
    }

    Object.assign(member, dto);

    if (member.roleInCase === MemberRoleInCase.CHILD && member.dob && gCase.priorityDate && gCase.approvalDate) {
      const cspa = this.calculateCspa({
        dob: member.dob,
        priorityDate: gCase.priorityDate,
        approvalDate: gCase.approvalDate,
      });
      member.cspaAge = cspa.cspaAge;
      member.cspaStatus = cspa.cspaStatus;
    }

    return this.memberRepo.save(member);
  }

  async deleteMember(familyId: string, memberId: string): Promise<void> {
    const gCase = await this.getOrCreateCase(familyId);
    const member = await this.memberRepo.findOne({
      where: { id: memberId, caseId: gCase.id },
    });
    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }
    await this.memberRepo.softRemove(member);
  }

  // ================= DOCUMENTS =================
  async getDocuments(familyId: string, category?: DocumentCategory): Promise<GoUsDocument[]> {
    const gCase = await this.getOrCreateCase(familyId);
    const where: any = { caseId: gCase.id };
    if (category) {
      where.category = category;
    }
    const docs = await this.docRepo.find({
      where,
      relations: ['member'],
      order: { category: 'ASC', isRequired: 'DESC', createdAt: 'ASC' },
    });
    return docs.map((doc) => {
      if ((!doc.fileUrls || doc.fileUrls.length === 0) && doc.fileUrl) {
        doc.fileUrls = [doc.fileUrl];
      }
      return doc;
    });
  }

  async addDocument(familyId: string, dto: CreateDocumentDto): Promise<GoUsDocument> {
    const gCase = await this.getOrCreateCase(familyId);
    const fileUrls = dto.fileUrls && dto.fileUrls.length > 0
      ? dto.fileUrls
      : (dto.fileUrl ? [dto.fileUrl] : undefined);
    const fileUrl = dto.fileUrl || (fileUrls && fileUrls.length > 0 ? fileUrls[0] : undefined);

    const doc = this.docRepo.create({
      ...dto,
      fileUrl,
      fileUrls,
      caseId: gCase.id,
    } as any);
    return this.docRepo.save(doc) as unknown as Promise<GoUsDocument>;
  }

  async updateDocument(familyId: string, docId: string, dto: UpdateDocumentDto): Promise<GoUsDocument> {
    const gCase = await this.getOrCreateCase(familyId);
    const doc = await this.docRepo.findOne({
      where: { id: docId, caseId: gCase.id },
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy tài liệu trong hồ sơ');
    }

    let fileUrls = doc.fileUrls;
    let fileUrl = doc.fileUrl;

    if (dto.fileUrls !== undefined) {
      fileUrls = dto.fileUrls && dto.fileUrls.length > 0 ? dto.fileUrls : undefined;
      fileUrl = fileUrls && fileUrls.length > 0 ? fileUrls[0] : (dto.fileUrl || undefined);
    } else if (dto.fileUrl !== undefined) {
      fileUrl = dto.fileUrl;
      if (!fileUrls || fileUrls.length === 0) {
        fileUrls = dto.fileUrl ? [dto.fileUrl] : undefined;
      }
    }

    Object.assign(doc, dto, { fileUrl, fileUrls });
    return this.docRepo.save(doc);
  }

  async deleteDocument(familyId: string, docId: string): Promise<void> {
    const gCase = await this.getOrCreateCase(familyId);
    const doc = await this.docRepo.findOne({
      where: { id: docId, caseId: gCase.id },
    });
    if (!doc) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }
    await this.docRepo.softRemove(doc);
  }

  // ================= TASKS & REMINDERS =================
  async getTasks(familyId: string, stage?: GoUsStage): Promise<GoUsTask[]> {
    const gCase = await this.getOrCreateCase(familyId);
    const where: any = { caseId: gCase.id };
    if (stage) {
      where.stage = stage;
    }
    return this.taskRepo.find({
      where,
      order: { priority: 'ASC', dueDate: 'ASC', createdAt: 'ASC' },
    });
  }

  async addTask(familyId: string, dto: CreateTaskDto): Promise<GoUsTask> {
    const gCase = await this.getOrCreateCase(familyId);
    const task = this.taskRepo.create({
      ...dto,
      caseId: gCase.id,
    });
    return this.taskRepo.save(task);
  }

  async updateTask(familyId: string, taskId: string, dto: UpdateTaskDto): Promise<GoUsTask> {
    const gCase = await this.getOrCreateCase(familyId);
    const task = await this.taskRepo.findOne({
      where: { id: taskId, caseId: gCase.id },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }
    Object.assign(task, dto);
    return this.taskRepo.save(task);
  }

  async deleteTask(familyId: string, taskId: string): Promise<void> {
    const gCase = await this.getOrCreateCase(familyId);
    const task = await this.taskRepo.findOne({
      where: { id: taskId, caseId: gCase.id },
    });
    if (!task) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ');
    }
    await this.taskRepo.softRemove(task);
  }

  // ================= EXPENSES & BUDGET =================
  async getExpenses(familyId: string): Promise<GoUsExpense[]> {
    const gCase = await this.getOrCreateCase(familyId);
    return this.expenseRepo.find({
      where: { caseId: gCase.id },
      order: { category: 'ASC', createdAt: 'ASC' },
    });
  }

  async addExpense(familyId: string, dto: CreateGoUsExpenseDto): Promise<GoUsExpense> {
    const gCase = await this.getOrCreateCase(familyId);
    const expense = this.expenseRepo.create({
      ...dto,
      caseId: gCase.id,
    });
    return this.expenseRepo.save(expense);
  }

  async updateExpense(familyId: string, expenseId: string, dto: UpdateGoUsExpenseDto): Promise<GoUsExpense> {
    const gCase = await this.getOrCreateCase(familyId);
    const expense = await this.expenseRepo.findOne({
      where: { id: expenseId, caseId: gCase.id },
    });
    if (!expense) {
      throw new NotFoundException('Không tìm thấy khoản chi phí');
    }
    Object.assign(expense, dto);
    return this.expenseRepo.save(expense);
  }

  async deleteExpense(familyId: string, expenseId: string): Promise<void> {
    const gCase = await this.getOrCreateCase(familyId);
    const expense = await this.expenseRepo.findOne({
      where: { id: expenseId, caseId: gCase.id },
    });
    if (!expense) {
      throw new NotFoundException('Không tìm thấy khoản chi phí');
    }
    await this.expenseRepo.softRemove(expense);
  }

  // ================= CSPA CALCULATOR =================
  /**
   * Tính tuổi CSPA theo chuẩn Bộ Ngoại Giao và Luật Di Trú Hoa Kỳ:
   * 1. Thời gian hồ sơ I-130 chờ duyệt (Pending Time) = Ngày chấp thuận I-797 (Approval Date) - Ngày ưu tiên (Priority Date)
   * 2. Tuổi thực tế tại thời điểm Visa sẵn sàng (hoặc hiện tại)
   * 3. Tuổi CSPA = Tuổi thực tế - Thời gian I-130 chờ duyệt
   */
  calculateCspa(dto: CalculateCspaDto): CspaResult {
    const dob = new Date(dto.dob);
    const priorityDate = new Date(dto.priorityDate);
    const approvalDate = new Date(dto.approvalDate);
    const visaAvailableDate = dto.visaAvailableDate ? new Date(dto.visaAvailableDate) : new Date();

    if (approvalDate < priorityDate) {
      throw new BadRequestException('Ngày chấp thuận I-797 phải sau hoặc bằng Ngày ưu tiên (Priority Date)');
    }

    const pendingMs = approvalDate.getTime() - priorityDate.getTime();
    const pendingDays = Math.floor(pendingMs / (1000 * 60 * 60 * 24));
    const pendingYears = pendingDays / 365.25;

    const actualAgeMs = visaAvailableDate.getTime() - dob.getTime();
    const actualAgeDays = Math.floor(actualAgeMs / (1000 * 60 * 60 * 24));
    const actualAgeAtVisaAvailability = actualAgeDays / 365.25;

    const cspaAge = actualAgeAtVisaAvailability - pendingYears;
    const roundedCspa = Math.round(cspaAge * 100) / 100;

    let cspaStatus: 'SAFE' | 'WARNING' | 'AGED_OUT' = 'SAFE';
    let message = '';
    const recommendations: string[] = [];

    if (roundedCspa < 20.5) {
      cspaStatus = 'SAFE';
      message = `Tuổi CSPA tính được là ${roundedCspa.toFixed(2)} tuổi. Đương đơn con đủ điều kiện đi cùng hồ sơ cha mẹ theo Đạo luật CSPA.`;
      recommendations.push('Đương đơn con phải giữ tình trạng độc thân (chưa đăng ký kết hôn) cho đến khi chính thức nhập cảnh Mỹ.');
      recommendations.push('Cần hoàn tất nộp đơn DS-260 và đóng phí trong vòng 1 năm kể từ ngày nhận thông báo visa sẵn sàng (Yêu cầu "Seek to Acquire").');
    } else if (roundedCspa < 21.0) {
      cspaStatus = 'WARNING';
      message = `Tuổi CSPA là ${roundedCspa.toFixed(2)} tuổi - Rất sát ngưỡng 21 tuổi! Cần theo dõi và xử lý hồ sơ khẩn trương.`;
      recommendations.push('Nộp ngay đơn DS-260 và đóng phí thị thực IV để khóa tuổi CSPA (Seek to Acquire).');
      recommendations.push('Không được kết hôn trước khi nhập cảnh Mỹ.');
      recommendations.push('Chuẩn bị sẵn toàn bộ giấy tờ dân sự để tránh bị trì hoãn tại NVC hoặc Lãnh sự quán.');
    } else {
      cspaStatus = 'AGED_OUT';
      message = `Tuổi CSPA là ${roundedCspa.toFixed(2)} tuổi (Đã vượt quá 21 tuổi). Đương đơn con có nguy cơ bị quá tuổi (Age-out) và không thể đi cùng hồ sơ F4 của cha mẹ.`;
      recommendations.push('Kiểm tra lại chính xác ngày trên thư I-797 (Notice of Action) để rà soát lại số ngày chờ duyệt.');
      recommendations.push('Phương án thay thế: Sau khi cha mẹ sang Mỹ và nhận Thẻ Xanh, cha mẹ có thể mở hồ sơ bảo lãnh con cái độc thân trên 21 tuổi (Diện F2B).');
      recommendations.push('Tận dụng ngày ưu tiên cũ (Priority Date Retention) nếu quy định cho phép.');
    }

    return {
      actualAgeAtVisaAvailability: Math.round(actualAgeAtVisaAvailability * 100) / 100,
      i130PendingDays: pendingDays,
      i130PendingYears: Math.round(pendingYears * 100) / 100,
      cspaAge: roundedCspa,
      cspaStatus,
      message,
      recommendations,
    };
  }

  private async recalculateAllMembersCspa(gCase: GoUsCase): Promise<void> {
    if (!gCase.priorityDate || !gCase.approvalDate) return;
    const members = await this.memberRepo.find({ where: { caseId: gCase.id } });
    const toUpdate = members.filter((m) => m.roleInCase === MemberRoleInCase.CHILD && m.dob);
    for (const member of toUpdate) {
      const cspa = this.calculateCspa({
        dob: member.dob,
        priorityDate: gCase.priorityDate,
        approvalDate: gCase.approvalDate,
      });
      member.cspaAge = cspa.cspaAge;
      member.cspaStatus = cspa.cspaStatus;
    }
    if (toUpdate.length > 0) {
      await this.memberRepo.save(toUpdate);
    }
  }

  // ================= OVERVIEW STATS =================
  async getOverviewStats(familyId: string) {
    const gCase = await this.getOrCreateCase(familyId);
    const [members, documents, tasks, expenses] = await Promise.all([
      this.memberRepo.find({ where: { caseId: gCase.id } }),
      this.docRepo.find({ where: { caseId: gCase.id } }),
      this.taskRepo.find({ where: { caseId: gCase.id } }),
      this.expenseRepo.find({ where: { caseId: gCase.id } }),
    ]);

    const totalDocs = documents.length;
    const readyDocs = documents.filter((d) =>
      [DocumentStatus.READY_FOR_INTERVIEW, DocumentStatus.SUBMITTED_NVC].includes(d.status),
    ).length;

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const urgentTasks = tasks.filter((t) => t.priority === TaskPriority.URGENT && t.status !== TaskStatus.DONE);

    let totalEstimatedUsd = 0;
    let totalPaidUsd = 0;
    let totalEstimatedVnd = 0;
    let totalPaidVnd = 0;

    for (const exp of expenses) {
      const est = Number(exp.estimatedAmount || 0);
      const act = Number(exp.actualAmount || 0);
      if (exp.currency === 'USD') {
        totalEstimatedUsd += est;
        if (exp.status === ExpensePaymentStatus.PAID) {
          totalPaidUsd += act || est;
        }
      } else {
        totalEstimatedVnd += est;
        if (exp.status === ExpensePaymentStatus.PAID) {
          totalPaidVnd += act || est;
        }
      }
    }

    const agedOutMembers = members.filter((m) => m.cspaStatus === 'AGED_OUT');
    const warningCspaMembers = members.filter((m) => m.cspaStatus === 'WARNING');

    return {
      caseInfo: gCase,
      totalMembers: members.length,
      agedOutCount: agedOutMembers.length,
      warningCspaCount: warningCspaMembers.length,
      docProgress: {
        total: totalDocs,
        ready: readyDocs,
        percentage: totalDocs > 0 ? Math.round((readyDocs / totalDocs) * 100) : 0,
      },
      taskProgress: {
        total: totalTasks,
        done: doneTasks,
        urgentCount: urgentTasks.length,
        percentage: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      },
      financialSummary: {
        totalEstimatedUsd,
        totalPaidUsd,
        totalEstimatedVnd,
        totalPaidVnd,
      },
    };
  }

  // ================= SEED STANDARD F4 DATA =================
  private async seedDefaultF4Roadmap(gCase: GoUsCase) {
    // 1. Gợi ý bộ giấy tờ mẫu chuẩn F4
    const defaultDocs: Array<Partial<GoUsDocument>> = [
      // Giấy tờ nhân thân
      {
        caseId: gCase.id,
        category: DocumentCategory.CIVIL_IDENTITY,
        title: 'Bản chính Giấy khai sinh (Trích lục mới nhất)',
        description: 'Cần bản trích lục hộ tịch rõ ràng, họ tên cha mẹ trùng khớp giữa các anh chị em.',
        isRequired: true,
        expertNotes: 'Rất quan trọng với diện F4 để đối chiếu tên cha mẹ với người bảo lãnh tại Mỹ.',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.CIVIL_IDENTITY,
        title: 'Hộ chiếu còn hạn ít nhất 6 tháng sau ngày dự kiến đến Mỹ',
        description: 'Mỗi thành viên trong gia đình cần 1 quyển hộ chiếu riêng biệt, còn nguyên vẹn.',
        isRequired: true,
        expertNotes: 'Nên làm hộ chiếu gắn chip mẫu mới nếu hộ chiếu cũ sắp hết hạn.',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.CIVIL_IDENTITY,
        title: 'Phiếu Lý lịch tư pháp số 2 (Cho người từ đủ 16 tuổi)',
        description: 'Cấp bởi Sở Tư pháp hoặc qua ứng dụng VNeID / Dịch vụ công quốc gia.',
        isRequired: true,
        expertNotes: 'Lãnh sự quán quy định LLTP số 2 có giá trị trong vòng 1-2 năm. Nên làm trước ngày phỏng vấn khoảng 1-2 tháng.',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.CIVIL_IDENTITY,
        title: 'Giấy chứng nhận kết hôn / Quyết định ly hôn (Nếu có)',
        description: 'Bản chính + Bản dịch thuật công chứng tiếng Anh.',
        isRequired: true,
        expertNotes: 'Chứng minh tình trạng hôn nhân hợp pháp của đương đơn chính.',
      },
      // Hồ sơ bảo trợ tài chính
      {
        caseId: gCase.id,
        category: DocumentCategory.FINANCIAL_SUPPORT,
        title: 'Mẫu đơn bảo trợ tài chính I-864 có chữ ký người bảo lãnh',
        description: 'Người bảo lãnh bên Mỹ điền và ký tên đầy đủ.',
        isRequired: true,
        expertNotes: 'Phải đảm bảo thu nhập người bảo lãnh vượt 125% chuẩn nghèo liên bang (Poverty Guidelines) theo quy mô gia đình.',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.FINANCIAL_SUPPORT,
        title: 'Bản khai thuế IRS (Tax Transcripts) & Mẫu W-2 của 3 năm gần nhất',
        description: 'Yêu cầu người bảo lãnh tải Tax Transcripts trực tiếp từ website irs.gov.',
        isRequired: true,
        expertNotes: 'Thuế năm gần nhất là bắt buộc. Nếu thu nhập không đủ, cần chuẩn bị thêm Người đồng bảo trợ (Joint Sponsor) cùng mẫu I-864 / I-864A.',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.FINANCIAL_SUPPORT,
        title: 'Thư xác nhận việc làm (Employment Letter) & Cuống lương (Pay Stubs 3-6 tháng)',
        description: 'Chứng minh người bảo lãnh đang có công việc và thu nhập ổn định tại Mỹ.',
        isRequired: true,
        expertNotes: 'Nếu tự kinh doanh, cần giấy phép kinh doanh và báo cáo tài chính.',
      },
      // Bằng chứng quan hệ huyết thống
      {
        caseId: gCase.id,
        category: DocumentCategory.RELATIONSHIP_PROOF,
        title: 'Bằng chứng quan hệ anh/chị/em ruột (Ảnh chụp qua các thời kỳ)',
        description: 'Album ảnh chụp chung từ thuở nhỏ, lễ tết, họp mặt gia đình, các chuyến về thăm Việt Nam của người bảo lãnh.',
        isRequired: true,
        expertNotes: 'In ảnh màu, ghi chú rõ ngày tháng, địa điểm chụp và những ai có mặt trong ảnh.',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.RELATIONSHIP_PROOF,
        title: 'Sổ hộ khẩu cũ / Học bạ xưa có chung tên cha mẹ',
        description: 'Các giấy tờ trước năm 1975 hoặc thập niên 80-90 nếu có để củng cố quan hệ ruột thịt.',
        isRequired: false,
        expertNotes: 'Rất hữu ích nếu giấy khai sinh bị làm lại muộn hoặc có sự chênh lệch thông tin họ tên lót.',
      },
      // Khám sức khỏe & Phỏng vấn
      {
        caseId: gCase.id,
        category: DocumentCategory.MEDICAL_VACCINE,
        title: 'Hồ sơ niêm phong Khám sức khỏe (IOM / Bệnh viện Chợ Rẫy) & Phiếu tiêm chủng',
        description: 'Kết quả khám sức khỏe điện tử hoặc túi hồ sơ niêm phong (tuyệt đối không tự ý bóc mở).',
        isRequired: true,
        expertNotes: 'Khám SK có giá trị tối đa 6 tháng. Visa cấp sẽ hết hạn cùng ngày với hạn kết quả khám sức khỏe!',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.INTERVIEW_TRAVEL,
        title: 'Trang xác nhận DS-260 (Confirmation Page) của từng thành viên',
        description: 'In trang có mã vạch sau khi nộp thành công đơn DS-260 trực tuyến.',
        isRequired: true,
        expertNotes: 'Cần kiểm tra kỹ từng thông tin đã khai, đặc biệt là phần lịch sử xuất ngoại và thông tin nhân thân.',
      },
      {
        caseId: gCase.id,
        category: DocumentCategory.INTERVIEW_TRAVEL,
        title: 'Thư mời phỏng vấn P4 & Giấy đăng ký địa chỉ chuyển phát Visa (uvisitdas.com)',
        description: 'In kèm giấy đăng ký giao nhận hộ chiếu qua đường bưu điện.',
        isRequired: true,
        expertNotes: 'Mang theo đầy đủ vào cổng Lãnh sự quán số 4 Lê Duẩn, Q1, TP.HCM.',
      },
    ];

    const docsSaved = this.docRepo.save(defaultDocs.map((doc) => this.docRepo.create(doc)));

    // 2. Gợi ý danh mục công việc & nhắc nhở theo từng giai đoạn
    const defaultTasks: Array<Partial<GoUsTask>> = [
      {
        caseId: gCase.id,
        stage: GoUsStage.NVC_CASE_CREATION,
        title: 'Theo dõi và nhận Welcome Letter từ NVC (Case Number & Invoice ID)',
        description: 'Kiểm tra hòm thư email của người bảo lãnh và đương đơn để nhận thông tin đăng nhập hệ thống CEAC.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Lưu lại mã Case Number (HCMxxxxxxxxxx) và Invoice ID cẩn thận, không chia sẻ công khai.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.NVC_FEES,
        title: 'Đóng phí xét duyệt bảo trợ tài chính AOS ($120) & Phí thị thực IV ($345 / người)',
        description: 'Người bảo lãnh thanh toán trực tuyến trên cổng CEAC bằng tài khoản ngân hàng tại Mỹ (US Bank Account).',
        priority: TaskPriority.URGENT,
        isSystemSuggested: true,
        expertTips: 'Phải chờ trạng thái chuyển từ "In Process" sang "PAID" mới có thể mở khóa đơn DS-260.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.DS260_CIVIL_DOCS,
        title: 'Kiểm tra và tính toán tuổi CSPA cho các con đi kèm',
        description: 'Sử dụng công cụ tính CSPA trong portal để xác định chắc chắn con có bị quá 21 tuổi không.',
        priority: TaskPriority.URGENT,
        isSystemSuggested: true,
        expertTips: 'Nếu con sắp 21 tuổi CSPA, phải nộp ngay đơn DS-260 để khóa tuổi (Seek to Acquire)!',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.DS260_CIVIL_DOCS,
        title: 'Khai hoàn tất đơn trực tuyến DS-260 cho tất cả thành viên trong gia đình',
        description: 'Khai trung thực, chi tiết từng mục: quá trình học tập, công tác, lịch sử cư trú từ năm 16 tuổi.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'In lưu lại toàn bộ câu trả lời trước khi submit để chuẩn bị cho buổi phỏng vấn.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.DS260_CIVIL_DOCS,
        title: 'Scan và nộp toàn bộ Bộ Hồ sơ Dân sự & Bộ Bảo trợ I-864 lên hệ thống CEAC',
        description: 'Định dạng file PDF/JPG rõ nét, dung lượng < 2MB/file theo đúng quy chuẩn NVC.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Không để thiếu bất kỳ trang nào của hồ sơ thuế hoặc giấy khai sinh.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.NVC_DQ,
        title: 'Nhận thư hoàn tất hồ sơ (Documentarily Qualified - DQ) từ NVC',
        description: 'Khi NVC duyệt xong toàn bộ giấy tờ, họ sẽ gửi email xác nhận hồ sơ đã hoàn thành.',
        priority: TaskPriority.MEDIUM,
        isSystemSuggested: true,
        expertTips: 'Thời gian chờ từ lúc DQ đến lúc có thư mời phỏng vấn tùy thuộc vào lịch visa hàng tháng (Visa Bulletin).',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.INTERVIEW_LETTER,
        title: 'Nhận thư mời phỏng vấn (P4 Letter) từ Lãnh sự quán Hoa Kỳ',
        description: 'Kiểm tra ngày, giờ phỏng vấn và danh sách các đương đơn có tên trong thư mời.',
        priority: TaskPriority.URGENT,
        isSystemSuggested: true,
        expertTips: 'In ngay 3-4 bản thư mời phỏng vấn để dùng cho việc đi khám sức khỏe, chích ngừa và vào cổng Lãnh sự.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.MEDICAL_VACCINATION,
        title: 'Đặt hẹn Khám sức khỏe xuất cảnh tại IOM hoặc BV Chợ Rẫy',
        description: 'Đi khám trước ngày phỏng vấn ít nhất 2 - 3 tuần để kịp nhận kết quả.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Mang theo: Thư mời phỏng vấn, Hộ chiếu gốc, Trang xác nhận DS-260, 4 ảnh thẻ 5x5 nền trắng, phiếu tiêm chủng cũ nếu có.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.MEDICAL_VACCINATION,
        title: 'Đi tiêm chủng vắc-xin tại Trung tâm Kiểm dịch Y tế hoặc Viện Pasteur',
        description: 'Hoàn thành các mũi tiêm theo chỉ định của bác sĩ kiểm dịch.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Giữ cẩn thận Phiếu tiêm chủng quốc tế (Màu vàng) để mang đi phỏng vấn và xuất trình khi nhập cảnh Mỹ.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.INTERVIEW_PREP,
        title: 'Làm lại Lý lịch tư pháp số 2 mới nhất nếu bản cũ quá 1 năm',
        description: 'Đảm bảo ngày cấp LLTP số 2 còn mới để tránh bị cấp Giấy xanh 221(g) yêu cầu bổ sung.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Nên nộp xin cấp LLTP số 2 ngay khi nhận được thư mời phỏng vấn.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.INTERVIEW_PREP,
        title: 'Đăng ký địa chỉ nhận Visa trên hệ thống uvisitdas.com',
        description: 'Tạo tài khoản và chọn bưu cục giao hộ chiếu tận nhà.',
        priority: TaskPriority.URGENT,
        isSystemSuggested: true,
        expertTips: 'In tờ giấy xác nhận đăng ký địa chỉ bưu điện (Address Registration Confirmation) kẹp vào hồ sơ.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.INTERVIEW_PREP,
        title: 'Sắp xếp hồ sơ thành các bộ riêng: Bản gốc, Bản dịch công chứng, Bằng chứng quan hệ',
        description: 'Sử dụng bìa hồ sơ trong suốt, đánh dấu tab phân loại để khi viên chức hỏi là rút ra ngay.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Luyện tập trả lời các câu hỏi: Ai bảo lãnh? Qua Mỹ năm nào? Làm nghề gì? Địa chỉ ở đâu? Lần cuối gặp nhau khi nào?',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.INTERVIEW_CONSULATE,
        title: 'Tham dự phỏng vấn tại Lãnh sự quán Hoa Kỳ (Số 4 Lê Duẩn, Q1, TP.HCM)',
        description: 'Có mặt trước giờ hẹn 15-30 phút, ăn mặc lịch sự, thái độ tự tin, trả lời trung thực và ngắn gọn.',
        priority: TaskPriority.URGENT,
        isSystemSuggested: true,
        expertTips: 'Tất cả các thành viên có tên trong hồ sơ đều phải có mặt đầy đủ.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.VISA_ISSUED_USCIS_FEE,
        title: 'Nhận hộ chiếu có visa & Đóng phí thẻ xanh USCIS Immigrant Fee ($220 / người)',
        description: 'Thanh toán online qua cổng ELIS của USCIS trước khi lên máy bay sang Mỹ.',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Phải đóng phí này thì Thẻ Xanh (Permanent Resident Card) mới được sản xuất và gửi về địa chỉ Mỹ.',
      },
      {
        caseId: gCase.id,
        stage: GoUsStage.FLIGHT_AND_POE,
        title: 'Mua vé máy bay, chuẩn bị hành lý và tài chính mang theo',
        description: 'Mang theo hồ sơ sức khỏe, học bạ dịch thuật cho con, thẻ ngân hàng, tiền mặt dưới $10,000 / gia đình (nếu mang trên $10,000 phải khai báo hải quan).',
        priority: TaskPriority.HIGH,
        isSystemSuggested: true,
        expertTips: 'Không mang thực phẩm tươi sống, hạt giống, thịt động vật vào Mỹ. Tuyệt đối KHÔNG mở phong bì niêm phong của LSQ nếu có.',
      },
    ];

    const tasksSaved = this.taskRepo.save(defaultTasks.map((task) => this.taskRepo.create(task)));

    // 3. Gợi ý bảng dự toán chi phí chuẩn diện F4
    const defaultExpenses: Array<Partial<GoUsExpense>> = [
      {
        caseId: gCase.id,
        category: ExpenseCategory.NVC_GOVERNMENT_FEE,
        title: 'Phí xét duyệt hồ sơ bảo trợ tài chính NVC (AOS Fee)',
        currency: 'USD',
        estimatedAmount: 120,
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Người bảo lãnh tại Mỹ',
        notes: 'Đóng 1 lần duy nhất cho toàn bộ hồ sơ trên hệ thống CEAC.',
      },
      {
        caseId: gCase.id,
        category: ExpenseCategory.NVC_GOVERNMENT_FEE,
        title: 'Phí xử lý đơn xin thị thực di dân NVC (IV Fee - $345 / người)',
        currency: 'USD',
        estimatedAmount: 1380, // Tạm tính cho gia đình 4 người ($345 x 4)
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Người bảo lãnh tại Mỹ',
        notes: '$345 x số lượng thành viên trong gia đình.',
      },
      {
        caseId: gCase.id,
        category: ExpenseCategory.MEDICAL_AND_VACCINE,
        title: 'Phí khám sức khỏe xuất cảnh (IOM / BV Chợ Rẫy)',
        currency: 'USD',
        estimatedAmount: 1000,
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Gia đình Việt Nam',
        notes: '~ $240 - $275 / người lớn, trẻ em từ $165 - $240 tùy độ tuổi.',
      },
      {
        caseId: gCase.id,
        category: ExpenseCategory.MEDICAL_AND_VACCINE,
        title: 'Phí tiêm chủng vắc-xin quốc tế (Viện Pasteur / Trung tâm Kiểm dịch)',
        currency: 'VND',
        estimatedAmount: 8000000,
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Gia đình Việt Nam',
        notes: '~ 1.500.000 - 3.000.000 VND / người tùy độ tuổi và lịch sử tiêm ngừa.',
      },
      {
        caseId: gCase.id,
        category: ExpenseCategory.CIVIL_AND_LEGAL_DOCS,
        title: 'Phí cấp Lý lịch tư pháp số 2 & Dịch thuật công chứng hồ sơ',
        currency: 'VND',
        estimatedAmount: 4000000,
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Gia đình Việt Nam',
        notes: 'Phí nhà nước LLTP 200k/người + phí dịch thuật công chứng tiếng Anh.',
      },
      {
        caseId: gCase.id,
        category: ExpenseCategory.USCIS_IMMIGRANT_FEE,
        title: 'Phí phát hành Thẻ Xanh USCIS ($220 / người sau khi đậu visa)',
        currency: 'USD',
        estimatedAmount: 880, // Tạm tính 4 người ($220 x 4)
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Người bảo lãnh tại Mỹ',
        notes: 'Bắt buộc đóng online trên trang USCIS ELIS trước khi lên máy bay.',
      },
      {
        caseId: gCase.id,
        category: ExpenseCategory.FLIGHT_AND_LOGISTICS,
        title: 'Vé máy bay 1 chiều sang Mỹ cho cả gia đình',
        currency: 'USD',
        estimatedAmount: 3600,
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Gia đình Việt Nam',
        notes: '~ $800 - $1200 / vé tùy hãng bay và mùa cao điểm.',
      },
      {
        caseId: gCase.id,
        category: ExpenseCategory.SETTLEMENT_FUNDS,
        title: 'Quỹ tiền mặt & tài chính mang theo dự phòng ổn định ban đầu',
        currency: 'USD',
        estimatedAmount: 5000,
        status: ExpensePaymentStatus.ESTIMATED,
        payer: 'Gia đình Việt Nam',
        notes: 'Tiền mặt mang theo chi tiêu 1-2 tháng đầu tại Mỹ.',
      },
    ];

    const expensesSaved = this.expenseRepo.save(defaultExpenses.map((exp) => this.expenseRepo.create(exp)));

    // The three tables are independent -- one batched INSERT each, run
    // concurrently, replaces what used to be ~37 sequential single-row
    // round trips blocking the first GoUS page load for a family.
    await Promise.all([docsSaved, tasksSaved, expensesSaved]);
  }
}
