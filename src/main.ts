import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { winstonLogger } from './common/logger/winston.logger';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { getClientIp } from './common/utils/request-ip.util';
import { runWithRequestContext } from './common/utils/request-context.util';

async function bootstrap() {
  // Set timezone to Asia/Jakarta
  process.env.TZ = 'Asia/Jakarta';

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  app.use((request: Request, _response: Response, next: NextFunction) => {
    const ipAddress = getClientIp(request);
    runWithRequestContext({ ipAddress }, next);
  });

  // Ambil ConfigService untuk baca config
  const configService = app.get(ConfigService);

  // Setup Global Validation Pipe untuk DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Hapus property yang tidak ada di DTO
      forbidNonWhitelisted: true, // Throw error jika ada property tidak dikenal
      transform: true, // Auto transform payload ke DTO instance
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const corsEnabled = configService.get<boolean>('app.corsEnabled');
  if (corsEnabled) {
    app.enableCors({
      origin: configService.get<string>('app.corsOrigin'),
      credentials: true,
    });
  }

  // Setup Global Prefix dari config
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  app.setGlobalPrefix(apiPrefix);

  // Trust reverse proxy agar Express membaca IP client asli dari X-Forwarded-For.
  const instance = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  instance.set?.('trust proxy', true);

  // Setup Swagger/OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Koperasi API')
    .setDescription('API Documentation untuk Sistem Manajemen Koperasi')
    .setVersion('1.0')
    .addTag('auth', 'Authentication & Authorization')
    .addTag('users', 'User Management')
    .addTag('roles', 'Role Management')
    .addTag('permissions', 'Permission Management')
    .addTag('pegawai', 'Pegawai Management')
    .addTag('nasabah', 'Nasabah Management')
    .addTag('transaksi', 'Transaksi Management')
    .addTag('simpanan', 'Simpanan Management')
    .addTag('pinjaman', 'Pinjaman Management')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'Koperasi API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  // Jalankan aplikasi di port dari config
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  // Log informasi startup
  winstonLogger.log(
    `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`,
    'Bootstrap',
  );
  winstonLogger.log(
    `📚 Swagger Documentation: http://localhost:${port}/api-docs`,
    'Bootstrap',
  );
  winstonLogger.log(
    `📝 Environment: ${configService.get<string>('app.nodeEnv')}`,
    'Bootstrap',
  );
}
void bootstrap();
