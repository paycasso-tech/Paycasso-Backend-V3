import { UserRole } from '../../domain/entities/User.entity';
declare class UserResponse {
    id: string;
    email: string;
    role: UserRole;
    email_verified: boolean;
}
export declare class AuthResponseData {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: UserResponse;
}
export declare class AuthResponseDto {
    status: string;
    data: AuthResponseData;
}
export {};
