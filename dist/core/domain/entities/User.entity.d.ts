import { Wallet } from './Wallet.entity';
export declare enum UserRole {
    USER = "user",
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
    wallet_address: string;
    wallet_created_at: Date;
    wallet_provider: string;
    wallets: Wallet[];
}
