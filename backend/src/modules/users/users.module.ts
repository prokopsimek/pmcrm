import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule } from '@/shared/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'fallback-secret-for-dev',
        signOptions: {
          expiresIn: configService.get<number>('JWT_EXPIRATION') || 900, // 15 minutes in seconds
        },
      }),
    }),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
