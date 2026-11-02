import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma CLI commands such as `generate` do not need a live URL; commands
    // that do will fail with a clear connection error if it is missing.
    url: process.env.DATABASE_URL ?? '',
  },
});
