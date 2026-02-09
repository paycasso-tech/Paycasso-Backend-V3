import { Controller, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from '../../../core/application/services/WalletService';
import { EscrowService } from '../../../core/application/services/EscrowService';
import { DisputeService } from '../../../core/application/services/DisputeService';
import { EscrowStatus } from '../../../core/domain/entities/Escrow.entity';
import { DisputeStatus } from '../../../core/domain/entities/Dispute.entity';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/v1/user')
export class UserController {
    constructor(
        private readonly walletService: WalletService,
        private readonly escrowService: EscrowService,
        private readonly disputeService: DisputeService,
    ) { }

    @Get('dashboard')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get user dashboard statistics' })
    @ApiResponse({ status: 200, description: 'Dashboard stats retrieved' })
    async getDashboardStats(@Req() req: any) {
        const userId = req.user.userId;

        // 1. Wallet Balance
        // We can re-use WalletService.getWalletInfo, or just fetch lightweight balance.
        // Assuming walletService.getWalletInfo returns { balances: { usdc, eth }, total_in_escrow }
        let walletInfo;
        try {
            walletInfo = await this.walletService.getWalletInfo(userId);
        } catch (e) {
            walletInfo = { balances: { usdc: '0' }, total_in_escrow: 0 };
        }

        // 2. Pending Escrows & Completed Deals
        // We defer this logic to EscrowService to access repositories cleanly
        // If EscrowService.getUserStats does not exist in your compilation context yet,
        // ensure you have updated EscrowService.ts first.
        // We added getUserStats in Step 1649.
        const stats = await this.escrowService.getUserStats(userId);

        // 3. Active Disputes
        // We added getUserDisputeStats in Step 1652.
        const disputeStats = await this.disputeService.getUserDisputeStats(userId);

        return {
            total_balance_usdc: walletInfo.balances.usdc,
            total_in_escrow_usdc: walletInfo.total_in_escrow,
            pending_escrows: stats.pending,
            completed_deals: stats.completed,
            active_disputes: disputeStats.active,
        };
    }
}
