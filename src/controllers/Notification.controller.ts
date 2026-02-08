import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from '../core/application/services/NotificationService';
import {
    ListNotificationsQueryDto,
    UpdateNotificationPreferencesDto,
} from '../core/application/dto/Notification.dto';
import { JwtAuthGuard } from '../core/application/strategies/jwt.strategy';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get()
    @ApiOperation({ summary: 'Get notifications' })
    @ApiResponse({ status: 200, description: 'Notifications retrieved' })
    async getNotifications(@Request() req: any, @Query() query: ListNotificationsQueryDto) {
        return this.notificationService.getNotifications(req.user.userId, query);
    }

    @Patch(':notification_id/read')
    @ApiOperation({ summary: 'Mark notification as read' })
    @ApiResponse({ status: 200, description: 'Notification marked as read' })
    async markAsRead(@Request() req: any, @Param('notification_id') notificationId: string) {
        return this.notificationService.markAsRead(req.user.userId, notificationId);
    }

    @Post('mark-all-read')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    @ApiResponse({ status: 200, description: 'All notifications marked as read' })
    async markAllAsRead(@Request() req: any) {
        return this.notificationService.markAllAsRead(req.user.userId);
    }

    @Get('preferences')
    @ApiOperation({ summary: 'Get notification preferences' })
    @ApiResponse({ status: 200, description: 'Preferences retrieved' })
    async getPreferences(@Request() req: any) {
        return this.notificationService.getPreferences(req.user.userId);
    }

    @Patch('preferences')
    @ApiOperation({ summary: 'Update notification preferences' })
    @ApiResponse({ status: 200, description: 'Preferences updated' })
    async updatePreferences(
        @Request() req: any,
        @Body() updateDto: UpdateNotificationPreferencesDto,
    ) {
        return this.notificationService.updatePreferences(req.user.userId, updateDto);
    }
}
