import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NaturalInputService } from './natural-input.service';
import { NaturalInputController } from './natural-input.controller';
import { MoneyParserService } from './money-parser.service';
import { CategoryModule } from '../category/category.module';
import { UserModule } from '../user/user.module';
import { AssetModule } from '../asset/asset.module';
import { NaturalInputHistory } from './entities/natural-input-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([NaturalInputHistory]),
    CategoryModule, 
    UserModule, 
    AssetModule
  ],
  providers: [NaturalInputService, MoneyParserService],
  controllers: [NaturalInputController],
  exports: [NaturalInputService],
})
export class NaturalInputModule {}
