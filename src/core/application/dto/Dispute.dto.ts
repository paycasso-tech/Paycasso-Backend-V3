import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { DisputeReason, DesiredOutcome, ResolutionType } from '../../domain/entities/Dispute.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RaiseDisputeDto {
    @ApiProperty()
    @IsString()
    escrow_id: string;

    @ApiProperty({ enum: DisputeReason })
    @IsEnum(DisputeReason)
    reason: DisputeReason;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty({ enum: DesiredOutcome })
    @IsEnum(DesiredOutcome)
    desired_outcome: DesiredOutcome;
}

export class CounterStakeDisputeDto {
    @ApiProperty()
    @IsString()
    response: string;
}

export class SubmitEvidenceDto {
    @ApiProperty()
    @IsString()
    type: string; // 'document', 'screenshot', 'chat_log', 'contract', 'other'

    @ApiProperty()
    @IsString()
    description: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    file_url?: string;
}

export class VoteOnDisputeDto {
    @ApiProperty()
    @IsString()
    vote: string; // 'client' or 'freelancer'

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reasoning?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    suggested_split_percentage?: number;
}

export class ResolveDisputeDto {
    @ApiProperty({ enum: ResolutionType })
    @IsEnum(ResolutionType)
    resolution: ResolutionType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    client_percentage?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsNumber()
    freelancer_percentage?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    resolution_notes?: string;
}

export class WithdrawDisputeDto {
    @ApiProperty()
    @IsString()
    reason: string;
}

export class ListDisputesQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsNumber()
    limit?: number;
}
