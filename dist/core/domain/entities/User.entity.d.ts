import { Wallet } from './Wallet.entity';
export declare enum UserRole {
    CLIENT = "client",
    FREELANCER = "freelancer",
    ADMIN = "admin"
}
export declare enum UserStatus {
    PENDING_VERIFICATION = "pending_verification",
    ACTIVE = "active",
    SUSPENDED = "suspended",
    DELETED = "deleted"
}
export declare class User {
    id: string;
    email: string;
    password_hash: string;
    role: UserRole;
    status: UserStatus;
    email_verified: boolean;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
    last_login_at: Date;
    full_name: string;
    timezone: string;
    bio: string;
    notification_preferences: {
        email_escrow_updates?: boolean;
        email_dispute_updates?: boolean;
        email_payment_received?: boolean;
    };
    trust_score: number;
    total_ratings: number;
    completed_contracts: number;
    total_volume_usdc: number;
    wallet_address: string;
    wallet_created_at: Date;
    wallet_provider: string;
    wallets: Wallet[];
    profile_completeness: number;
    badges: string[];
    skills: string[];
    profile_picture_url: string;
    country: string;
    language: string;
}
