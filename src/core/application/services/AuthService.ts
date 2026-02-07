import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus, UserRole } from '../../domain/entities/User.entity';
import { OtpToken, OtpType } from '../../domain/entities/OtpToken.entity';
import { SignUpDto } from '../dto/SignUpDto';
import { SignInDto } from '../dto/SignInDto';
import { VerifyEmailDto } from '../dto/VerifyEmailDto';
import { CryptoUtils } from '../../../shared/utils/crypto';
import { EmailService } from './EmailService';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OtpToken)
    private otpRepository: Repository<OtpToken>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const { email, password, confirm_password, role, full_name, timezone } =
      signUpDto;

    if (password !== confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await CryptoUtils.hashPassword(password);

    const user = this.userRepository.create({
      email,
      password_hash: passwordHash,
      role,
      full_name,
      timezone: timezone || 'UTC',
      status: UserStatus.PENDING_VERIFICATION,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate and send OTP
    const otp = CryptoUtils.generateOtp(6);
    const otpHash = CryptoUtils.hashOtp(otp);

    // Expires in 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const otpToken = this.otpRepository.create({
      user_id: savedUser.id,
      token: otpHash,
      type: OtpType.EMAIL_VERIFICATION,
      expires_at: expiresAt,
    });

    await this.otpRepository.save(otpToken);
    await this.emailService.sendVerificationEmail(email, otp);

    return {
      success: true,
      message: 'Verification OTP sent to email',
      user_id: savedUser.id,
      email: savedUser.email,
    };
  }

  async resendOtp(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal user existence for security
      return {
        success: true,
        message: 'If account exists, OTP has been sent',
      };
    }

    if (user.email_verified) {
      throw new BadRequestException('Email already verified');
    }

    // Rate limiting: Check last OTP sent time (max 3 per 10 minutes)
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    const recentOtps = await this.otpRepository.count({
      where: {
        user_id: user.id,
        type: OtpType.EMAIL_VERIFICATION,
        created_at: tenMinutesAgo,
      },
    });

    if (recentOtps >= 3) {
      throw new BadRequestException(
        'Too many OTP requests. Please try again in 10 minutes.',
      );
    }

    // Generate and send new OTP
    const otp = CryptoUtils.generateOtp(6);
    const otpHash = CryptoUtils.hashOtp(otp);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const otpToken = this.otpRepository.create({
      user_id: user.id,
      token: otpHash,
      type: OtpType.EMAIL_VERIFICATION,
      expires_at: expiresAt,
    });

    await this.otpRepository.save(otpToken);
    await this.emailService.sendVerificationEmail(email, otp);

    return {
      success: true,
      message: 'Verification OTP resent to email',
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { email, otp } = verifyEmailDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email already verified');
    }

    // Find valid OTP
    const otpRecord = await this.otpRepository.findOne({
      where: {
        user_id: user.id,
        type: OtpType.EMAIL_VERIFICATION,
        used_at: IsNull(),
      },
      order: { created_at: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (!CryptoUtils.compareOtp(otp, otpRecord.token)) {
      throw new BadRequestException('Invalid OTP');
    }

    if (new Date() > otpRecord.expires_at) {
      throw new BadRequestException('OTP expired');
    }

    // Mark OTP as used
    otpRecord.used_at = new Date();
    await this.otpRepository.save(otpRecord);

    // Activate User
    user.email_verified = true;
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);

    return this.generateAuthResponse(user);
  }

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await CryptoUtils.comparePassword(
      password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      user.status !== UserStatus.ACTIVE &&
      user.status !== UserStatus.PENDING_VERIFICATION
    ) {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    // Update last login
    user.last_login_at = new Date();
    await this.userRepository.save(user);

    return this.generateAuthResponse(user);
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal user existence
      return { status: 'success', message: 'If account exists, OTP sent' };
    }

    const otp = CryptoUtils.generateOtp(6);
    const otpHash = CryptoUtils.hashOtp(otp);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const otpToken = this.otpRepository.create({
      user_id: user.id,
      token: otpHash,
      type: OtpType.PASSWORD_RESET,
      expires_at: expiresAt,
    });

    await this.otpRepository.save(otpToken);
    await this.emailService.sendPasswordResetEmail(email, otp);

    return {
      status: 'success',
      message: 'Password reset OTP sent to email',
    };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('Invalid request');
    }

    const otpRecord = await this.otpRepository.findOne({
      where: {
        user_id: user.id,
        type: OtpType.PASSWORD_RESET,
        used_at: IsNull(),
      },
      order: { created_at: 'DESC' },
    });

    if (!otpRecord || !CryptoUtils.compareOtp(otp, otpRecord.token)) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (new Date() > otpRecord.expires_at) {
      throw new BadRequestException('OTP expired');
    }

    // Mark OTP used
    otpRecord.used_at = new Date();
    await this.otpRepository.save(otpRecord);

    // Update password
    user.password_hash = await CryptoUtils.hashPassword(newPassword);
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isPasswordValid = await CryptoUtils.comparePassword(
      currentPassword,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Update to new password
    user.password_hash = await CryptoUtils.hashPassword(newPassword);
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // In a real app, verify revocation status here if storing refresh tokens in DB

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      const newAccessToken = this.jwtService.sign(newPayload);

      return {
        status: 'success',
        data: {
          access_token: newAccessToken,
          expires_in: 3600,
        },
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // In stateless JWT, we can't really "logout" without a blacklist.
    // Spec asks for success response.
    // If implementing refresh token rotation, we would revoke it here.
    return {
      status: 'success',
      message: 'Logged out successfully',
    };
  }

  async deleteAccount(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    // Hard delete or soft delete? Spec schema has deleted_at, implying soft delete.
    await this.userRepository.softDelete(userId); // Updates deleted_at

    return {
      status: 'success',
      message:
        'Account deletion initiated. Your data will be permanently deleted in 30 days.',
    };
  }

  private async generateAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      status: 'success',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          email_verified: user.email_verified,
        },
      },
    };
  }
}
