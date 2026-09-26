import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseEntryType } from '../../common/entities/expense.entity';
import { Category } from '../../common/entities/category.entity';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async findAll(familyId: string, filters: any = {}) {
    const { page, pageSize, ...rest } = filters ?? {};
    const query = this.expenseRepository.createQueryBuilder('expense')
      .leftJoinAndSelect('expense.asset', 'asset')
      .leftJoinAndSelect('expense.category', 'category')
      .where('expense.familyId = :familyId', { familyId });

    if (rest.assetId) {
      query.andWhere('expense.assetId = :assetId', { assetId: rest.assetId });
    }

    if (rest.categoryId) {
      query.andWhere('expense.categoryId = :categoryId', { categoryId: rest.categoryId });
    }

    if (rest.direction) {
      query.andWhere('expense.entryType = :entryType', { entryType: rest.direction });
    }

    if (rest.isTransfer !== undefined) {
      query.andWhere('expense.isTransfer = :isTransfer', {
        isTransfer: rest.isTransfer === true || rest.isTransfer === 'true',
      });
    }

    if (rest.createdBy) {
      query.andWhere('expense.createdBy = :createdBy', { createdBy: rest.createdBy });
    }

    if (rest.amount) {
      query.andWhere('expense.amount = :amount', { amount: Number(rest.amount) });
    }

    if (rest.startDate && rest.endDate) {
      query.andWhere('expense.expenseDate BETWEEN :startDate AND :endDate', {
        startDate: rest.startDate,
        endDate: rest.endDate,
      });
    }

    const wantsPage = page !== undefined && page !== null && page !== '';
    if (!wantsPage) {
      return query
        .orderBy('expense.expenseDate', 'DESC')
        .addOrderBy('expense.createdAt', 'DESC')
        .getMany();
    }

    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));
    const skip = (p - 1) * take;

    const total = await query.clone().getCount();
    const items = await query
      .orderBy('expense.expenseDate', 'DESC')
      .addOrderBy('expense.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();

    return {
      items,
      total,
      page: p,
      pageSize: take,
      hasMore: skip + items.length < total,
    };
  }

  async create(familyId: string, userId: string, data: Partial<Expense>) {
    const entryType = await this.resolveEntryType(familyId, data);
    const expense = this.expenseRepository.create({
      ...data,
      familyId,
      createdBy: userId,
      entryType,
      isTransfer: data.isTransfer ?? false,
    });

    return this.expenseRepository.save(expense);
  }

  async findOne(id: string, familyId: string) {
    return this.expenseRepository.findOne({
      where: { id, familyId },
      relations: ['asset', 'category'],
    });
  }

  async update(id: string, familyId: string, userId: string, data: Partial<Expense>) {
    const expense = await this.findOne(id, familyId);
    if (!expense) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }

    const entryType = await this.resolveEntryType(familyId, data, expense);
    Object.assign(expense, data);
    expense.updatedBy = userId;
    expense.entryType = entryType;
    expense.isTransfer = data.isTransfer ?? expense.isTransfer ?? false;

    return this.expenseRepository.save(expense);
  }

  async delete(id: string, familyId: string) {
    const expense = await this.findOne(id, familyId);
    if (!expense) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    return this.expenseRepository.softRemove(expense);
  }

  async exportToCsv(familyId: string, filters: any = {}): Promise<string> {
    const { page: _p, pageSize: _ps, ...exportFilters } = filters ?? {};
    const expensesRaw = await this.findAll(familyId, exportFilters);
    const expenses = Array.isArray(expensesRaw) ? expensesRaw : expensesRaw.items;
    const flattenedData = expenses.map(e => ({
      id: e.id,
      amount: e.amount,
      category: e.category?.name || '',
      entryType: e.entryType,
      isTransfer: e.isTransfer ? 'Có' : 'Không',
      description: e.note || '',
      expenseDate: e.expenseDate,
      asset: e.asset?.name || '',
    }));

    return stringify(flattenedData, {
      header: true,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'amount', header: 'Số tiền' },
        { key: 'category', header: 'Danh mục' },
        { key: 'entryType', header: 'Loại giao dịch' },
        { key: 'isTransfer', header: 'Chuyển nội bộ' },
        { key: 'description', header: 'Mô tả' },
        { key: 'expenseDate', header: 'Ngày' },
        { key: 'asset', header: 'Tài sản' },
      ],
    });
  }

  private async resolveEntryType(
    familyId: string,
    data: Partial<Expense>,
    currentExpense?: Expense,
  ): Promise<ExpenseEntryType> {
    const categoryId = data.categoryId ?? currentExpense?.categoryId;
    const entryType = (data.entryType ?? currentExpense?.entryType) as ExpenseEntryType | undefined;
    if (!entryType) {
      throw new BadRequestException('Loại giao dịch là bắt buộc');
    }

    if (!categoryId) {
      return entryType;
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, familyId },
    });

    if (!category) {
      throw new NotFoundException('Danh mục không tồn tại');
    }

    return entryType;
  }
}
