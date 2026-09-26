import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Document, DocumentStatus } from '../../common/entities/document.entity';
import { FileService } from '../file/file.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SynthesizeDocumentDto } from './dto/synthesize-document.dto';

const DEFAULT_CATEGORIES = [
  'Hồ sơ Mẫu & Thiết kế',
  'Giấy tờ & Hợp đồng',
  'Báo cáo & Tài liệu kỹ thuật',
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
    groupId: string,
    userId: string,
  ): Promise<Document> {
    if (!file) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    const fileUrl = await this.fileService.uploadFile(file, `group-docs/${groupId}`);
    const isImage = file.mimetype.startsWith('image/');
    const thumbnailUrl = isImage ? fileUrl : undefined;

    const document = this.documentRepository.create({
      groupId,
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
      status: DocumentStatus.READY,
    });

    return this.documentRepository.save(document);
  }

  async findAll(groupId: string, queryDto: QueryDocumentDto) {
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
      .where('doc.groupId = :groupId', { groupId })
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

    const allDocs = await this.documentRepository.find({
      where: { groupId },
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

  async findOne(id: string, groupId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { id, groupId },
      relations: ['uploadedByUser'],
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu này');
    }

    return document;
  }

  async update(id: string, groupId: string, dto: UpdateDocumentDto): Promise<Document> {
    const document = await this.findOne(id, groupId);
    if (dto.title !== undefined) document.title = dto.title;
    if (dto.category !== undefined) document.category = dto.category;
    if (dto.tags !== undefined) document.tags = dto.tags;
    if (dto.summary !== undefined) document.summary = dto.summary;
    if (dto.extractedContent !== undefined) document.extractedContent = dto.extractedContent;
    if (dto.structuredData !== undefined) document.structuredData = dto.structuredData;
    if (dto.userNote !== undefined) document.userNote = dto.userNote;

    return this.documentRepository.save(document);
  }

  async remove(id: string, groupId: string): Promise<{ success: boolean }> {
    const document = await this.findOne(id, groupId);
    try {
      await this.fileService.deleteFile(document.fileUrl);
    } catch (err) {
      this.logger.warn('Không thể xóa file vật lý:', err);
    }
    await this.documentRepository.remove(document);
    return { success: true };
  }

  async reanalyze(id: string, groupId: string): Promise<Document> {
    return this.findOne(id, groupId);
  }

  async synthesizeTopic(groupId: string, dto: SynthesizeDocumentDto) {
    const documents = await this.documentRepository.find({
      where: { groupId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      query: dto.query,
      synthesis: 'Tổng hợp tài liệu hoàn tất cho nhóm.',
      sourceDocuments: documents,
    };
  }
}
