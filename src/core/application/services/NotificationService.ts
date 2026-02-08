import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    Notification,
    NotificationPreference,
    NotificationType,
} from '../../domain/entities/Notification.entity';
import { UpdateNotificationPreferencesDto } from '../dto/Notification.dto';
import { EmailService } from './EmailService';
import { User } from '../../domain/entities/User.entity';

interface CreateNotificationData {
    userId: string;
    type: string;
    title: string;
    message: string;
    escrowId?: string;
    disputeId?: string;
    amountUsdc?: number;
}

@Injectable()
export class NotificationService {
    constructor(
        @InjectRepository(Notification)
        private notificationRepository: Repository<Notification>,
        @InjectRepository(NotificationPreference)
        private preferenceRepository: Repository<NotificationPreference>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private emailService: EmailService,
    ) { }

    async createNotification(data: CreateNotificationData): Promise<Notification | null> {
        // Check user preferences
        const preference = await this.getOrCreatePreference(data.userId);

        // Map type string to NotificationType enum
        const typeMapping: Record<string, NotificationType> = {
            'ESCROW_CREATED': NotificationType.ESCROW_CREATED,
            'ESCROW_ACCEPTED': NotificationType.ESCROW_ACCEPTED,
            'ESCROW_FUNDED': NotificationType.ESCROW_FUNDED,
            'PAYMENT_RELEASED': NotificationType.PAYMENT_RELEASED,
            'DISPUTE_RAISED': NotificationType.DISPUTE_RAISED,
            'DISPUTE_COUNTER_STAKED': NotificationType.DISPUTE_RAISED, // Map to closest match
            'DISPUTE_RESOLVED': NotificationType.DISPUTE_RESOLVED,
            'RATING_RECEIVED': NotificationType.RATING_RECEIVED,
            'ESCROW_CANCELLED': NotificationType.ESCROW_CANCELLED,
        };

        const notificationType = typeMapping[data.type] || NotificationType.ESCROW_CREATED;

        // Check if this notification type is enabled for the user
        const typePreferenceMap: Record<string, keyof NotificationPreference> = {
            'ESCROW_CREATED': 'escrowCreated',
            'ESCROW_FUNDED': 'escrowFunded',
            'PAYMENT_RELEASED': 'paymentReleased',
            'DISPUTE_RAISED': 'disputeRaised',
            'DISPUTE_RESOLVED': 'disputeResolved',
            'RATING_RECEIVED': 'ratingReceived',
        };

        const preferenceKey = typePreferenceMap[data.type];
        if (preferenceKey && !preference[preferenceKey]) {
            return null; // User has disabled this notification type
        }

        const notification = this.notificationRepository.create({
            userId: data.userId,
            type: notificationType,
            title: data.title,
            message: data.message,
            escrowId: data.escrowId,
            disputeId: data.disputeId,
            amountUsdc: data.amountUsdc,
        });

        const savedNotification = await this.notificationRepository.save(notification);

        if (preference.emailEnabled) {
            const user = await this.userRepository.findOne({ where: { id: data.userId } });
            if (user && user.email) {
                await this.emailService.sendNotificationEmail(user.email, data.title, data.message);
            }
        }

        // Push notifications would be similar if we had a push provider
        // if (preference.pushEnabled) { ... }

        return savedNotification;
    }

    async getNotifications(
        userId: string,
        filters: { unread_only?: boolean; page?: number; limit?: number },
    ): Promise<{ notifications: Notification[]; unread_count: number; total: number }> {
        const { unread_only = false, page = 1, limit = 20 } = filters;

        const queryBuilder = this.notificationRepository
            .createQueryBuilder('notification')
            .where('notification.userId = :userId', { userId });

        if (unread_only) {
            queryBuilder.andWhere('notification.read = :read', { read: false });
        }

        const [notifications, total] = await queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .orderBy('notification.createdAt', 'DESC')
            .getManyAndCount();

        const unread_count = await this.notificationRepository.count({
            where: { userId, read: false },
        });

        return { notifications, unread_count, total };
    }

    async markAsRead(userId: string, notificationId: string): Promise<Notification> {
        const notification = await this.notificationRepository.findOne({
            where: { id: notificationId, userId },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        notification.read = true;
        notification.readAt = new Date();

        return await this.notificationRepository.save(notification);
    }

    async markAllAsRead(userId: string): Promise<{ updated: number }> {
        const result = await this.notificationRepository.update(
            { userId, read: false },
            { read: true, readAt: new Date() },
        );

        return { updated: result.affected || 0 };
    }

    async getPreferences(userId: string): Promise<NotificationPreference> {
        return await this.getOrCreatePreference(userId);
    }

    async updatePreferences(
        userId: string,
        updateDto: UpdateNotificationPreferencesDto,
    ): Promise<NotificationPreference> {
        let preference = await this.preferenceRepository.findOne({
            where: { userId },
        });

        if (!preference) {
            preference = this.preferenceRepository.create({ userId });
        }

        // Update preferences
        if (updateDto.email_enabled !== undefined) {
            preference.emailEnabled = updateDto.email_enabled;
        }
        if (updateDto.push_enabled !== undefined) {
            preference.pushEnabled = updateDto.push_enabled;
        }
        if (updateDto.preferences) {
            Object.assign(preference, updateDto.preferences);
        }

        preference.updatedAt = new Date();

        return await this.preferenceRepository.save(preference);
    }

    private async getOrCreatePreference(userId: string): Promise<NotificationPreference> {
        let preference = await this.preferenceRepository.findOne({
            where: { userId },
        });

        if (!preference) {
            preference = this.preferenceRepository.create({
                userId,
                emailEnabled: true,
                pushEnabled: true,
                escrowCreated: true,
                escrowFunded: true,
                paymentReleased: true,
                disputeRaised: true,
                disputeResolved: true,
                ratingReceived: true,
            });
            preference = await this.preferenceRepository.save(preference);
        }

        return preference;
    }
}
