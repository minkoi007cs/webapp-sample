import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
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
    const sample = this.sampleRepository.create({
      ...dto,
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

    if (status) {
      qb.andWhere('sample.status = :status', { status });
    }

    if (categoryId) {
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
    Object.assign(sample, dto);
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
