import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EscrowService } from '../core/application/services/EscrowService';
import {
    CreateEscrowDto,
    FundEscrowDto,
    ConfirmFundingDto,
    CompleteEscrowDto,
    CancelEscrowDto,
    RejectEscrowDto,
    ListEscrowsQueryDto,
    UploadFileDto,
} from '../core/application/dto/Escrow.dto';
import { JwtAuthGuard } from '../core/application/strategies/jwt.strategy';

@ApiTags('Escrows')
@ApiBearerAuth()
@Controller('api/v1/escrows')
@UseGuards(JwtAuthGuard)
export class EscrowController {
    constructor(private readonly escrowService: EscrowService) { }

    @Post()
    @ApiOperation({ summary: 'Create escrow contract' })
    @ApiResponse({ status: 201, description: 'Escrow created successfully' })
    async createEscrow(@Request() req: any, @Body() createDto: CreateEscrowDto) {
        return this.escrowService.createEscrow(req.user.userId, createDto);
    }

    @Post(':escrow_id/accept')
    @ApiOperation({ summary: 'Accept escrow (Freelancer)' })
    @ApiResponse({ status: 200, description: 'Escrow accepted' })
    async acceptEscrow(@Request() req: any, @Param('escrow_id') escrowId: string) {
        return this.escrowService.acceptEscrow(req.user.userId, escrowId);
    }

    @Post(':escrow_id/reject')
    @ApiOperation({ summary: 'Reject escrow (Freelancer)' })
    @ApiResponse({ status: 200, description: 'Escrow rejected' })
    async rejectEscrow(
        @Request() req: any,
        @Param('escrow_id') escrowId: string,
        @Body() rejectDto: RejectEscrowDto,
    ) {
        return this.escrowService.rejectEscrow(req.user.userId, escrowId, rejectDto);
    }

    @Post(':escrow_id/fund')
    @ApiOperation({ summary: 'Fund escrow (Client)' })
    @ApiResponse({ status: 200, description: 'Funding transaction prepared' })
    async fundEscrow(
        @Request() req: any,
        @Param('escrow_id') escrowId: string,
        @Body() fundDto: FundEscrowDto,
    ) {
        return this.escrowService.fundEscrow(req.user.userId, escrowId, fundDto);
    }

    @Post(':escrow_id/confirm-funding')
    @ApiOperation({ summary: 'Confirm funding transaction' })
    @ApiResponse({ status: 200, description: 'Funding confirmed' })
    async confirmFunding(
        @Request() req: any,
        @Param('escrow_id') escrowId: string,
        @Body() confirmDto: ConfirmFundingDto,
    ) {
        return this.escrowService.confirmFunding(req.user.userId, escrowId, confirmDto.tx_hash);
    }

    @Get(':escrow_id')
    @ApiOperation({ summary: 'Get escrow details' })
    @ApiResponse({ status: 200, description: 'Escrow details retrieved' })
    async getEscrow(@Param('escrow_id') escrowId: string) {
        return this.escrowService.getEscrow(escrowId);
    }

    @Get()
    @ApiOperation({ summary: 'List my escrows' })
    @ApiResponse({ status: 200, description: 'Escrows retrieved' })
    async listEscrows(@Request() req: any, @Query() query: ListEscrowsQueryDto) {
        return this.escrowService.listEscrows(req.user.userId, query);
    }

    @Post(':escrow_id/complete')
    @ApiOperation({ summary: 'Mark escrow complete (Full payment)' })
    @ApiResponse({ status: 200, description: 'Escrow marked as complete' })
    async completeEscrow(@Request() req: any, @Param('escrow_id') escrowId: string) {
        return this.escrowService.completeEscrow(req.user.userId, escrowId);
    }

    @Post(':escrow_id/release')
    @ApiOperation({ summary: 'Release full payment (Client)' })
    @ApiResponse({ status: 200, description: 'Payment released' })
    async releasePayment(@Request() req: any, @Param('escrow_id') escrowId: string) {
        return this.escrowService.releaseFullPayment(req.user.userId, escrowId);
    }

    @Post(':escrow_id/cancel')
    @ApiOperation({ summary: 'Cancel escrow' })
    @ApiResponse({ status: 200, description: 'Escrow cancelled' })
    async cancelEscrow(
        @Request() req: any,
        @Param('escrow_id') escrowId: string,
        @Body() cancelDto: CancelEscrowDto,
    ) {
        return this.escrowService.cancelEscrow(req.user.userId, escrowId, cancelDto);
    }

    @Post(':escrow_id/files')
    @ApiOperation({ summary: 'Upload file to escrow' })
    @ApiResponse({ status: 201, description: 'File uploaded' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @Request() req: any,
        @Param('escrow_id') escrowId: string,
        @Body() uploadDto: UploadFileDto,
        @UploadedFile() file: any,
    ) {
        if (!file) {
            return { success: false, error: 'No file uploaded' };
        }

        // Create escrow-specific upload directory
        const uploadDir = path.join(process.cwd(), 'uploads', escrowId);
        await fs.mkdir(uploadDir, { recursive: true });

        const fileName = `${Date.now()}-${file.originalname}`;
        const filePath = path.join(uploadDir, fileName);
        await fs.writeFile(filePath, file.buffer);

        return {
            success: true,
            file: {
                name: file.originalname,
                path: `/uploads/${escrowId}/${fileName}`,
                size: file.size,
            },
            type: uploadDto.type,
            description: uploadDto.description,
        };
    }

    @Get(':escrow_id/files')
    @ApiOperation({ summary: 'Get escrow files' })
    @ApiResponse({ status: 200, description: 'Files retrieved' })
    async getFiles(@Param('escrow_id') escrowId: string) {
        const uploadDir = path.join(process.cwd(), 'uploads', escrowId);

        try {
            const files = await fs.readdir(uploadDir);
            return {
                files: files.map(f => ({ name: f, url: `/uploads/${escrowId}/${f}` })),
            };
        } catch (e) {
            return { files: [] };
        }
    }
}
