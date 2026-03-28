import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number.parseInt(process.env.PORT || '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api',
  corsEnabled: process.env.CORS_ENABLED === 'true' || true,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  trustProxy: process.env.TRUST_PROXY === 'true',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  cacheTtlDashboardSeconds:
    Number.parseInt(process.env.CACHE_TTL_DASHBOARD_SECONDS || '600', 10) ||
    600,
}));
