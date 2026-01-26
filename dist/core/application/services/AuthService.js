"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const User_entity_1 = require("../../domain/entities/User.entity");
const OtpToken_entity_1 = require("../../domain/entities/OtpToken.entity");
const crypto_1 = require("../../../shared/utils/crypto");
const EmailService_1 = require("./EmailService");
let AuthService = class AuthService {
    userRepository;
    otpRepository;
    jwtService;
    emailService;
    constructor(userRepository, otpRepository, jwtService, emailService) {
        this.userRepository = userRepository;
        this.otpRepository = otpRepository;
        this.jwtService = jwtService;
        this.emailService = emailService;
    }
    async signUp(signUpDto) {
        const { email, password, confirm_password } = signUpDto;
        if (password !== confirm_password) {
            throw new common_1.BadRequestException('Passwords do not match');
        }
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        const passwordHash = await crypto_1.CryptoUtils.hashPassword(password);
        const user = this.userRepository.create({
            email,
            password_hash: passwordHash,
            role: User_entity_1.UserRole.USER,
            status: User_entity_1.UserStatus.PENDING_VERIFICATION,
        });
        const savedUser = await this.userRepository.save(user);
        const otp = crypto_1.CryptoUtils.generateOtp(6);
        const otpHash = crypto_1.CryptoUtils.hashOtp(otp);
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        const otpToken = this.otpRepository.create({
            user_id: savedUser.id,
            token: otpHash,
            type: OtpToken_entity_1.OtpType.EMAIL_VERIFICATION,
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
    async verifyEmail(verifyEmailDto) {
        const { email, otp } = verifyEmailDto;
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        if (user.email_verified) {
            throw new common_1.BadRequestException('Email already verified');
        }
        const otpRecord = await this.otpRepository.findOne({
            where: {
                user_id: user.id,
                type: OtpToken_entity_1.OtpType.EMAIL_VERIFICATION,
                used_at: (0, typeorm_2.IsNull)(),
            },
            order: { created_at: 'DESC' },
        });
        if (!otpRecord) {
            throw new common_1.BadRequestException('Invalid or expired OTP');
        }
        if (!crypto_1.CryptoUtils.compareOtp(otp, otpRecord.token)) {
            throw new common_1.BadRequestException('Invalid OTP');
        }
        if (new Date() > otpRecord.expires_at) {
            throw new common_1.BadRequestException('OTP expired');
        }
        otpRecord.used_at = new Date();
        await this.otpRepository.save(otpRecord);
        user.email_verified = true;
        user.status = User_entity_1.UserStatus.ACTIVE;
        await this.userRepository.save(user);
        return this.generateAuthResponse(user);
    }
    async signIn(signInDto) {
        const { email, password } = signInDto;
        const user = await this.userRepository.createQueryBuilder('user')
            .addSelect('user.password_hash')
            .where('user.email = :email', { email })
            .getOne();
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await crypto_1.CryptoUtils.comparePassword(password, user.password_hash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.status !== User_entity_1.UserStatus.ACTIVE && user.status !== User_entity_1.UserStatus.PENDING_VERIFICATION) {
            throw new common_1.UnauthorizedException(`Account is ${user.status}`);
        }
        user.last_login_at = new Date();
        await this.userRepository.save(user);
        return this.generateAuthResponse(user);
    }
    async generateAuthResponse(user) {
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(User_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(OtpToken_entity_1.OtpToken)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        EmailService_1.EmailService])
], AuthService);
//# sourceMappingURL=AuthService.js.map