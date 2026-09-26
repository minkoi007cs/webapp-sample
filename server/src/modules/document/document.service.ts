import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Document, DocumentStatus } from '../../common/entities/document.entity';
import { FileService } from '../file/file.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SynthesizeDocumentDto } from './dto/synthesize-document.dto';

const DEFAULT_CATEGORIES = [
  'Y tế & Sức khỏe',
  'Nhà đất & Bất động sản',
  'Giấy tờ tùy thân',
  'Học tập & Giáo dục',
  'Hóa đơn & Hợp đồng',
  'Xe cộ & Tài sản',
  'Tài chính & Bảo hiểm',
  'Khác',
];

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private openai: OpenAI;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly fileService: FileService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
    });
  }

  async uploadAndAnalyze(
    file: Express.Multer.File,
    dto: CreateDocumentDto,
    familyId: string,
    userId: string,
  ): Promise<Document> {
    if (!file) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    this.logger.log(`Tải lên tài liệu mới: ${file.originalname} (${file.mimetype}) cho gia đình ${familyId}`);

    // 1. Tải file lên Supabase Storage
    const fileUrl = await this.fileService.uploadFile(file, `family-docs/${familyId}`);
    const isImage = file.mimetype.startsWith('image/');
    const thumbnailUrl = isImage ? fileUrl : undefined;

    // 2. Tạo bản ghi ban đầu
    const document = this.documentRepository.create({
      familyId,
      uploadedByUserId: userId,
      title: dto.title || file.originalname.replace(/\.[^/.]+$/, ''),
      originalFileName: file.originalname,
      fileUrl,
      thumbnailUrl,
      mimeType: file.mimetype,
      fileSize: file.size,
      category: dto.category || 'Khác',
      tags: dto.tags || [],
      userNote: dto.userNote,
      status: DocumentStatus.PROCESSING,
    });

    await this.documentRepository.save(document);

    // 3. Phân tích tài liệu bằng AI (chạy ngay để trả về kết quả đầy đủ)
    try {
      const aiResult = await this.analyzeDocumentContent(file, dto.userNote);
      document.title = dto.title || aiResult.title || document.title;
      document.category = dto.category || aiResult.category || document.category;
      document.tags = Array.from(new Set([...(dto.tags || []), ...(aiResult.tags || [])]));
      document.summary = aiResult.summary;
      document.extractedContent = aiResult.extractedContent;
      document.structuredData = aiResult.structuredData;
      document.status = DocumentStatus.READY;
    } catch (err: any) {
      this.logger.error('Lỗi khi AI phân tích tài liệu:', err);
      document.status = DocumentStatus.READY; // Vẫn cho phép xem file nếu AI gặp lỗi
      document.errorMessage = err?.message || 'Không thể trích xuất tự động qua AI';
    }

    return this.documentRepository.save(document);
  }

  async findAll(familyId: string, queryDto: QueryDocumentDto) {
    const {
      search,
      category,
      tag,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const qb = this.documentRepository.createQueryBuilder('doc')
      .where('doc.familyId = :familyId', { familyId })
      .leftJoinAndSelect('doc.uploadedByUser', 'user');

    if (category && category !== 'Tất cả') {
      qb.andWhere('doc.category = :category', { category });
    }

    if (tag) {
      qb.andWhere("doc.tags::text ILIKE :tagPattern", { tagPattern: `%"${tag}"%` });
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        '(doc.title ILIKE :term OR doc.summary ILIKE :term OR doc.extractedContent ILIKE :term OR doc.tags::text ILIKE :term OR doc.category ILIKE :term OR doc.originalFileName ILIKE :term)',
        { term },
      );
    }

    const sortColumn = `doc.${sortBy}`;
    qb.orderBy(sortColumn, sortOrder);

    const skip = (page - 1) * pageSize;
    qb.skip(skip).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    // Lấy danh sách tất cả các tags và categories có trong gia đình để hiển thị bộ lọc
    const allDocs = await this.documentRepository.find({
      where: { familyId },
      select: ['category', 'tags'],
    });

    const categoryCounts: Record<string, number> = {};
    const tagSet = new Set<string>();

    for (const doc of allDocs) {
      if (doc.category) {
        categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
      }
      if (Array.isArray(doc.tags)) {
        doc.tags.forEach((t) => tagSet.add(t));
      }
    }

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
      meta: {
        categories: categoryCounts,
        availableTags: Array.from(tagSet),
      },
    };
  }

  async findOne(id: string, familyId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id, familyId },
      relations: ['uploadedByUser'],
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu này');
    }

    return document;
  }

  async update(id: string, familyId: string, dto: UpdateDocumentDto): Promise<Document> {
    const document = await this.findOne(id, familyId);

    if (dto.title !== undefined) document.title = dto.title;
    if (dto.category !== undefined) document.category = dto.category;
    if (dto.tags !== undefined) document.tags = dto.tags;
    if (dto.summary !== undefined) document.summary = dto.summary;
    if (dto.extractedContent !== undefined) document.extractedContent = dto.extractedContent;
    if (dto.structuredData !== undefined) document.structuredData = dto.structuredData;
    if (dto.userNote !== undefined) document.userNote = dto.userNote;

    return this.documentRepository.save(document);
  }

  async remove(id: string, familyId: string): Promise<{ success: boolean }> {
    const document = await this.findOne(id, familyId);

    try {
      await this.fileService.deleteFile(document.fileUrl);
    } catch (err) {
      this.logger.warn('Không thể xóa file vật lý từ storage:', err);
    }

    await this.documentRepository.remove(document);
    return { success: true };
  }

  async reanalyze(id: string, familyId: string): Promise<Document> {
    const document = await this.findOne(id, familyId);
    
    if (!this.configService.get('OPENAI_API_KEY')) {
      throw new BadRequestException('Chưa cấu hình OPENAI_API_KEY trên máy chủ');
    }

    // Nếu không có buffer trực tiếp, phân tích lại từ URL ảnh hoặc text
    const aiResult = await this.reanalyzeFromUrl(document.fileUrl, document.mimeType, document.userNote);
    if (aiResult) {
      document.title = aiResult.title || document.title;
      document.category = aiResult.category || document.category;
      document.tags = Array.from(new Set([...(document.tags || []), ...(aiResult.tags || [])]));
      document.summary = aiResult.summary || document.summary;
      document.extractedContent = aiResult.extractedContent || document.extractedContent;
      document.structuredData = aiResult.structuredData || document.structuredData;
      document.status = DocumentStatus.READY;
      document.errorMessage = undefined;
      return this.documentRepository.save(document);
    }

    return document;
  }

  /**
   * Tổng hợp hồ sơ chuyên đề bằng AI từ câu hỏi của người dùng
   * Ví dụ: "Hồ sơ về nhà Mỹ Ca", "Lịch sử đo kính Mi Mi", "Các giấy tờ tiêm chủng của con"
   */
  async synthesizeTopic(familyId: string, dto: SynthesizeDocumentDto) {
    if (!this.configService.get('OPENAI_API_KEY')) {
      throw new BadRequestException('Chưa cấu hình OPENAI_API_KEY để sử dụng tính năng Trợ lý AI tổng hợp');
    }

    const { query, documentIds } = dto;
    let documents: Document[] = [];

    if (documentIds && documentIds.length > 0) {
      documents = await this.documentRepository.createQueryBuilder('doc')
        .where('doc.familyId = :familyId AND doc.id IN (:...documentIds)', { familyId, documentIds })
        .getMany();
    } else {
      // Tìm kiếm các tài liệu liên quan trong kho tài liệu gia đình
      const terms = query.split(/\s+/).filter(t => t.length > 1);
      const qb = this.documentRepository.createQueryBuilder('doc')
        .where('doc.familyId = :familyId', { familyId });

      if (terms.length > 0) {
        const conditions: string[] = [];
        const params: Record<string, string> = { familyId };
        terms.forEach((term, idx) => {
          const paramKey = `term_${idx}`;
          params[paramKey] = `%${term}%`;
          conditions.push(`(doc.title ILIKE :${paramKey} OR doc.summary ILIKE :${paramKey} OR doc.extractedContent ILIKE :${paramKey} OR doc.tags::text ILIKE :${paramKey} OR doc.category ILIKE :${paramKey})`);
        });
        qb.andWhere(`(${conditions.join(' OR ')})`, params);
      }

      documents = await qb.take(15).getMany();

      // Nếu không tìm thấy bằng từ khóa cụ thể, lấy các tài liệu mới nhất để AI tổng hợp ngữ cảnh
      if (documents.length === 0) {
        documents = await this.documentRepository.find({
          where: { familyId },
          order: { createdAt: 'DESC' },
          take: 10,
        });
      }
    }

    if (documents.length === 0) {
      return {
        query,
        synthesis: 'Hiện chưa có tài liệu nào trong kho tài liệu gia đình phù hợp với chủ đề này. Bạn hãy tải các hình ảnh, hóa đơn hoặc giấy tờ liên quan lên để AI phân tích và tổng hợp nhé!',
        sourceDocuments: [],
      };
    }

    // Chuẩn bị ngữ cảnh cho OpenAI
    const docsContext = documents.map((doc, idx) => ({
      index: idx + 1,
      id: doc.id,
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
      summary: doc.summary,
      extractedContent: doc.extractedContent,
      structuredData: doc.structuredData,
      fileUrl: doc.fileUrl,
      createdAt: doc.createdAt,
    }));

    const systemPrompt = `
Bạn là Trợ lý AI Quản lý Hồ sơ & Tài liệu Gia đình thông minh, tận tâm và chính xác.
Nhiệm vụ của bạn là đọc toàn bộ kho tài liệu được cung cấp và lập một BẢN TỔNG HỢP / BÁO CÁO HỒ SƠ TOÀN DIỆN theo yêu cầu của người dùng.

### YÊU CẦU ĐỊNH DẠNG ĐẦU RA (MARKDOWN TIẾNG VIỆT):
1. **Tiêu đề báo cáo**: Rõ ràng, trang trọng (Ví dụ: # 🏡 BẢN TỔNG HỢP HỒ SƠ: NHÀ MỸ CA hoặc # 👓 LỊCH SỬ ĐO KÍNH & KHÁM MẮT: MI MI).
2. **Tóm tắt tổng quan**: 2-3 câu ngắn gọn bao quát hiện trạng.
3. **Dòng thời gian / Diễn tiến lịch sử (Timeline)**: Liệt kê rõ ngày tháng diễn ra các mốc, sự kiện, giao dịch hoặc lần khám từ quá khứ đến mới nhất.
4. **Bảng so sánh / Bảng thông số chi tiết** (RẤT QUAN TRỌNG):
   - Nếu là hồ sơ mắt/kính: Lập bảng so sánh độ Cận (SPH), Loạn (CYL), Trục (AXIS), Khoảng cách đồng tử (PD), loại tròng kính qua từng lần đo.
   - Nếu là hồ sơ nhà đất: Lập bảng thông tin diện tích, số tờ/số thửa, địa chỉ, ngày cấp sổ, chủ sở hữu, lịch sử giao dịch/đặt cọc/hợp đồng.
   - Nếu là tài chính/hóa đơn: Lập bảng số tiền, ngày thanh toán, mục đích.
5. **Các điểm quan trọng cần lưu ý / Khuyến nghị tiếp theo**: Những việc cần làm tiếp theo, hạn bảo hành, lịch tái khám, giấy tờ còn thiếu.
6. **Danh sách tài liệu tham chiếu**: Trích dẫn rõ thông tin được lấy từ tài liệu nào.

Hãy trình bày trực quan, sinh động với bullet point và emoji thân thiện, tuyệt đối trung thực với dữ liệu được trích xuất từ tài liệu, không tự bịa đặt thông tin không có trong tài liệu.
`;

    const userPrompt = `
Yêu cầu của người dùng: "${query}"

Danh sách các tài liệu liên quan trong gia đình:
${JSON.stringify(docsContext, null, 2)}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });

      const synthesis = response.choices[0]?.message?.content || 'Không thể tạo bản tổng hợp.';

      return {
        query,
        synthesis,
        sourceDocuments: documents.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          thumbnailUrl: d.thumbnailUrl,
          fileUrl: d.fileUrl,
          mimeType: d.mimeType,
          summary: d.summary,
          tags: d.tags,
        })),
      };
    } catch (err: any) {
      this.logger.error('Lỗi khi gọi OpenAI tổng hợp hồ sơ:', err);
      throw new BadRequestException('Lỗi trong quá trình AI tổng hợp hồ sơ: ' + (err.message || ''));
    }
  }

  /**
   * Phân tích nội dung tài liệu bằng OpenAI GPT-4o-mini Vision / OCR
   */
  private async analyzeDocumentContent(file: Express.Multer.File, userNote?: string) {
    if (!this.configService.get('OPENAI_API_KEY')) {
      return {
        title: file.originalname.replace(/\.[^/.]+$/, ''),
        category: 'Khác',
        tags: ['chưa_phân_tích_ai'],
        summary: 'Tài liệu đã được lưu trữ an toàn. Cần cấu hình OPENAI_API_KEY để tự động trích xuất nội dung.',
        extractedContent: '',
        structuredData: {},
      };
    }

    const isImage = file.mimetype.startsWith('image/');
    let messages: any[] = [];

    const systemPrompt = `
Bạn là chuyên gia OCR và Phân tích Trích xuất Dữ liệu Tài liệu Gia đình thông minh.
Nhiệm vụ:
1. Đọc và trích xuất TOÀN BỘ chữ (OCR), số liệu, bảng biểu có trong tài liệu/hình ảnh/giấy tờ với độ chính xác cao nhất (tiếng Việt & tiếng Anh).
2. Tự động đặt Tiêu đề ngắn gọn, chuẩn xác, dễ tìm kiếm (Ví dụ: "Phiếu khám mắt & cắt kính Mi Mi 12/2025", "Sổ hồng nhà đất Mỹ Ca", "Hóa đơn tiền điện T10/2026", "Giấy chứng nhận tiêm chủng").
3. Phân loại vào 1 trong các danh mục: ${DEFAULT_CATEGORIES.join(', ')}.
4. Gắn các thẻ tags từ khóa quan trọng (tên người, địa danh, loại giấy tờ, số hiệu, mã số...).
5. Viết bản tóm tắt nội dung tài liệu (3-5 câu súc tích).
6. Trích xuất dữ liệu có cấu trúc dạng JSON:
   - documentDate: Ngày ghi trên chứng từ (YYYY-MM-DD nếu có)
   - personNames: Danh sách tên người liên quan
   - measurements: Các thông số, số đo, chỉ số quan trọng (ví dụ độ cận SPH, loạn CYL, diện tích m2, v.v.)
   - amount: Số tiền (nếu là hóa đơn/chứng từ giao dịch)
   - address: Địa chỉ (nếu có)
   - issuer: Đơn vị/bệnh viện/cơ quan phát hành

Đầu ra BẮT BUỘC là JSON hợp lệ theo cấu trúc:
{
  "title": "...",
  "category": "...",
  "tags": ["...", "..."],
  "summary": "...",
  "extractedContent": "Toàn bộ nội dung văn bản chi tiết trích xuất được từ ảnh/tài liệu...",
  "structuredData": { ... }
}
`;

    if (isImage) {
      const base64Image = file.buffer.toString('base64');
      const dataUrl = `data:${file.mimetype};base64,${base64Image}`;
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Phân tích và trích xuất tài liệu này. Tên file gốc: ${file.originalname}. Ghi chú của người dùng: ${userNote || 'Không có'}.`,
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
          ],
        },
      ];
    } else {
      // Cho file PDF hoặc văn bản khác
      let textContent = '';
      if (file.mimetype.includes('text') || file.mimetype.includes('json') || file.mimetype.includes('csv')) {
        textContent = file.buffer.toString('utf-8');
      }

      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Phân tích tài liệu: ${file.originalname} (Loại file: ${file.mimetype}). Ghi chú của người dùng: ${userNote || 'Không có'}.\nNội dung text đính kèm:\n${textContent.slice(0, 10000)}`,
        },
      ];
    }

    const response = await this.openai.chat.completions.create({
      model: this.configService.get('OPENAI_MODEL', 'gpt-4o-mini'),
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Không nhận được phản hồi từ AI');

    const parsed = JSON.parse(content);
    return {
      title: parsed.title || file.originalname.replace(/\.[^/.]+$/, ''),
      category: parsed.category || 'Khác',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      summary: parsed.summary || '',
      extractedContent: parsed.extractedContent || '',
      structuredData: parsed.structuredData || {},
    };
  }

  private async reanalyzeFromUrl(fileUrl: string, mimeType: string, userNote?: string) {
    const isImage = mimeType.startsWith('image/');
    const systemPrompt = `
Bạn là chuyên gia OCR và Phân tích Trích xuất Dữ liệu Tài liệu Gia đình thông minh.
Nhiệm vụ: Đọc và trích xuất TOÀN BỘ chữ (OCR), phân loại, gắn tags, tóm tắt và trích xuất dữ liệu có cấu trúc.
Đầu ra BẮT BUỘC là JSON hợp lệ theo cấu trúc:
{
  "title": "...",
  "category": "...",
  "tags": ["...", "..."],
  "summary": "...",
  "extractedContent": "...",
  "structuredData": { ... }
}
`;

    let messages: any[] = [];
    if (isImage) {
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Phân tích lại tài liệu này. Ghi chú: ${userNote || 'Không có'}` },
            { type: 'image_url', image_url: { url: fileUrl, detail: 'high' } },
          ],
        },
      ];
    } else {
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Phân tích tài liệu từ đường dẫn: ${fileUrl}. Ghi chú: ${userNote || 'Không có'}` },
      ];
    }

    const response = await this.openai.chat.completions.create({
      model: this.configService.get('OPENAI_MODEL', 'gpt-4o-mini'),
      messages,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  }
}
