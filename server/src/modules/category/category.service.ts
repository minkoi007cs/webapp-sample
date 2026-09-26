import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../common/entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async findAll(groupId: string): Promise<Category[]> {
    return this.categoryRepository.find({
      where: { groupId },
      relations: ['children', 'parent'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, groupId: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id, groupId },
      relations: ['children', 'parent'],
    });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục này');
    }
    return category;
  }

  async create(groupId: string, data: { name: string; parentId?: string | null }): Promise<Category> {
    const category = this.categoryRepository.create({
      name: data.name,
      groupId,
      parentId: data.parentId || null,
    });
    return this.categoryRepository.save(category);
  }

  async update(id: string, groupId: string, data: { name?: string; parentId?: string | null }): Promise<Category> {
    const category = await this.findOne(id, groupId);
    if (data.name !== undefined) category.name = data.name;
    if (data.parentId !== undefined) category.parentId = data.parentId;
    return this.categoryRepository.save(category);
  }

  async remove(id: string, groupId: string): Promise<{ success: boolean }> {
    const category = await this.findOne(id, groupId);
    await this.categoryRepository.remove(category);
    return { success: true };
  }

  // Compatibility helper
  async ensureDefaultIncomeCategories(_groupId: string) {
    // No-op
  }
}
