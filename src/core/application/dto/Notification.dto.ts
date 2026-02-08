import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListNotificationsQueryDto {
    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    unread_only?: boolean;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsNumber()
    limit?: number;
}

export class NotificationPreferencesDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    escrow_created?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    escrow_funded?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    payment_released?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    dispute_raised?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    dispute_resolved?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    rating_received?: boolean;
}

export class UpdateNotificationPreferencesDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    email_enabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    push_enabled?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    preferences?: NotificationPreferencesDto;
}
