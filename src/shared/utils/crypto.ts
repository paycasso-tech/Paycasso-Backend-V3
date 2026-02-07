import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export class CryptoUtils {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateOtp(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[crypto.randomInt(0, 10)];
    }
    return otp;
  }

  static hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  static compareOtp(otp: string, hash: string): boolean {
    const otpHash = this.hashOtp(otp);
    return otpHash === hash;
  }
}
