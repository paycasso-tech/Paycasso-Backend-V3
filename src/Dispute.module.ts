import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeController } from './controllers/Dispute.controller';
import { DisputeService } from './core/application/services/DisputeService';
import {
    Dispute,
    DisputeEvidence,
    DisputeVote,
} from './core/domain/entities/Dispute.entity';
import { Escrow } from './core/domain/entities/Escrow.entity';
import { User } from './core/domain/entities/User.entity';
import { NotificationModule } from './Notification.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Dispute, DisputeEvidence, DisputeVote, Escrow, User]),
        NotificationModule,
    ],
    controllers: [DisputeController],
    providers: [DisputeService],
    exports: [DisputeService],
})
export class DisputeModule { }
