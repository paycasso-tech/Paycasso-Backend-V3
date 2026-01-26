import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
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
    const { email, password, confirm_password } = signUpDto;

    if (password !== confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await CryptoUtils.hashPassword(password);

    const user = this.userRepository.create({
      email,
      password_hash: passwordHash,
      role: UserRole.USER,
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
      status: 'success',
      message: 'Verification email sent',
      data: {
        user_id: savedUser.id,
        email: savedUser.email,
        verification_required: true,
      },
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
    
    const user = await this.userRepository.createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await CryptoUtils.comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING_VERIFICATION) {
       throw new UnauthorizedException(`Account is ${user.status}`);
    }
    
    // Update last login
    user.last_login_at = new Date();
    await this.userRepository.save(user);

    return this.generateAuthResponse(user);
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
