import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../../common/entities/document.entity';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { FileModule } from '../file/file.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    FileModule,
    PermissionModule,
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
