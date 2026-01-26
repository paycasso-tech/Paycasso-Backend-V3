import { AuthService } from '../../../core/application/services/AuthService';
import { SignUpDto } from '../../../core/application/dto/SignUpDto';
import { SignInDto } from '../../../core/application/dto/SignInDto';
import { VerifyEmailDto } from '../../../core/application/dto/VerifyEmailDto';
import { ForgotPasswordDto, ResetPasswordDto, RefreshTokenDto, DeleteAccountDto } from '../../../core/application/dto/AuthActions.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signUp(signUpDto: SignUpDto): Promise<{
        status: string;
        message: string;
        data: {
            user_id: string;
            email: string;
            verification_required: boolean;
        };
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
                role: import("../../../core/domain/entities/User.entity").UserRole;
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
                role: import("../../../core/domain/entities/User.entity").UserRole;
                email_verified: boolean;
            };
        };
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        status: string;
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        status: string;
        message: string;
    }>;
    refreshToken(dto: RefreshTokenDto): Promise<{
        status: string;
        data: {
            access_token: string;
            expires_in: number;
        };
    }>;
    logout(req: any): Promise<{
        status: string;
        message: string;
    }>;
    deleteAccount(req: any, dto: DeleteAccountDto): Promise<{
        status: string;
        message: string;
    } | undefined>;
}
