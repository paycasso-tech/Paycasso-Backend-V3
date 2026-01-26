"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('jwt', () => ({
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRY || '3600s',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
}));
//# sourceMappingURL=jwt.config.js.map