import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class FileService {
  private supabase: SupabaseClient | null = null;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('SUPABASE_STORAGE_BUCKET') || 'family-mgmt-assets';
  }

  // Tạo client Supabase khi thực sự cần dùng (không phải lúc app khởi động) —
  // để thiếu biến môi trường chỉ làm hỏng chính tính năng upload, không sập toàn bộ app.
  private getClient(): SupabaseClient {
    if (!this.supabase) {
      const url = this.configService.get<string>('SUPABASE_URL') || this.configService.get<string>('VITE_SUPABASE_URL');
      const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('SUPABASE_ANON_KEY') || this.configService.get<string>('VITE_SUPABASE_ANON_KEY');
      if (!url || !serviceRoleKey) {
        throw new InternalServerErrorException('Chưa cấu hình SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY cho tính năng upload file');
      }
      this.supabase = createClient(url, serviceRoleKey);
    }
    return this.supabase;
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<string> {
    const supabase = this.getClient();
    const fileName = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;

    const { error } = await supabase.storage
      .from(this.bucketName)
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) {
      throw new InternalServerErrorException('Error uploading file to Supabase Storage');
    }

    const { data } = supabase.storage.from(this.bucketName).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const supabase = this.getClient();
      const marker = `/object/public/${this.bucketName}/`;
      const idx = fileUrl.indexOf(marker);
      if (idx === -1) return;
      const fileName = fileUrl.slice(idx + marker.length);
      await supabase.storage.from(this.bucketName).remove([fileName]);
    } catch (error) {
      console.error('Error deleting file from Supabase Storage:', error);
    }
  }
}
