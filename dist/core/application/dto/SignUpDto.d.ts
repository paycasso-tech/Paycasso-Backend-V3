import { UserRole } from '../../domain/entities/User.entity';
export declare class SignUpDto {
    email: string;
    password: string;
    confirm_password: string;
    role: UserRole;
    full_name: string;
    timezone?: string;
}
