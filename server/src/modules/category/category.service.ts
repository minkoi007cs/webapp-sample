import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Category } from '../../common/entities/category.entity';
import { Asset } from '../../common/entities/asset.entity';
import { Expense } from '../../common/entities/expense.entity';

/** Nhóm mặc định dùng khi thêm nhanh danh mục lá mà không chọn nhóm cha. */
const DEFAULT_QUICK_GROUP_NAME = 'Danh mục chung';

/** Cây danh mục mặc định khi tạo gia đình (chỉ còn phân cấp cha–con, không có “loại”). */
const DEFAULT_CATEGORY_GROUPS: Array<{ name: string; categories: string[] }> = [
  { name: 'Sinh hoạt', categories: ['Ăn uống', 'Đi lại', 'Hóa đơn'] },
  { name: 'Thu nhập', categories: ['Lương / Thu nhập chính', 'Thưởng, quà, hoàn tiền'] },
  { name: 'Khoản nợ', categories: ['Khoản vay', 'Thẻ tín dụng'] },
  {
    name: 'Tài sản & thanh khoản',
    categories: ['Tiền mặt', 'Tài khoản ngân hàng', 'Nhà đất', 'Xe cộ', 'Cổ phiếu', 'Crypto'],
  },
];

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
  ) {}

  async findAll(familyId: string) {
    await this.repairInvalidParentAssignments(familyId);
    return this.categoryRepository.find({
      where: { familyId },
      relations: ['parent'],
      order: {
        parentId: 'ASC',
        name: 'ASC',
      },
    });
  }

  async ensureDefaultIncomeCategories(familyId: string): Promise<void> {
    // Every group/category name here is a distinct hardcoded literal, so
    // running them concurrently can't race on the same (familyId, name,
    // parentId) lookup -- this turns ~21 sequential round trips (run on
    // every signup/invite-accept/family-creation) into 2 parallel waves.
    await Promise.all(DEFAULT_CATEGORY_GROUPS.map(async (groupDef) => {
      const group = await this.findOrCreateCategory(familyId, {
        name: groupDef.name,
        parentId: null,
        isDefault: true,
      });

      await Promise.all(groupDef.categories.map((categoryName) =>
        this.findOrCreateCategory(familyId, {
          name: categoryName,
          parentId: group.id,
          isDefault: true,
        }),
      ));
    }));
  }

  async create(familyId: string, data: Partial<Category>) {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('Tên danh mục là bắt buộc');
    }

    let parentId: string | null;
    if (data.parentId === null) {
      parentId = null;
    } else if (data.parentId) {
      parentId = await this.validateParent(familyId, data.parentId);
    } else {
      const defaultGroup = await this.ensureDefaultQuickGroup(familyId);
      parentId = defaultGroup.id;
    }

    const category = this.categoryRepository.create({
      familyId,
      name,
      parentId,
      isDefault: data.isDefault ?? false,
    });
    return this.categoryRepository.save(category);
  }

  async findOne(id: string, familyId: string) {
    return this.categoryRepository.findOne({
      where: { id, familyId },
      relations: ['children', 'parent'],
    });
  }

  async update(id: string, familyId: string, data: Partial<Category>) {
    const category = await this.findOne(id, familyId);
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');

    const nextParentId = 'parentId' in data ? (data.parentId ?? null) : category.parentId;

    if (nextParentId !== null && (category.children?.length ?? 0) > 0) {
      throw new BadRequestException('Danh mục đang có danh mục con, không thể thêm danh mục cha');
    }

    const resolvedParentId =
      nextParentId === null ? null : await this.validateParent(familyId, nextParentId, id);

    const nextName = data.name !== undefined ? data.name.trim() : category.name;
    if (!nextName) {
      throw new BadRequestException('Tên danh mục không được để trống');
    }

    await this.categoryRepository.update(
      { id, familyId },
      {
        name: nextName,
        isDefault: data.isDefault !== undefined ? data.isDefault : category.isDefault,
        parentId: resolvedParentId,
        ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
      },
    );

    return this.findOne(id, familyId);
  }

  /** Thống kê trước khi xóa (tài sản / giao dịch / danh mục con). */
  async getUsageBeforeDelete(id: string, familyId: string) {
    const category = await this.categoryRepository.findOne({ where: { id, familyId } });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    const [childCategoryCount, assetCount, expenseCount] = await Promise.all([
      this.categoryRepository.count({ where: { parentId: id, familyId } }),
      this.assetRepository.count({ where: { categoryId: id, familyId } }),
      this.expenseRepository.count({ where: { categoryId: id, familyId } }),
    ]);
    return { assetCount, expenseCount, childCategoryCount };
  }

  /**
   * Xóa danh mục. Có danh mục con thì từ chối.
   * Còn tài sản hoặc giao dịch gắn danh mục thì bắt buộc truyền `reassignToCategoryId` (danh mục lá khác) để chuyển hết rồi mới xóa.
   */
  async delete(id: string, familyId: string, reassignToCategoryId?: string) {
    const category = await this.findOne(id, familyId);
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    const childCategoryCount = await this.categoryRepository.count({
      where: { parentId: id, familyId },
    });
    if (childCategoryCount > 0) {
      throw new BadRequestException(
        `Không thể xóa: danh mục còn ${childCategoryCount} danh mục con. Hãy xóa hoặc gom các danh mục con trước.`,
      );
    }

    const [assetCount, expenseCount] = await Promise.all([
      this.assetRepository.count({ where: { categoryId: id, familyId } }),
      this.expenseRepository.count({ where: { categoryId: id, familyId } }),
    ]);

    if (assetCount === 0 && expenseCount === 0) {
      return this.categoryRepository.softRemove(category);
    }

    const targetRaw = reassignToCategoryId?.trim();
    if (!targetRaw) {
      throw new BadRequestException(
        `Không thể xóa: còn ${assetCount} tài sản và ${expenseCount} giao dịch gắn danh mục này. Chọn một danh mục lá khác để chuyển toàn bộ tài sản và giao dịch sang, rồi thử xóa lại.`,
      );
    }

    if (targetRaw === id) {
      throw new BadRequestException('Danh mục đích phải khác danh mục đang xóa');
    }

    const target = await this.categoryRepository.findOne({
      where: { id: targetRaw, familyId },
    });
    if (!target) {
      throw new NotFoundException('Danh mục đích không tồn tại');
    }
    if (target.parentId === null) {
      throw new BadRequestException('Danh mục đích phải là danh mục lá (có nhóm cha), không được là nhóm gốc');
    }

    return this.categoryRepository.manager.transaction(async (em) => {
      if (assetCount > 0) {
        await em.update(Asset, { familyId, categoryId: id }, { categoryId: targetRaw });
      }
      if (expenseCount > 0) {
        await em.update(Expense, { familyId, categoryId: id }, { categoryId: targetRaw });
      }
      return em.softRemove(category);
    });
  }

  private async ensureDefaultQuickGroup(familyId: string): Promise<Category> {
    return this.findOrCreateCategory(familyId, {
      name: DEFAULT_QUICK_GROUP_NAME,
      parentId: null,
      isDefault: true,
    });
  }

  private async findOrCreateCategory(
    familyId: string,
    data: { name: string; parentId: string | null; isDefault?: boolean },
  ): Promise<Category> {
    const existing = await this.categoryRepository.findOne({
      where: {
        familyId,
        name: data.name,
        parentId: data.parentId === null ? IsNull() : data.parentId,
      },
    });

    if (existing) return existing;

    const category = this.categoryRepository.create({
      familyId,
      name: data.name,
      parentId: data.parentId,
      isDefault: data.isDefault ?? false,
    });

    return this.categoryRepository.save(category);
  }

  private async validateParent(
    familyId: string,
    parentId: string,
    currentCategoryId?: string,
  ): Promise<string> {
    if (currentCategoryId && parentId === currentCategoryId) {
      throw new BadRequestException('Danh mục không thể tự làm danh mục cha');
    }

    const parent = await this.categoryRepository.findOne({
      where: { id: parentId, familyId },
    });

    if (!parent) throw new NotFoundException('Danh mục cha không tồn tại');
    if (parent.parentId !== null) {
      throw new BadRequestException('Danh mục cha phải là nhóm gốc (không có cha)');
    }

    return parent.id;
  }

  /**
   * Gắn lại các bản ghi lá bị treo (cha mất / cha không phải nhóm gốc) vào nhóm mặc định.
   */
  private async repairInvalidParentAssignments(familyId: string): Promise<void> {
    const categories = await this.categoryRepository.find({
      where: { familyId },
      relations: ['parent'],
      order: {
        isDefault: 'DESC',
        createdAt: 'ASC',
        name: 'ASC',
      },
    });

    const defaultGroup = await this.ensureDefaultQuickGroup(familyId);

    const idsToFix = categories
      .filter((category) => {
        if (category.parentId === null || category.parentId === defaultGroup.id) return false;
        const parent = category.parent;
        return !parent || parent.parentId !== null;
      })
      .map((category) => category.id);

    if (idsToFix.length === 0) {
      return;
    }

    // findAll() runs this on every category list load; a single batched
    // UPDATE keeps that hot path to one round trip no matter how many rows
    // drifted, instead of one UPDATE per invalid row.
    await this.categoryRepository.update({ id: In(idsToFix), familyId }, { parentId: defaultGroup.id });
  }
}
