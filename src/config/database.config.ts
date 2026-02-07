import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/../core/domain/entities/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV !== 'production', // Disable in production
    logging: process.env.NODE_ENV === 'development',
    autoLoadEntities: true,
  }),
);
