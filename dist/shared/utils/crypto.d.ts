export declare class CryptoUtils {
    static hashPassword(password: string): Promise<string>;
    static comparePassword(password: string, hash: string): Promise<boolean>;
    static generateOtp(length?: number): string;
    static hashOtp(otp: string): string;
    static compareOtp(otp: string, hash: string): boolean;
}
