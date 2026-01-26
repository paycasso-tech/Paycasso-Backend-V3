import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRY || '3600s',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
}));
