import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EscrowService } from '../../../core/application/services/EscrowService';

@ApiTags('Escrows')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/v1/escrows')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new escrow agreement' })
  async createEscrow(@Req() req: any, @Body() body: any) {
    return this.escrowService.createEscrow(req.user.userId, body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get escrow details' })
  async getEscrow(@Param('id') id: string) {
    return this.escrowService.getEscrow(id);
  }

  @Post(':id/deposit')
  @ApiOperation({ summary: 'Register a deposit transaction' })
  async registerDeposit(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.escrowService.confirmFunding(req.user.userId, id, body.tx_hash);
  }
}
