import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual, In } from 'typeorm';
import { User } from '../../domain/entities/User.entity';
import { Rating } from '../../domain/entities/Rating.entity';
import { UpdateProfileDto } from '../dto/UpdateProfileDto';
import { SearchUsersDto } from '../dto/SearchUsersDto';
import { SubmitRatingDto } from '../dto/SubmitRatingDto';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,
  ) {}

  /**
   * Get authenticated user's own profile (full details)
   */
  async getMyProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallets'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate profile completeness
    const completeness = this.calculateProfileCompleteness(user);
    user.profile_completeness = completeness;
    await this.userRepository.save(user);

    // Get recent ratings
    const recentRatings = await this.ratingRepository.find({
      where: { rated_user_id: userId, is_public: true },
      order: { created_at: 'DESC' },
      take: 5,
    });

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      bio: user.bio,
      timezone: user.timezone,
      country: user.country,
      language: user.language,
      profile_picture_url: user.profile_picture_url,
      skills: user.skills || [],
      badges: this.calculateBadges(user),
      wallet_address: user.wallet_address,
      wallet_connected: !!user.wallet_address,
      trust_score: Number(user.trust_score),
      total_ratings: user.total_ratings,
      completed_contracts: user.completed_contracts,
      total_volume_usdc: Number(user.total_volume_usdc),
      profile_completeness: completeness,
      notification_preferences: user.notification_preferences || {
        email_escrow_updates: true,
        email_dispute_updates: true,
        email_payment_received: true,
      },
      email_verified: user.email_verified,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      recent_ratings: recentRatings.map((r) => ({
        id: r.id,
        rating: r.overall_rating,
        comment: r.comment,
        created_at: r.created_at,
      })),
    };
  }

  /**
   * Get public profile of any user (limited details)
   */
  async getUserProfile(userId: string, requestingUserId?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isOwnProfile = requestingUserId === userId;

    // Get rating breakdown
    const ratings = await this.ratingRepository.find({
      where: { rated_user_id: userId, is_public: true },
      order: { created_at: 'DESC' },
      take: 10,
    });

    const ratingBreakdown = this.calculateRatingBreakdown(ratings);

    return {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      bio: user.bio,
      country: user.country,
      language: user.language,
      profile_picture_url: user.profile_picture_url,
      skills: user.skills || [],
      badges: this.calculateBadges(user),
      wallet_address: user.wallet_address, // Public info for trust
      trust_score: Number(user.trust_score),
      total_ratings: user.total_ratings,
      completed_contracts: user.completed_contracts,
      total_volume_usdc: Number(user.total_volume_usdc),
      member_since: user.created_at,
      rating_breakdown: ratingBreakdown,
      // Only show email if viewing own profile
      ...(isOwnProfile && { email: user.email }),
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update fields
    Object.assign(user, updateDto);

    // Recalculate profile completeness
    user.profile_completeness = this.calculateProfileCompleteness(user);
    user.badges = this.calculateBadges(user);

    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Profile updated successfully',
      profile_completeness: user.profile_completeness,
      badges: user.badges,
    };
  }

  /**
   * Search users with advanced filters
   */
  async searchUsers(searchDto: SearchUsersDto) {
    const {
      query,
      role,
      min_trust_score,
      skills,
      country,
      page = 1,
      limit = 20,
      sort = '-trust_score',
    } = searchDto;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.email_verified = :verified', { verified: true })
      .andWhere('user.status = :status', { status: 'active' });

    // Text search
    if (query) {
      queryBuilder.andWhere(
        '(user.full_name ILIKE :query OR user.bio ILIKE :query OR :query = ANY(user.skills))',
        { query: `%${query}%` },
      );
    }

    // Role filter
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    // Trust score filter
    if (min_trust_score) {
      queryBuilder.andWhere('user.trust_score >= :minTrust', {
        minTrust: min_trust_score,
      });
    }

    // Skills filter (for freelancers)
    if (skills && skills.length > 0) {
      queryBuilder.andWhere('user.skills && :skills', { skills });
    }

    // Country filter
    if (country) {
      queryBuilder.andWhere('user.country = :country', { country });
    }

    // Sorting
    const [sortField, sortOrder] = sort.startsWith('-')
      ? [sort.substring(1), 'DESC']
      : [sort, 'ASC'];

    queryBuilder.orderBy(`user.${sortField}`, sortOrder as 'ASC' | 'DESC');

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users: users.map((user) => ({
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        bio: user.bio,
        country: user.country,
        profile_picture_url: user.profile_picture_url,
        skills: user.skills || [],
        badges: this.calculateBadges(user),
        trust_score: Number(user.trust_score),
        total_ratings: user.total_ratings,
        completed_contracts: user.completed_contracts,
        member_since: user.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get ratings for a user
   */
  async getUserRatings(userId: string, page = 1, limit = 10) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * limit;

    const [ratings, total] = await this.ratingRepository.findAndCount({
      where: { rated_user_id: userId, is_public: true },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    // Fetch reviewer info for each rating
    const ratingsWithReviewers = await Promise.all(
      ratings.map(async (rating) => {
        const reviewer = await this.userRepository.findOne({
          where: { id: rating.reviewer_id },
          select: ['id', 'full_name', 'role', 'profile_picture_url'],
        });

        return {
          id: rating.id,
          rating: rating.overall_rating,
          communication: rating.communication_rating,
          quality: rating.quality_rating,
          professionalism: rating.professionalism_rating,
          timeliness: rating.timeliness_rating,
          comment: rating.comment,
          escrow_id: rating.escrow_id,
          reviewer: reviewer
            ? {
                id: reviewer.id,
                name: reviewer.full_name,
                role: reviewer.role,
                profile_picture: reviewer.profile_picture_url,
              }
            : null,
          created_at: rating.created_at,
        };
      }),
    );

    const ratingBreakdown = this.calculateRatingBreakdown(ratings);

    return {
      user_id: userId,
      average_rating: Number(user.trust_score),
      total_ratings: total,
      rating_breakdown: ratingBreakdown,
      ratings: ratingsWithReviewers,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Submit a rating (called after escrow completion)
   */
  async submitRating(reviewerId: string, submitDto: SubmitRatingDto) {
    const { escrow_id, rated_user_id, ...ratingData } = submitDto;

    // TODO: Verify escrow is completed and reviewer is part of it
    // This will be implemented when we have the Escrow entity

    // Check if rating already exists
    const existingRating = await this.ratingRepository.findOne({
      where: {
        escrow_id,
        reviewer_id: reviewerId,
        rated_user_id,
      },
    });

    if (existingRating) {
      throw new BadRequestException('You have already rated this user');
    }

    // Get reviewer role for context
    const reviewer = await this.userRepository.findOne({
      where: { id: reviewerId },
    });

    // Create rating
    const rating = this.ratingRepository.create({
      rated_user_id,
      reviewer_id: reviewerId,
      escrow_id,
      reviewer_role: reviewer?.role,
      ...ratingData,
    });

    await this.ratingRepository.save(rating);

    // Update user's trust score and rating count
    await this.updateUserTrustScore(rated_user_id);

    return {
      success: true,
      message: 'Rating submitted successfully',
      rating_id: rating.id,
    };
  }

  /**
   * Calculate profile completeness percentage
   */
  private calculateProfileCompleteness(user: User): number {
    let completeness = 0;
    const weights = {
      email_verified: 15,
      full_name: 10,
      bio: 15,
      profile_picture: 10,
      wallet_connected: 20,
      skills: 15,
      country: 5,
      timezone: 5,
      language: 5,
    };

    if (user.email_verified) completeness += weights.email_verified;
    if (user.full_name) completeness += weights.full_name;
    if (user.bio && user.bio.length > 50) completeness += weights.bio;
    if (user.profile_picture_url) completeness += weights.profile_picture;
    if (user.wallet_address) completeness += weights.wallet_connected;
    if (user.skills && user.skills.length > 0) completeness += weights.skills;
    if (user.country) completeness += weights.country;
    if (user.timezone) completeness += weights.timezone;
    if (user.language) completeness += weights.language;

    return Math.min(completeness, 100);
  }

  /**
   * Calculate user badges
   */
  private calculateBadges(user: User): string[] {
    const badges: string[] = [];

    if (user.email_verified) badges.push('email_verified');
    if (user.wallet_address) badges.push('wallet_connected');
    if (user.trust_score >= 4.8) badges.push('top_rated');
    if (user.completed_contracts >= 10) badges.push('experienced');
    if (user.completed_contracts >= 50) badges.push('veteran');
    if (user.total_volume_usdc >= 10000) badges.push('high_volume');

    return badges;
  }

  /**
   * Calculate rating breakdown
   */
  private calculateRatingBreakdown(ratings: Rating[]) {
    if (ratings.length === 0) {
      return {
        overall: 0,
        communication: 0,
        quality: 0,
        professionalism: 0,
        timeliness: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const sum = ratings.reduce(
      (acc, r) => ({
        overall: acc.overall + r.overall_rating,
        communication: acc.communication + (r.communication_rating || 0),
        quality: acc.quality + (r.quality_rating || 0),
        professionalism: acc.professionalism + (r.professionalism_rating || 0),
        timeliness: acc.timeliness + (r.timeliness_rating || 0),
      }),
      {
        overall: 0,
        communication: 0,
        quality: 0,
        professionalism: 0,
        timeliness: 0,
      },
    );

    const count = ratings.length;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    ratings.forEach((r) => {
      distribution[r.overall_rating as keyof typeof distribution]++;
    });

    return {
      overall: Number((sum.overall / count).toFixed(2)),
      communication: Number((sum.communication / count).toFixed(2)),
      quality: Number((sum.quality / count).toFixed(2)),
      professionalism: Number((sum.professionalism / count).toFixed(2)),
      timeliness: Number((sum.timeliness / count).toFixed(2)),
      distribution,
    };
  }

  /**
   * Update user's trust score based on ratings
   */
  private async updateUserTrustScore(userId: string) {
    const ratings = await this.ratingRepository.find({
      where: { rated_user_id: userId, is_public: true },
    });

    if (ratings.length === 0) return;

    // Calculate weighted average (recent ratings have more weight)
    const now = new Date();
    let totalWeight = 0;
    let weightedSum = 0;

    ratings.forEach((rating) => {
      const ageInDays =
        (now.getTime() - rating.created_at.getTime()) / (1000 * 60 * 60 * 24);
      // Recent ratings (< 90 days) get weight 1.0, older ratings decay
      const weight = ageInDays < 90 ? 1.0 : Math.max(0.5, 1 - ageInDays / 365);

      weightedSum += rating.overall_rating * weight;
      totalWeight += weight;
    });

    const trustScore = Number((weightedSum / totalWeight).toFixed(2));

    await this.userRepository.update(userId, {
      trust_score: trustScore,
      total_ratings: ratings.length,
    });
  }
}
