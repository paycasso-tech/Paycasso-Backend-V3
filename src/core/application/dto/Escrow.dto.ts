import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEscrowDto {
    @ApiProperty()
    @IsString()
    freelancer_id: string;

    @ApiProperty()
    @IsString()
    title: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @IsNumber()
    total_amount_usdc: number;


    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    terms?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    deadline?: string;

    @ApiPropertyOptional({ default: 168 })
    @IsOptional()
    @IsNumber()
    auto_release_after_hours?: number;
}

export class FundEscrowDto {
    @ApiProperty()
    @IsNumber()
    amount_usdc: number;

    @ApiProperty()
    @IsString()
    from_wallet: string;
}

export class ConfirmFundingDto {
    @ApiProperty()
    @IsString()
    tx_hash: string;
}

export class CompleteEscrowDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    completion_notes?: string;
}

export class CancelEscrowDto {
    @ApiProperty()
    @IsString()
    reason: string;

    @ApiProperty()
    @IsString()
    initiated_by: string; // 'client' or 'freelancer'
}

export class RejectEscrowDto {
    @ApiProperty()
    @IsString()
    reason: string;
}

export class UploadFileDto {
    @ApiProperty()
    @IsString()
    type: string; // 'contract', 'deliverable', 'revision', 'other'

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;
}

export class ListEscrowsQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    role?: string; // 'all', 'client', 'freelancer'

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsNumber()
    limit?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sort?: string;
}
