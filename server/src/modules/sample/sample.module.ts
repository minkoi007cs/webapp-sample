import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SampleService } from './sample.service';
import { SampleController } from './sample.controller';
import { Sample } from '../../common/entities/sample.entity';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sample]),
    PermissionModule,
  ],
  controllers: [SampleController],
  providers: [SampleService],
  exports: [SampleService],
})
export class SampleModule {}

// Compatibility export
export { SampleModule as AssetModule };
