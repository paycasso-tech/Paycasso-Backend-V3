import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './controllers/Wallet.controller';
import { WalletService } from './core/application/services/WalletService';
import { BlockchainService } from './core/application/services/BlockchainService';
import { Wallet } from './core/domain/entities/Wallet.entity';
import { User } from './core/domain/entities/User.entity';
import { Transaction } from './core/domain/entities/Transaction.entity';

import { Escrow } from './core/domain/entities/Escrow.entity';

import { Dispute } from './core/domain/entities/Dispute.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, User, Transaction, Escrow, Dispute])],
  controllers: [WalletController],
  providers: [WalletService, BlockchainService],
  exports: [WalletService],
})
export class WalletModule { }
