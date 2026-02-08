import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DisputeService } from '../core/application/services/DisputeService';
import {
    RaiseDisputeDto,
    CounterStakeDisputeDto,
    VoteOnDisputeDto,
    ResolveDisputeDto,
    SubmitEvidenceDto,
    WithdrawDisputeDto,
    ListDisputesQueryDto,
} from '../core/application/dto/Dispute.dto';
import { JwtAuthGuard } from '../core/application/strategies/jwt.strategy';

@ApiTags('Disputes')
@ApiBearerAuth()
@Controller('api/v1/disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
    constructor(private readonly disputeService: DisputeService) { }

    @Post()
    @ApiOperation({ summary: 'Raise dispute on escrow' })
    @ApiResponse({ status: 201, description: 'Dispute created successfully' })
    async raiseDispute(@Request() req: any, @Body() raiseDisputeDto: RaiseDisputeDto) {
        return this.disputeService.raiseDispute(req.user.userId, raiseDisputeDto);
    }

    @Post(':dispute_id/counter-stake')
    @ApiOperation({ summary: 'Counter-stake dispute' })
    @ApiResponse({ status: 200, description: 'Counter-stake successful' })
    async counterStake(
        @Request() req: any,
        @Param('dispute_id') disputeId: string,
        @Body() counterStakeDto: CounterStakeDisputeDto,
    ) {
        return this.disputeService.counterStake(req.user.userId, disputeId, counterStakeDto);
    }

    @Get(':dispute_id')
    @ApiOperation({ summary: 'Get dispute details' })
    @ApiResponse({ status: 200, description: 'Dispute details retrieved' })
    async getDispute(@Param('dispute_id') disputeId: string) {
        return this.disputeService.getDispute(disputeId);
    }

    @Post(':dispute_id/evidence')
    @ApiOperation({ summary: 'Submit evidence for dispute' })
    @ApiResponse({ status: 201, description: 'Evidence submitted' })
    @UseInterceptors(FileInterceptor('file'))
    async submitEvidence(
        @Request() req: any,
        @Param('dispute_id') disputeId: string,
        @Body() evidenceDto: SubmitEvidenceDto,
        @UploadedFile() file: any,
    ) {
        const fileUrl = file ? `/uploads/${file.filename}` : undefined;
        return this.disputeService.submitEvidence(req.user.userId, disputeId, evidenceDto, fileUrl);
    }

    @Get(':dispute_id/evidence')
    @ApiOperation({ summary: 'Get all evidence for dispute' })
    @ApiResponse({ status: 200, description: 'Evidence retrieved' })
    async getEvidence(@Param('dispute_id') disputeId: string) {
        const dispute = await this.disputeService.getDispute(disputeId);
        return { evidence: dispute.evidence };
    }

    @Post(':dispute_id/vote')
    @ApiOperation({ summary: 'DAO vote on dispute' })
    @ApiResponse({ status: 201, description: 'Vote recorded' })
    async voteOnDispute(
        @Request() req: any,
        @Param('dispute_id') disputeId: string,
        @Body() voteDto: VoteOnDisputeDto,
    ) {
        return this.disputeService.voteOnDispute(req.user.userId, disputeId, voteDto);
    }

    @Get(':dispute_id/voting')
    @ApiOperation({ summary: 'Get DAO voting status' })
    @ApiResponse({ status: 200, description: 'Voting status retrieved' })
    async getVotingStatus(@Param('dispute_id') disputeId: string) {
        const dispute = await this.disputeService.getDispute(disputeId);

        // Calculate average suggested split
        const votesWithSplit = dispute.votes.filter(v => v.suggestedSplitPercentage !== null);
        const avgSplit = votesWithSplit.length > 0
            ? votesWithSplit.reduce((sum, v) => sum + v.suggestedSplitPercentage, 0) / votesWithSplit.length
            : null;

        return {
            dispute_id: dispute.id,
            status: dispute.status,
            voting_starts_at: dispute.votingStartsAt,
            voting_ends_at: dispute.votingEndsAt,
            votes_for_client: dispute.votesForClient,
            votes_for_freelancer: dispute.votesForFreelancer,
            total_votes: dispute.totalVotes,
            required_votes: dispute.requiredVotes,
            vote_breakdown: dispute.votes,
            average_suggested_split: avgSplit,
        };
    }

    @Post(':dispute_id/resolve')
    @ApiOperation({ summary: 'Resolve dispute (Admin/Auto)' })
    @ApiResponse({ status: 200, description: 'Dispute resolved' })
    async resolveDispute(
        @Param('dispute_id') disputeId: string,
        @Body() resolveDto: ResolveDisputeDto,
    ) {
        return this.disputeService.resolveDispute(disputeId, resolveDto);
    }

    @Get()
    @ApiOperation({ summary: 'List my disputes' })
    @ApiResponse({ status: 200, description: 'Disputes retrieved' })
    async listDisputes(@Request() req: any, @Query() query: ListDisputesQueryDto) {
        return this.disputeService.listDisputes(req.user.userId, query);
    }

    @Post(':dispute_id/withdraw')
    @ApiOperation({ summary: 'Withdraw from dispute' })
    @ApiResponse({ status: 200, description: 'Dispute withdrawn' })
    async withdrawDispute(
        @Request() req: any,
        @Param('dispute_id') disputeId: string,
        @Body() withdrawDto: WithdrawDisputeDto,
    ) {
        return this.disputeService.withdrawDispute(req.user.userId, disputeId, withdrawDto.reason);
    }

    @Post(':dispute_id/accept-verdict')
    @ApiOperation({ summary: 'Accept AI verdict (both must accept)' })
    async acceptVerdict(@Request() req: any, @Param('dispute_id') disputeId: string) {
        return this.disputeService.acceptVerdict(req.user.userId, disputeId);
    }

    @Post(':dispute_id/reject-verdict')
    @ApiOperation({ summary: 'Reject AI verdict (escalates to DAO)' })
    async rejectVerdict(@Request() req: any, @Param('dispute_id') disputeId: string) {
        return this.disputeService.rejectVerdict(req.user.userId, disputeId);
    }

    // --- Admin DAO Actions ---

    @Post('admin/register-voter')
    @ApiOperation({ summary: 'Register a new DAO voter (Admin only)' })
    async registerVoter(@Body('address') address: string) {
        return this.disputeService.registerVoter(address);
    }

    @Post('admin/adjust-karma')
    @ApiOperation({ summary: 'Adjust voter karma (Admin only)' })
    async adjustKarma(@Body('address') address: string, @Body('karma') karma: number) {
        return this.disputeService.adjustVoterKarma(address, karma);
    }

    @Get('admin/voting-session/:job_id')
    @ApiOperation({ summary: 'Get session data from chain (Admin only)' })
    async getSession(@Param('job_id') jobId: number) {
        return this.disputeService.getOnChainSession(jobId);
    }
}
