import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sample, SampleStatus } from '../../common/entities/sample.entity';
import { CreateSampleDto } from './dto/create-sample.dto';
import { UpdateSampleDto } from './dto/update-sample.dto';

@Injectable()
export class SampleService {
  constructor(
    @InjectRepository(Sample)
    private sampleRepository: Repository<Sample>,
  ) {}

  async create(groupId: string, userId: string, dto: CreateSampleDto): Promise<Sample> {
    const categoryId = dto.categoryId && typeof dto.categoryId === 'string' && dto.categoryId.trim() !== ''
      ? dto.categoryId.trim()
      : undefined;

    const sample = this.sampleRepository.create({
      name: dto.name.trim(),
      code: dto.code?.trim() || undefined,
      description: dto.description?.trim() || undefined,
      type: dto.type?.trim() || undefined,
      status: dto.status || SampleStatus.ACTIVE,
      categoryId,
      imageUrl: dto.imageUrl?.trim() || undefined,
      metadata: dto.metadata || undefined,
      groupId,
      createdByUserId: userId,
    });
    return this.sampleRepository.save(sample);
  }

  async findAll(groupId: string, query: any = {}) {
    const {
      search,
      status,
      categoryId,
      type,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const qb = this.sampleRepository.createQueryBuilder('sample')
      .leftJoinAndSelect('sample.category', 'category')
      .where('sample.groupId = :groupId', { groupId });

    if (status && status !== 'ALL') {
      qb.andWhere('sample.status = :status', { status });
    }

    if (categoryId && categoryId !== 'ALL') {
      qb.andWhere('sample.categoryId = :categoryId', { categoryId });
    }

    if (type) {
      qb.andWhere('sample.type = :type', { type });
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(sample.name ILIKE :term OR sample.code ILIKE :term OR sample.description ILIKE :term)', { term });
    }

    const sortCol = `sample.${sortBy}`;
    qb.orderBy(sortCol, sortOrder);

    const take = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));
    const skip = (Math.max(1, parseInt(String(page), 10) || 1) - 1) * take;

    qb.skip(skip).take(take);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page: Math.max(1, parseInt(String(page), 10) || 1),
      pageSize: take,
      hasMore: skip + items.length < total,
    };
  }

  async findOne(groupId: string, id: string): Promise<Sample> {
    const sample = await this.sampleRepository.findOne({
      where: { id, groupId },
      relations: ['category'],
    });

    if (!sample) {
      throw new NotFoundException('Không tìm thấy mẫu này');
    }

    return sample;
  }

  async update(groupId: string, id: string, dto: UpdateSampleDto): Promise<Sample> {
    const sample = await this.findOne(groupId, id);
    if (dto.name !== undefined) sample.name = dto.name.trim();
    if (dto.code !== undefined) sample.code = dto.code ? dto.code.trim() : undefined;
    if (dto.description !== undefined) sample.description = dto.description ? dto.description.trim() : undefined;
    if (dto.type !== undefined) sample.type = dto.type ? dto.type.trim() : undefined;
    if (dto.status !== undefined) sample.status = dto.status;
    if (dto.categoryId !== undefined) {
      sample.categoryId = dto.categoryId && typeof dto.categoryId === 'string' && dto.categoryId.trim() !== ''
        ? dto.categoryId.trim()
        : (null as any);
    }
    if (dto.imageUrl !== undefined) sample.imageUrl = dto.imageUrl ? dto.imageUrl.trim() : undefined;
    if (dto.metadata !== undefined) sample.metadata = dto.metadata;

    return this.sampleRepository.save(sample);
  }

  async remove(groupId: string, id: string): Promise<{ success: boolean }> {
    const sample = await this.findOne(groupId, id);
    await this.sampleRepository.remove(sample);
    return { success: true };
  }

  // Compatibility helper for dashboard
  async applyComputedCurrentValue(_groupId: string, _samples: Sample[]): Promise<void> {
    // No-op for samples
  }
}

// Compatibility export
export { SampleService as AssetService };
