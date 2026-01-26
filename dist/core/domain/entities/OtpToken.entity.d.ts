import { User } from './User.entity';
export declare enum OtpType {
    EMAIL_VERIFICATION = "email_verification",
    PASSWORD_RESET = "password_reset",
    LOGIN_2FA = "login_2fa"
}
export declare class OtpToken {
    id: string;
    user_id: string;
    user: User;
    token: string;
    type: OtpType;
    expires_at: Date;
    used_at: Date;
    created_at: Date;
}
