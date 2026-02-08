import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainService } from './core/application/services/BlockchainService';
import { BlockchainWorkerService } from './core/application/services/BlockchainWorkerService';
import { Escrow } from './core/domain/entities/Escrow.entity';
import { Dispute } from './core/domain/entities/Dispute.entity';
import { User } from './core/domain/entities/User.entity';
import { NotificationModule } from './Notification.module';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([Escrow, Dispute, User]),
        NotificationModule
    ],
    providers: [BlockchainService, BlockchainWorkerService],
    exports: [BlockchainService, BlockchainWorkerService],
})
export class BlockchainModule { }
