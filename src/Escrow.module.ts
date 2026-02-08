import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscrowController } from './controllers/Escrow.controller';
import { EscrowService } from './core/application/services/EscrowService';
import { Escrow } from './core/domain/entities/Escrow.entity';
import { Transaction } from './core/domain/entities/Transaction.entity';
import { User } from './core/domain/entities/User.entity';
import { NotificationModule } from './Notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow, Transaction, User]),
    NotificationModule,
  ],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule { }
