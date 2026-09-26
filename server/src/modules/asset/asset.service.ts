import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../common/entities/asset.entity';
import { Category } from '../../common/entities/category.entity';
import { Expense, ExpenseEntryType } from '../../common/entities/expense.entity';
import { stringify } from 'csv-stringify/sync';

type LinkedFlow = { chi: number; thu: number };

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
  ) {}

  /**
   * Tổng chi (EXPENSE) và tổng thu (INCOME) theo tài sản — bỏ chuyển nội bộ.
   * Dùng cho dashboard sau query riêng (getMany từ query builder).
   */
  async applyComputedCurrentValue(familyId: string, assets: Asset[]): Promise<void> {
    await this.hydrateComputedCurrentValues(familyId, assets);
  }

  async findAll(familyId: string, filters: any = {}) {
    const { page, pageSize, ...rest } = filters ?? {};
    const query = this.assetRepository.createQueryBuilder('asset')
      .leftJoinAndSelect('asset.category', 'category')
      .leftJoinAndSelect('asset.owner', 'owner')
      .leftJoinAndSelect('asset.usedBy', 'usedBy')
      .where('asset.familyId = :familyId', { familyId });

    if (rest.categoryId) {
      query.andWhere('asset.categoryId = :categoryId', { categoryId: rest.categoryId });
    }

    if (rest.status) {
      query.andWhere('asset.status = :status', { status: rest.status });
    }

    if (rest.search) {
      query.andWhere('(asset.name ILIKE :search OR asset.description ILIKE :search)', {
        search: `%${rest.search}%`,
      });
    }

    const wantsPage = page !== undefined && page !== null && page !== '';

    if (!wantsPage) {
      const assets = await query.orderBy('asset.createdAt', 'DESC').getMany();
      await this.hydrateComputedCurrentValues(familyId, assets);
      return assets;
    }

    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));
    const skip = (p - 1) * take;

    const total = await query.clone().getCount();
    const assets = await query
      .orderBy('asset.createdAt', 'DESC')
      .skip(skip)
      .take(take)
      .getMany();
    await this.hydrateComputedCurrentValues(familyId, assets);

    return {
      items: assets,
      total,
      page: p,
      pageSize: take,
      hasMore: skip + assets.length < total,
    };
  }

  async findOne(id: string, familyId: string) {
    const asset = await this.assetRepository.findOne({
      where: { id, familyId },
      relations: ['category', 'owner', 'usedBy'],
    });
    if (!asset) {
      return null;
    }
    await this.hydrateComputedCurrentValues(familyId, [asset]);
    return asset;
  }

  async create(familyId: string, userId: string, data: Partial<Asset>) {
    await this.validateAssetCategory(familyId, data.categoryId);
    const { currentValue: _ignored, ...rest } = data as Record<string, unknown> & Partial<Asset>;
    const purchase = Number((rest as Partial<Asset>).purchasePrice ?? 0);
    const asset = this.assetRepository.create({
      ...(rest as Partial<Asset>),
      familyId,
      createdBy: userId,
      // Cột DB giữ giá trị ban đầu; API luôn trả currentValue theo công thức động.
      currentValue: purchase,
    });
    const saved = await this.assetRepository.save(asset);
    return this.findOne(saved.id, familyId);
  }

  async update(id: string, familyId: string, userId: string, data: Partial<Asset>) {
    const existing = await this.findOne(id, familyId);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }
    await this.validateAssetCategory(familyId, data.categoryId);
    const { currentValue: _cv, ...updatePayload } = data as Record<string, unknown> & Partial<Asset>;
    await this.assetRepository.update(
      { id, familyId },
      { ...(updatePayload as Partial<Asset>), updatedBy: userId } as any,
    );
    return this.findOne(id, familyId);
  }

  async delete(id: string, familyId: string) {
    const asset = await this.assetRepository.findOne({ where: { id, familyId } });
    if (!asset) {
      throw new NotFoundException('Không tìm thấy tài sản');
    }
    return this.assetRepository.softRemove(asset);
  }

  async exportToCsv(familyId: string, filters: any = {}): Promise<string> {
    const { page: _p, pageSize: _ps, ...exportFilters } = filters ?? {};
    const raw = await this.findAll(familyId, exportFilters);
    const assets = Array.isArray(raw) ? raw : raw.items;

    return stringify(assets, {
      header: true,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Tên tài sản' },
        { key: 'description', header: 'Mô tả' },
        { key: 'purchasePrice', header: 'Giá mua' },
        { key: 'currentValue', header: 'Giá hiện tại' },
        { key: 'status', header: 'Trạng thái' },
        { key: 'purchaseDate', header: 'Ngày mua' },
        { key: 'warrantyExpiredAt', header: 'Hết hạn bảo hành' },
      ],
    });
  }

  private async validateAssetCategory(familyId: string, categoryId?: string) {
    if (!categoryId) {
      return;
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, familyId },
    });

    if (!category) {
      throw new NotFoundException('Danh mục tài sản không tồn tại');
    }

    if (category.parentId === null) {
      throw new BadRequestException('Tài sản cần chọn danh mục lá (thuộc một nhóm cha), không chọn nhóm gốc');
    }
  }

  /**
   * Giá hiện tại động: giá mua + tổng chi gắn tài sản − tổng thu gắn tài sản (không tính chuyển nội bộ).
   */
  private async hydrateComputedCurrentValues(familyId: string, assets: Asset[]): Promise<void> {
    if (assets.length === 0) {
      return;
    }

    const assetIds = assets.map((a) => a.id);
    const flowMap = await this.loadLinkedCashFlowByAssetIds(familyId, assetIds);

    for (const asset of assets) {
      const { chi, thu } = flowMap.get(asset.id) ?? { chi: 0, thu: 0 };
      const purchase = Number(asset.purchasePrice ?? 0);
      asset.currentValue = purchase + chi - thu;
      (asset as Asset & { linkedExpenseTotal?: number; linkedIncomeTotal?: number }).linkedExpenseTotal = chi;
      (asset as Asset & { linkedExpenseTotal?: number; linkedIncomeTotal?: number }).linkedIncomeTotal = thu;
    }
  }

  private async loadLinkedCashFlowByAssetIds(
    familyId: string,
    assetIds: string[],
  ): Promise<Map<string, LinkedFlow>> {
    const map = new Map<string, LinkedFlow>();
    if (assetIds.length === 0) {
      return map;
    }

    const rows = await this.expenseRepository
      .createQueryBuilder('e')
      .select('e.assetId', 'assetId')
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.entryType = :expenseType AND e.isTransfer = false THEN CAST(e.amount AS DECIMAL) ELSE 0 END), 0)`,
        'chi',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.entryType = :incomeType AND e.isTransfer = false THEN CAST(e.amount AS DECIMAL) ELSE 0 END), 0)`,
        'thu',
      )
      .where('e.familyId = :familyId', { familyId })
      .andWhere('e.assetId IN (:...assetIds)', { assetIds })
      .setParameter('expenseType', ExpenseEntryType.EXPENSE)
      .setParameter('incomeType', ExpenseEntryType.INCOME)
      .groupBy('e.assetId')
      .getRawMany();

    for (const row of rows) {
      const id = row.assetId as string;
      map.set(id, {
        chi: Number(row.chi ?? 0),
        thu: Number(row.thu ?? 0),
      });
    }

    return map;
  }
}
