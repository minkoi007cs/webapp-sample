import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import dayjs from 'dayjs';
import { CategoryService } from '../category/category.service';
import { UserService } from '../user/user.service';
import { SampleService } from '../sample/sample.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NaturalInputHistory } from './entities/natural-input-history.entity';

@Injectable()
export class NaturalInputService {
  private readonly logger = new Logger(NaturalInputService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private categoryService: CategoryService,
    private userService: UserService,
    private sampleService: SampleService,
    @InjectRepository(NaturalInputHistory)
    private historyRepository: Repository<NaturalInputHistory>,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
    });
  }

  async parseWithUser(message: string, groupId: string, userId: string) {
    if (!this.configService.get('OPENAI_API_KEY')) {
      return { success: false, reason: 'openai_api_key_missing' };
    }

    try {
      const [categories, usersRaw, samplesRaw] = await Promise.all([
        this.categoryService.findAll(groupId),
        this.userService.findAll(groupId),
        this.sampleService.findAll(groupId),
      ]);

      const users = Array.isArray(usersRaw) ? usersRaw : usersRaw.items;
      const samples = Array.isArray(samplesRaw) ? samplesRaw : samplesRaw.items;

      const systemPrompt = `
Bạn là Trợ lý AI nhận diện ngôn ngữ tự nhiên cho ứng dụng quản lý Mẫu (Samples) và Nhóm (Groups).
Ngữ cảnh:
- Danh mục: ${JSON.stringify(categories.map(c => ({ id: c.id, name: c.name })))}
- Thành viên nhóm: ${JSON.stringify(users.map(u => ({ id: u.id, name: u.fullName, email: u.email })))}
- Mẫu hiện có: ${JSON.stringify(samples.map(s => ({ id: s.id, name: s.name, code: s.code })))}
- Ngày hiện tại: ${dayjs().format('YYYY-MM-DD')}

Các ý định hỗ trợ:
- create_sample: Tạo/thêm mẫu mới (name, code, description, categoryId)
- create_event: Tạo lịch hẹn, cuộc họp, sự kiện (title, startDate, location)
- create_note: Ghi chú thông tin chung

Trả về JSON định dạng:
{
  "intent": "create_sample" | "create_event" | "create_note" | "unknown",
  "confidence": 0.0 đến 1.0,
  "data": { ... }
}
`;

      const response = await this.openai.chat.completions.create({
        model: this.configService.get('OPENAI_MODEL', 'gpt-4o-mini'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content);

      await this.historyRepository.save({
        groupId,
        familyId: groupId,
        userId,
        inputMessage: message,
        intent: result.intent,
        confidence: result.confidence,
        resultData: result.data,
      });

      return {
        ...result,
        success: true,
      };
    } catch (err: any) {
      this.logger.error('Natural input error:', err);
      return {
        success: false,
        reason: 'intent_not_detected',
        details: err?.message,
      };
    }
  }

  async getHistory(groupId: string, limit = 20) {
    return this.historyRepository.find({
      where: { groupId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }
}
