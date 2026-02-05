import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscrowController } from './interfaces/http/controllers/EscrowController';
import { EscrowService } from './core/application/services/EscrowService';
import { BlockchainService } from './core/application/services/BlockchainService';
import { Escrow } from './core/domain/entities/Escrow.entity';
import { Transaction } from './core/domain/entities/Transaction.entity';
import { User } from './core/domain/entities/User.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Escrow, Transaction, User])],
  controllers: [EscrowController],
  providers: [EscrowService, BlockchainService],
  exports: [EscrowService],
})
export class EscrowModule {}
