import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, In } from 'typeorm';
import { Sample, SampleStatus } from '../../common/entities/sample.entity';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { Document } from '../../common/entities/document.entity';
import { GroupUser, GroupUserStatus } from '../../common/entities/group-user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sample)
    private sampleRepository: Repository<Sample>,
    @InjectRepository(CalendarEvent)
    private calendarRepository: Repository<CalendarEvent>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(GroupUser)
    private groupUserRepository: Repository<GroupUser>,
  ) {}

  async getStats(
    groupId: string,
    _filters: { startDate?: string; endDate?: string; categoryId?: string } = {},
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    const [
      samples,
      sampleCount,
      activeSampleCount,
      recentDocuments,
      documentCount,
      upcomingEvents,
      membersCount,
    ] = await Promise.all([
      this.sampleRepository.find({
        where: { groupId },
        relations: ['category'],
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.sampleRepository.count({ where: { groupId } }),
      this.sampleRepository.count({
        where: {
          groupId,
          status: SampleStatus.ACTIVE,
        },
      }),
      this.documentRepository.find({
        where: { groupId },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.documentRepository.count({ where: { groupId } }),
      this.calendarRepository.find({
        where: {
          groupId,
          startDate: Between(today, next7Days),
        },
        order: { startDate: 'ASC' },
        take: 5,
      }),
      this.groupUserRepository.count({ where: { groupId, status: GroupUserStatus.ACTIVE } }),
    ]);

    // Group samples by category
    const categoryMap = new Map<string, number>();
    for (const s of samples) {
      const catName = s.category?.name || 'Khác';
      categoryMap.set(catName, (categoryMap.get(catName) || 0) + 1);
    }
    const samplesByCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      value: count,
    }));

    return {
      totalSampleCount: sampleCount,
      totalAssetCount: sampleCount, // Compatibility
      activeSampleCount,
      totalDocumentCount: documentCount,
      groupMembersCount: membersCount,
      recentSamples: samples.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        status: s.status,
        type: s.type,
        category: s.category ? { id: s.category.id, name: s.category.name } : null,
        createdAt: s.createdAt,
      })),
      samplesByCategory,
      assetsByCategory: samplesByCategory, // Compatibility
      recentDocuments,
      upcomingEvents,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      monthlyNet: 0,
      netWorth: 0,
      monthlyTrend: [],
      categoryBreakdown: [],
      topExpenses: [],
      expiringAssets: [],
      upcomingMaintenance: [],
    };
  }
}
