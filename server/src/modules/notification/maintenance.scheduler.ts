import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Asset, AssetStatus } from '../../common/entities/asset.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class MaintenanceScheduler {
  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleWarrantyCheck() {
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    const expiringAssets = await this.assetRepository.find({
      where: {
        warrantyExpiredAt: LessThanOrEqual(next7Days),
        status: AssetStatus.ACTIVE,
      },
    });

    for (const asset of expiringAssets) {
      await this.notificationService.create(
        asset.familyId,
        asset.assignedToUserId || asset.createdBy,
        'Bảo hành sắp hết hạn',
        `Tài sản "${asset.name}" sẽ hết hạn bảo hành vào ngày ${asset.warrantyExpiredAt.toLocaleDateString()}`,
        { assetId: asset.id }
      );
    }
  }
}
