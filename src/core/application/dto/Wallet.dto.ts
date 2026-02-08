import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectWalletDto {
    @ApiProperty()
    @IsString()
    wallet_address: string;

    @ApiProperty()
    @IsString()
    signature: string;

    @ApiProperty()
    @IsString()
    message: string;

    @ApiProperty()
    @IsString()
    @ApiProperty()
    @IsString()
    provider: string; // 'coinbase'

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    cdp_wallet_id?: string;
}

export class ListTransactionsQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    type?: string; // 'all', 'deposit', 'withdrawal', 'escrow_fund', 'escrow_release'

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string; // 'pending', 'completed', 'failed'

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @IsNumber()
    page?: number;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @IsNumber()
    limit?: number;
}
