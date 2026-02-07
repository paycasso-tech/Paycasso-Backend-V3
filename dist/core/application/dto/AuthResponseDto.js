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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthResponseDto = exports.AuthResponseData = void 0;
const swagger_1 = require("@nestjs/swagger");
const User_entity_1 = require("../../domain/entities/User.entity");
class UserResponse {
    id;
    email;
    role;
    email_verified;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    __metadata("design:type", String)
], UserResponse.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'user@example.com' }),
    __metadata("design:type", String)
], UserResponse.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: User_entity_1.UserRole, example: User_entity_1.UserRole.CLIENT }),
    __metadata("design:type", String)
], UserResponse.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], UserResponse.prototype, "email_verified", void 0);
class AuthResponseData {
    access_token;
    refresh_token;
    expires_in;
    user;
}
exports.AuthResponseData = AuthResponseData;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'eyJh...' }),
    __metadata("design:type", String)
], AuthResponseData.prototype, "access_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'eyJh...' }),
    __metadata("design:type", String)
], AuthResponseData.prototype, "refresh_token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 3600 }),
    __metadata("design:type", Number)
], AuthResponseData.prototype, "expires_in", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: UserResponse }),
    __metadata("design:type", UserResponse)
], AuthResponseData.prototype, "user", void 0);
class AuthResponseDto {
    status;
    data;
}
exports.AuthResponseDto = AuthResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'success' }),
    __metadata("design:type", String)
], AuthResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: AuthResponseData }),
    __metadata("design:type", AuthResponseData)
], AuthResponseDto.prototype, "data", void 0);
//# sourceMappingURL=AuthResponseDto.js.map