import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AssetMaintenance,
  AssetMaintenanceType,
  MaintenanceStatus,
} from '../../common/entities/asset-maintenance.entity';
import { Asset } from '../../common/entities/asset.entity';
import { CalendarEventType } from '../../common/entities/calendar-event.entity';
import { ExpenseEntryType } from '../../common/entities/expense.entity';
import { CalendarService } from '../calendar/calendar.service';
import { ExpenseService } from '../expense/expense.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CompleteMaintenanceDto } from './dto/complete-maintenance.dto';
import { MaintenanceFrequencyType } from './maintenance.types';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(AssetMaintenance)
    private readonly maintenanceRepository: Repository<AssetMaintenance>,
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
    private readonly calendarService: CalendarService,
    private readonly expenseService: ExpenseService,
  ) {}

  async create(familyId: string, userId: string, dto: CreateMaintenanceDto) {
    const asset = await this.assetRepository.findOne({
      where: { id: dto.assetId, familyId },
    });
    if (!asset) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }

    const scheduledDates = this.buildScheduledDateStrings(dto);
    const reminder = dto.reminderDaysBefore ?? null;

    // Each scheduled date is an independent maintenance row + calendar event
    // (they only read the already-fetched `asset`, never each other) -- a
    // recurring schedule could mean dozens of dates, and running them one at
    // a time via sequential `await` used to pay 3 round trips per date.
    const created = await Promise.all(scheduledDates.map(async (scheduledDate) => {
      let row = this.maintenanceRepository.create({
        familyId,
        createdBy: userId,
        assetId: dto.assetId,
        scheduledDate,
        type: dto.type,
        status: MaintenanceStatus.OPEN,
        content: dto.content ?? null,
        reminderDaysBefore: reminder,
      });
      row = await this.maintenanceRepository.save(row);

      const event = await this.calendarService.create(familyId, userId, {
        title: `${this.getTypeLabel(dto.type)}: ${asset.name}`,
        description: this.buildCalendarDescription(dto.type, dto.content, MaintenanceStatus.OPEN),
        startDate: this.scheduledDateToStartIso(scheduledDate),
        isFullDay: true,
        type: CalendarEventType.MAINTENANCE,
        reminderMinutes: reminder != null ? Math.max(0, reminder * 24 * 60) : undefined,
        metadata: this.buildCalendarMetadata(row.id, asset.id, dto.type, MaintenanceStatus.OPEN),
      });

      row.calendarEventId = event.id;
      return this.maintenanceRepository.save(row);
    }));

    return this.attachAssets(
      created.map((r) => r.id),
      familyId,
    );
  }

  async findAll(
    familyId: string,
    filters: { assetId?: string; status?: MaintenanceStatus; type?: AssetMaintenanceType },
  ) {
    const qb = this.maintenanceRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.asset', 'asset')
      .where('m.familyId = :familyId', { familyId })
      .orderBy('m.scheduledDate', 'ASC')
      .addOrderBy('m.createdAt', 'ASC');

    if (filters.assetId) {
      qb.andWhere('m.assetId = :assetId', { assetId: filters.assetId });
    }
    if (filters.status) {
      qb.andWhere('m.status = :status', { status: filters.status });
    }
    if (filters.type) {
      qb.andWhere('m.type = :type', { type: filters.type });
    }

    return qb.getMany();
  }

  async findOne(id: string, familyId: string) {
    const row = await this.maintenanceRepository.findOne({
      where: { id, familyId },
      relations: ['asset'],
    });
    if (!row) {
      throw new NotFoundException('Không tìm thấy lịch bảo trì');
    }
    return row;
  }

  async update(id: string, familyId: string, userId: string, dto: UpdateMaintenanceDto) {
    const row = await this.findOne(id, familyId);

    if (row.status === MaintenanceStatus.COMPLETED) {
      throw new BadRequestException('Không chỉnh sửa bảo trì đã hoàn thành');
    }

    if (dto.status === MaintenanceStatus.COMPLETED) {
      throw new BadRequestException('Dùng API hoàn thành để ghi nhận chi phí');
    }

    if (dto.status === MaintenanceStatus.SKIPPED) {
      if (row.status !== MaintenanceStatus.OPEN) {
        throw new BadRequestException('Chỉ bỏ qua lịch đang mở');
      }
      row.status = MaintenanceStatus.SKIPPED;
      if (dto.content !== undefined) {
        row.content = dto.content;
      }
      row.updatedBy = userId;
      if (row.calendarEventId) {
        await this.calendarService.update(row.calendarEventId, familyId, userId, {
          title: `${this.getTypeLabel(row.type)}: ${row.asset?.name || 'Tài sản'}`,
          description: this.buildCalendarDescription(row.type, row.content, row.status),
          metadata: this.buildCalendarMetadata(row.id, row.assetId, row.type, row.status),
          reminderMinutes: 0,
        });
      }
      return this.maintenanceRepository.save(row);
    }

    if (dto.type) {
      row.type = dto.type;
    }

    if (dto.scheduledDate && dto.scheduledDate !== row.scheduledDate) {
      row.scheduledDate = dto.scheduledDate.slice(0, 10);
    }

    if (dto.content !== undefined) {
      row.content = dto.content;
    }
    if (dto.reminderDaysBefore !== undefined) {
      row.reminderDaysBefore = dto.reminderDaysBefore;
    }

    if (row.calendarEventId) {
      await this.calendarService.update(row.calendarEventId, familyId, userId, {
        title: `${this.getTypeLabel(row.type)}: ${row.asset?.name || 'Tài sản'}`,
        description: this.buildCalendarDescription(row.type, row.content, row.status),
        startDate: this.scheduledDateToStartIso(row.scheduledDate),
        metadata: this.buildCalendarMetadata(row.id, row.assetId, row.type, row.status),
        reminderMinutes: row.reminderDaysBefore != null
          ? Math.max(0, row.reminderDaysBefore * 24 * 60)
          : undefined,
      });
    }

    row.updatedBy = userId;
    return this.maintenanceRepository.save(row);
  }

  async remove(id: string, familyId: string) {
    const row = await this.findOne(id, familyId);
    if (row.calendarEventId) {
      try {
        await this.calendarService.remove(row.calendarEventId, familyId);
      } catch {
        /* đã xóa */
      }
    }
    return this.maintenanceRepository.softRemove(row);
  }

  async complete(
    id: string,
    familyId: string,
    userId: string,
    dto: CompleteMaintenanceDto,
  ) {
    const row = await this.findOne(id, familyId);

    if (row.status !== MaintenanceStatus.OPEN) {
      throw new BadRequestException('Chỉ hoàn thành lịch đang mở');
    }
    if (row.expenseId) {
      throw new BadRequestException('Bản ghi đã có giao dịch liên kết');
    }

    const expense = await this.expenseService.create(familyId, userId, {
      amount: dto.cost,
      categoryId: dto.categoryId,
      assetId: row.assetId,
      expenseDate: new Date(row.scheduledDate),
      note: dto.content,
      entryType: row.type === AssetMaintenanceType.OPERATION
        ? ExpenseEntryType.INCOME
        : ExpenseEntryType.EXPENSE,
      currency: 'VND',
      isTransfer: false,
      customFields: { maintenanceId: row.id },
    });

    row.status = MaintenanceStatus.COMPLETED;
    row.content = dto.content;
    row.cost = dto.cost;
    row.expenseId = expense.id;
    row.updatedBy = userId;

    if (row.calendarEventId) {
      await this.calendarService.update(row.calendarEventId, familyId, userId, {
        title: `${this.getTypeLabel(row.type)}: ${row.asset?.name || 'Tài sản'}`,
        description: this.buildCalendarDescription(row.type, row.content, row.status),
        metadata: this.buildCalendarMetadata(row.id, row.assetId, row.type, row.status),
        reminderMinutes: 0,
      });
    }

    return this.maintenanceRepository.save(row);
  }

  private getTypeLabel(type: AssetMaintenanceType): string {
    switch (type) {
      case AssetMaintenanceType.OPERATION:
        return 'Khai thác';
      case AssetMaintenanceType.LIABILITY:
        return 'Nợ';
      case AssetMaintenanceType.MAINTENANCE:
      default:
        return 'Bảo trì';
    }
  }

  private getStatusLabel(status: MaintenanceStatus): string {
    switch (status) {
      case MaintenanceStatus.COMPLETED:
        return 'Đã ghi nhận';
      case MaintenanceStatus.SKIPPED:
        return 'Đã bỏ qua';
      case MaintenanceStatus.OPEN:
      default:
        return 'Đang chờ';
    }
  }

  private buildCalendarDescription(
    type: AssetMaintenanceType,
    content: string | null | undefined,
    status: MaintenanceStatus,
  ): string {
    const base = content || `Lịch ${this.getTypeLabel(type).toLowerCase()} tài sản`;
    return `${base} · ${this.getStatusLabel(status)}`;
  }

  private buildCalendarMetadata(
    maintenanceId: string,
    assetId: string,
    type: AssetMaintenanceType,
    status: MaintenanceStatus,
  ): string {
    return JSON.stringify({ maintenanceId, assetId, maintenanceType: type, maintenanceStatus: status });
  }

  /** Sinh chuỗi ngày YYYY-MM-DD: không tần suất → 1 ngày; có tần suất → repeatCount bản ghi (mặc định 12). */
  private buildScheduledDateStrings(dto: CreateMaintenanceDto): string[] {
    const start = dto.startDate.slice(0, 10);
    if (!dto.frequencyType) {
      return [start];
    }

    const step = Math.min(12, Math.max(1, dto.frequencyValue ?? 1));
    const total = Math.min(48, Math.max(1, dto.repeatCount ?? 12));
    const dates: string[] = [];
    let current = this.parseYmd(start);

    for (let i = 0; i < total; i++) {
      dates.push(this.formatYmd(current));
      if (i < total - 1) {
        current = this.addStep(current, dto.frequencyType, step);
      }
    }
    return dates;
  }

  private addStep(
    d: Date,
    type: MaintenanceFrequencyType,
    step: number,
  ): Date {
    const next = new Date(d.getTime());
    if (type === MaintenanceFrequencyType.MONTHLY) {
      next.setMonth(next.getMonth() + step);
    } else if (type === MaintenanceFrequencyType.YEARLY) {
      next.setFullYear(next.getFullYear() + step);
    } else {
      next.setDate(next.getDate() + step);
    }
    return next;
  }

  private parseYmd(s: string): Date {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private formatYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Bắt đầu ngày theo UTC nửa đêm — đồng bộ với lịch full-day */
  private scheduledDateToStartIso(scheduledDate: string): string {
    const [y, m, d] = scheduledDate.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toISOString();
  }

  private async attachAssets(ids: string[], familyId: string) {
    if (ids.length === 0) {
      return [];
    }
    return this.maintenanceRepository.find({
      where: { id: In(ids), familyId },
      relations: ['asset'],
      order: { scheduledDate: 'ASC', createdAt: 'ASC' },
    });
  }
}
