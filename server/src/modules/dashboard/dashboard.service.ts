import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Asset, AssetStatus } from '../../common/entities/asset.entity';
import { Expense, ExpenseEntryType } from '../../common/entities/expense.entity';
import { CalendarEvent } from '../../common/entities/calendar-event.entity';
import { AssetService } from '../asset/asset.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
    @InjectRepository(CalendarEvent)
    private calendarRepository: Repository<CalendarEvent>,
    private readonly assetService: AssetService,
  ) {}

  async getStats(
    familyId: string,
    filters: { startDate?: string; endDate?: string; categoryId?: string } = {},
  ) {
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const startOf6MonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    const next30Days = new Date(today);
    next30Days.setDate(next30Days.getDate() + 30);

    // ===== Monthly summaries =====
    const sumExpensesInRange = async (
      start: Date,
      end: Date,
      type: ExpenseEntryType,
    ) => {
      const result = await this.expenseRepository
        .createQueryBuilder('expense')
        .where('expense.familyId = :familyId', { familyId })
        .andWhere('expense.isTransfer = false')
        .andWhere('expense.entryType = :type', { type })
        .andWhere('expense.expenseDate BETWEEN :start AND :end', {
          start: fmtDate(start),
          end: fmtDate(end),
        })
        .select('SUM(expense.amount)', 'total')
        .getRawOne();
      return Number(result?.total || 0);
    };

    // ===== Upcoming warranty expirations (next 30 days) =====
    const loadExpiringAssets = async () => {
      const rows = await this.assetRepository
        .createQueryBuilder('asset')
        .where('asset.familyId = :familyId', { familyId })
        .andWhere('asset.status = :status', { status: AssetStatus.ACTIVE })
        .andWhere('asset.warrantyExpiredAt BETWEEN :now AND :next30Days', {
          now: today,
          next30Days,
        })
        .orderBy('asset.warrantyExpiredAt', 'ASC')
        .limit(10)
        .getMany();
      await this.assetService.applyComputedCurrentValue(familyId, rows);
      return rows;
    };

    // ===== Upcoming maintenance (next 30 days) =====
    const loadUpcomingMaintenance = async () => {
      const rows = await this.assetRepository
        .createQueryBuilder('asset')
        .where('asset.familyId = :familyId', { familyId })
        .andWhere('asset.status = :status', { status: AssetStatus.ACTIVE })
        .andWhere('asset.nextMaintenanceDate BETWEEN :now AND :next30Days', {
          now: today,
          next30Days,
        })
        .orderBy('asset.nextMaintenanceDate', 'ASC')
        .limit(10)
        .getMany();
      await this.assetService.applyComputedCurrentValue(familyId, rows);
      return rows;
    };

    const breakdownStartDate = filters.startDate || fmtDate(startOfMonth);
    const breakdownEndDate = filters.endDate || fmtDate(endOfMonth);

    const expensesByCategoryQuery = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoin('expense.category', 'category')
      .where('expense.familyId = :familyId', { familyId })
      .andWhere('expense.isTransfer = false')
      .andWhere('expense.entryType = :entryType', {
        entryType: ExpenseEntryType.EXPENSE,
      })
      .andWhere('expense.expenseDate >= :startDate', {
        startDate: filters.startDate || fmtDate(startOfMonth),
      });

    if (filters.endDate) {
      expensesByCategoryQuery.andWhere('expense.expenseDate <= :endDate', {
        endDate: filters.endDate,
      });
    }
    if (filters.categoryId) {
      expensesByCategoryQuery.andWhere('expense.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    // All of the below are independent reads (only depend on familyId/date
    // filters computed above, not on each other) — running them one at a
    // time via sequential `await` pays a full network round trip per query
    // for no reason. Since Vercel↔Supabase is cross-region, each round trip
    // can cost 100s of ms, so this alone used to dominate the endpoint's
    // latency regardless of how little data the family actually has.
    const [
      activeAssetsRaw,
      monthlyIncome,
      monthlyExpenses,
      prevMonthIncome,
      prevMonthExpenses,
      trendRows,
      rawExpensesByCategory,
      categoryBreakdownRaw,
      topExpenses,
      expiringAssets,
      upcomingMaintenance,
      upcomingEvents,
    ] = await Promise.all([
      this.assetService.findAll(familyId, { status: AssetStatus.ACTIVE }),
      sumExpensesInRange(startOfMonth, endOfMonth, ExpenseEntryType.INCOME),
      sumExpensesInRange(startOfMonth, endOfMonth, ExpenseEntryType.EXPENSE),
      sumExpensesInRange(startOfPrevMonth, endOfPrevMonth, ExpenseEntryType.INCOME),
      sumExpensesInRange(startOfPrevMonth, endOfPrevMonth, ExpenseEntryType.EXPENSE),
      this.expenseRepository
        .createQueryBuilder('expense')
        .where('expense.familyId = :familyId', { familyId })
        .andWhere('expense.isTransfer = false')
        .andWhere('expense.expenseDate >= :start', {
          start: fmtDate(startOf6MonthsAgo),
        })
        .andWhere('expense.entryType IN (:...types)', {
          types: [ExpenseEntryType.INCOME, ExpenseEntryType.EXPENSE],
        })
        .select(`TO_CHAR(expense."expenseDate", 'YYYY-MM')`, 'month')
        .addSelect('expense.entryType', 'type')
        .addSelect('SUM(expense.amount)', 'amount')
        .groupBy(`TO_CHAR(expense."expenseDate", 'YYYY-MM')`)
        .addGroupBy('expense.entryType')
        .orderBy(`TO_CHAR(expense."expenseDate", 'YYYY-MM')`, 'ASC')
        .getRawMany(),
      expensesByCategoryQuery
        .select('category.name', 'category')
        .addSelect('SUM(expense.amount)', 'amount')
        .groupBy('category.name')
        .getRawMany(),
      this.expenseRepository
        .createQueryBuilder('expense')
        .leftJoin('expense.category', 'category')
        .leftJoin('category.parent', 'parent')
        .where('expense.familyId = :familyId', { familyId })
        .andWhere('expense.isTransfer = false')
        .andWhere('expense.expenseDate BETWEEN :start AND :end', {
          start: breakdownStartDate,
          end: breakdownEndDate,
        })
        .select('category.id', 'categoryId')
        .addSelect('category.name', 'categoryName')
        .addSelect('parent.name', 'parentName')
        .addSelect('expense.entryType', 'entryType')
        .addSelect('SUM(expense.amount)', 'amount')
        .addSelect('COUNT(expense.id)', 'count')
        .groupBy('category.id')
        .addGroupBy('category.name')
        .addGroupBy('parent.name')
        .addGroupBy('expense.entryType')
        .getRawMany(),
      this.expenseRepository
        .createQueryBuilder('expense')
        .leftJoinAndSelect('expense.category', 'category')
        .where('expense.familyId = :familyId', { familyId })
        .andWhere('expense.isTransfer = false')
        .andWhere('expense.entryType = :entryType', {
          entryType: ExpenseEntryType.EXPENSE,
        })
        .andWhere('expense.expenseDate BETWEEN :start AND :end', {
          start: fmtDate(startOfMonth),
          end: fmtDate(endOfMonth),
        })
        .orderBy('expense.amount', 'DESC')
        .limit(5)
        .getMany(),
      loadExpiringAssets(),
      loadUpcomingMaintenance(),
      this.calendarRepository.find({
        where: {
          familyId,
          startDate: Between(today, next7Days),
        },
        order: { startDate: 'ASC' },
        take: 10,
      }),
    ]);

    const activeAssets = Array.isArray(activeAssetsRaw) ? activeAssetsRaw : activeAssetsRaw.items;
    const totalAssetValue = activeAssets.reduce(
      (sum, a) => sum + Number(a.currentValue || 0),
      0,
    );
    const totalAssetCount = activeAssets.length;

    const totalLiabilities = 0;
    const netWorth = totalAssetValue;

    const monthlyNet = monthlyIncome - monthlyExpenses;
    const savingsRate =
      monthlyIncome > 0 ? Math.round((monthlyNet / monthlyIncome) * 100) : 0;

    const monthlyTrendMap = new Map<
      string,
      { income: number; expenses: number }
    >();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrendMap.set(key, { income: 0, expenses: 0 });
    }
    for (const row of trendRows) {
      const entry = monthlyTrendMap.get(row.month);
      if (!entry) continue;
      const amount = Number(row.amount);
      if (row.type === ExpenseEntryType.INCOME) entry.income = amount;
      else if (row.type === ExpenseEntryType.EXPENSE) entry.expenses = amount;
    }
    const monthlyTrend = Array.from(monthlyTrendMap.entries()).map(
      ([month, { income, expenses }]) => ({
        month,
        income,
        expenses,
        net: income - expenses,
      }),
    );

    // ===== Expenses by category (filterable range) =====
    const expensesByCategory = rawExpensesByCategory
      .filter((row) => !!row.category)
      .map((row) => ({
        category: row.category,
        amount: Number(row.amount) || 0,
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // ===== Assets by category (dùng currentValue đã tính động) =====
    const assetsByCategoryMap = new Map<string, { value: number; count: number }>();
    for (const a of activeAssets) {
      const name = a.category?.name || 'Khác';
      const bucket = assetsByCategoryMap.get(name) ?? { value: 0, count: 0 };
      bucket.value += Number(a.currentValue || 0);
      bucket.count += 1;
      assetsByCategoryMap.set(name, bucket);
    }
    const assetsByCategory = Array.from(assetsByCategoryMap.entries())
      .map(([category, { value, count }]) => ({ category, value, count }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);

    // ===== Category breakdown by entryType (for filterable date range) =====
    const categoryBreakdown = categoryBreakdownRaw
      .filter((row) => !!row.categoryId)
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        parentName: row.parentName,
        entryType: row.entryType,
        amount: Number(row.amount || 0),
        count: Number(row.count || 0),
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      // Asset / wealth
      totalAssetValue,
      totalAssetCount,
      totalLiabilities,
      netWorth,

      // Current month
      monthlyIncome,
      monthlyExpenses,
      monthlyNet,
      savingsRate,

      // Previous month (for delta)
      prevMonthIncome,
      prevMonthExpenses,

      // Trends
      monthlyTrend,

      // Distributions
      expensesByCategory,
      assetsByCategory,
      categoryBreakdown,

      // Top transactions
      topExpenses,

      // Action items
      expiringAssets,
      upcomingMaintenance,
      upcomingEvents,

      // Backwards-compat with old dashboard payload
      totalAssets: totalAssetCount,
    };
  }
}
