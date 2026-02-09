import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WalletLoginDto {
    @ApiProperty({ example: '0x123...' })
    @IsString()
    wallet_address: string;

    @ApiProperty({ example: '0xabc...' })
    @IsString()
    signature: string;

    @ApiProperty({ example: 'Sign this message to login...' })
    @IsString()
    message: string;
}
