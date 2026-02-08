import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from '../core/application/services/WalletService';
import {
    ConnectWalletDto,
    ListTransactionsQueryDto,
} from '../core/application/dto/Wallet.dto';
import { JwtAuthGuard } from '../core/application/strategies/jwt.strategy';

@ApiTags('Wallet Management')
@ApiBearerAuth()
@Controller('api/v1/wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @Post('connect')
    @ApiOperation({ summary: 'Connect Coinbase wallet' })
    @ApiResponse({ status: 200, description: 'Wallet connected successfully' })
    async connectWallet(@Request() req: any, @Body() connectDto: ConnectWalletDto) {
        return this.walletService.connectWallet(req.user.userId, connectDto);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get wallet info and balances' })
    @ApiResponse({ status: 200, description: 'Wallet info retrieved' })
    async getWalletInfo(@Request() req: any) {
        return this.walletService.getWalletInfo(req.user.userId);
    }

    @Delete('disconnect')
    @ApiOperation({ summary: 'Disconnect wallet' })
    @ApiResponse({ status: 200, description: 'Wallet disconnected' })
    async disconnectWallet(@Request() req: any) {
        return this.walletService.disconnectWallet(req.user.userId);
    }

    @Get('transactions')
    @ApiOperation({ summary: 'Get transaction history' })
    @ApiResponse({ status: 200, description: 'Transactions retrieved' })
    async getTransactions(@Request() req: any, @Query() query: ListTransactionsQueryDto) {
        return this.walletService.getTransactionHistory(req.user.userId, query);
    }

    @Get('transactions/:tx_hash/verify')
    @ApiOperation({ summary: 'Verify transaction on blockchain' })
    @ApiResponse({ status: 200, description: 'Transaction verified' })
    async verifyTransaction(@Param('tx_hash') txHash: string) {
        return this.walletService.verifyTransaction(txHash);
    }
}
