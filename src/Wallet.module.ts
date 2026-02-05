import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './interfaces/http/controllers/WalletController';
import { WalletService } from './core/application/services/WalletService';
import { Wallet } from './core/domain/entities/Wallet.entity';
import { User } from './core/domain/entities/User.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, User])],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
