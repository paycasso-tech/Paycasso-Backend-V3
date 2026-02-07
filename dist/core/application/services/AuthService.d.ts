import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../../domain/entities/User.entity';
import { OtpToken } from '../../domain/entities/OtpToken.entity';
import { SignUpDto } from '../dto/SignUpDto';
import { SignInDto } from '../dto/SignInDto';
import { VerifyEmailDto } from '../dto/VerifyEmailDto';
import { EmailService } from './EmailService';
export declare class AuthService {
    private userRepository;
    private otpRepository;
    private jwtService;
    private emailService;
    constructor(userRepository: Repository<User>, otpRepository: Repository<OtpToken>, jwtService: JwtService, emailService: EmailService);
    signUp(signUpDto: SignUpDto): Promise<{
        success: boolean;
        message: string;
        user_id: string;
        email: string;
    }>;
    resendOtp(email: string): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{
        status: string;
        data: {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            user: {
                id: string;
                email: string;
                role: UserRole;
                email_verified: boolean;
            };
        };
    }>;
    signIn(signInDto: SignInDto): Promise<{
        status: string;
        data: {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            user: {
                id: string;
                email: string;
                role: UserRole;
                email_verified: boolean;
            };
        };
    }>;
    forgotPassword(email: string): Promise<{
        status: string;
        message: string;
    }>;
    resetPassword(email: string, otp: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    refreshToken(refreshToken: string): Promise<{
        status: string;
        data: {
            access_token: string;
            expires_in: number;
        };
    }>;
    logout(userId: string): Promise<{
        status: string;
        message: string;
    }>;
    deleteAccount(userId: string): Promise<{
        status: string;
        message: string;
    } | undefined>;
    private generateAuthResponse;
}
