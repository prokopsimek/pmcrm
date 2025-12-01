import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validate } from './env.validation';
import * as path from 'path';

// Get monorepo root path (one level up from backend directory)
// process.cwd() is the backend directory when running `pnpm dev`
const backendDir = process.cwd();
const monorepoRoot = path.resolve(backendDir, '..');

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Load env files from multiple locations, with priority (first found wins)
      envFilePath: [
        // Local overrides in backend (highest priority)
        path.join(backendDir, '.env.local'),
        // Local overrides in monorepo root
        path.join(monorepoRoot, '.env.local'),
        // Main env in backend
        path.join(backendDir, '.env'),
        // Main env in monorepo root (this is where we want to load from)
        path.join(monorepoRoot, '.env'),
      ],
      validate,
      cache: true,
    }),
  ],
})
export class ConfigModule {}
