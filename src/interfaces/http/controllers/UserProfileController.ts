import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserProfileService } from '../../../core/application/services/UserProfileService';
import { UpdateProfileDto } from '../../../core/application/dto/UpdateProfileDto';
import { SearchUsersDto } from '../../../core/application/dto/SearchUsersDto';
import { SubmitRatingDto } from '../../../core/application/dto/SubmitRatingDto';

@ApiTags('User Profile')
@Controller('api/v1/users')
export class UserProfileController {
  constructor(private readonly profileService: UserProfileService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get authenticated user profile',
    description:
      'Returns full profile details including email, wallet info, and private data',
  })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getMyProfile(@Req() req: any) {
    return this.profileService.getMyProfile(req.user.userId);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Update profile information. Automatically recalculates profile completeness and badges.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Req() req: any, @Body() updateDto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.userId, updateDto);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users',
    description:
      'Advanced search for users with filters for role, trust score, skills, location. Great for finding freelancers.',
  })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchUsers(@Query() searchDto: SearchUsersDto) {
    return this.profileService.searchUsers(searchDto);
  }

  @Get(':user_id')
  @ApiOperation({
    summary: 'Get public user profile',
    description:
      'View any user public profile. Includes trust score, ratings, completed contracts.',
  })
  @ApiParam({ name: 'user_id', description: 'User ID to retrieve' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserProfile(
    @Param('user_id') userId: string,
    @Req() req: any, // Optional auth to check if viewing own profile
  ) {
    const requestingUserId = req.user?.userId;
    return this.profileService.getUserProfile(userId, requestingUserId);
  }

  @Get(':user_id/ratings')
  @ApiOperation({
    summary: 'Get user ratings and reviews',
    description:
      'Paginated list of ratings with detailed breakdown and reviewer information',
  })
  @ApiParam({ name: 'user_id', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Ratings retrieved successfully' })
  async getUserRatings(
    @Param('user_id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.profileService.getUserRatings(
      userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Post('ratings')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a rating for a user',
    description:
      'Rate a user after escrow completion. Can only rate once per escrow. Automatically updates trust score.',
  })
  @ApiResponse({ status: 201, description: 'Rating submitted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Already rated or escrow not completed',
  })
  async submitRating(@Req() req: any, @Body() submitDto: SubmitRatingDto) {
    return this.profileService.submitRating(req.user.userId, submitDto);
  }
}
