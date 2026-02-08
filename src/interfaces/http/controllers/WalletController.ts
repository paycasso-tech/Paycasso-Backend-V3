import { Controller, Post, Get, Body, UseGuards, Req, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from '../../../core/application/services/WalletService';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/v1/wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new embedded wallet' })
  async register(@Req() req: any, @Body() body: any) {
    // Body should be DTO, using any for speed in this step
    return this.walletService.connectWallet(
      req.user.userId,
      {
        wallet_address: body.wallet_address,
        signature: body.signature || '',
        message: body.message || '',
        provider: body.metadata?.provider,
        network: body.network,
      } as any // Cast because ConnectWalletDto is expected
    );
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user wallets' })
  async getMyWallets(@Req() req: any) {
    return this.walletService.getWalletInfo(req.user.userId);
  }

  @Post('verify-ownership')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify wallet ownership signature' })
  async verifyOwnership(@Req() req: any, @Body() body: any) {
    return this.walletService.verifySignature(
      body.wallet_address,
      body.signature,
      body.message
    );
  }
}
