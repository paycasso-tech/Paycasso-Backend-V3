import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './controllers/Notification.controller';
import { NotificationService } from './core/application/services/NotificationService';
import {
    Notification,
    NotificationPreference,
} from './core/domain/entities/Notification.entity';
import { User } from './core/domain/entities/User.entity';
import { EmailService } from './core/application/services/EmailService';

@Module({
    imports: [
        TypeOrmModule.forFeature([Notification, NotificationPreference, User]),
    ],
    controllers: [NotificationController],
    providers: [NotificationService, EmailService],
    exports: [NotificationService],
})
export class NotificationModule { }
