import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { JenisDokumen } from '@prisma/client';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly internalClient: Client;
  private readonly publicClient: Client;
  private readonly publicUrl: string;
  private readonly presignedExpirySeconds: number;
  private readonly presignedTimeoutMs: number;
  private readonly bucketMap: Record<JenisDokumen, string>;
  private readonly ensuredBuckets = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    const internalEndpoint =
      configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const internalPort = parseInt(
      configService.get<string>('MINIO_PORT') || '9000',
      10,
    );
    const internalUseSSL =
      (configService.get<string>('MINIO_USE_SSL') || 'false') === 'true';
    const accessKey = configService.get<string>('MINIO_ACCESS_KEY') || '';
    const secretKey = configService.get<string>('MINIO_SECRET_KEY') || '';

    const rawPublicUrl = configService.get<string>('MINIO_PUBLIC_URL');
    this.publicUrl =
      rawPublicUrl ||
      `${internalUseSSL ? 'https' : 'http'}://${internalEndpoint}:${internalPort}`;

    let publicEndpoint =
      configService.get<string>('MINIO_PUBLIC_ENDPOINT') || internalEndpoint;
    let publicPort = Number.parseInt(
      configService.get<string>('MINIO_PUBLIC_PORT') || `${internalPort}`,
      10,
    );
    let publicUseSSL =
      (configService.get<string>('MINIO_PUBLIC_USE_SSL') ||
        `${internalUseSSL}`) === 'true';

    if (rawPublicUrl) {
      try {
        const parsed = new URL(rawPublicUrl);
        publicEndpoint = parsed.hostname;
        publicPort = parsed.port ? Number(parsed.port) : 80;
        publicUseSSL = parsed.protocol === 'https:';
      } catch {
        this.logger.warn(
          `MINIO_PUBLIC_URL tidak valid (${rawPublicUrl}). Fallback ke endpoint internal untuk signing URL.`,
        );
      }
    }

    if (!rawPublicUrl) {
      this.logger.warn(
        `MINIO_PUBLIC_URL tidak ter-set. Fallback ke ${this.publicUrl}. URL browser bisa gagal jika hostname internal tidak dapat di-resolve.`,
      );
    }

    if (publicEndpoint === internalEndpoint && publicPort === internalPort) {
      this.logger.warn(
        `Presigned URL ditandatangani menggunakan endpoint internal (${internalEndpoint}:${internalPort}). Browser publik kemungkinan tidak dapat mengakses URL ini.`,
      );
    }

    const configuredExpiry = Number(
      configService.get<string>('MINIO_PRESIGNED_EXPIRY_SECONDS') || '300',
    );
    const normalizedExpiry = Number.isFinite(configuredExpiry)
      ? Math.floor(configuredExpiry)
      : 300;
    this.presignedExpirySeconds = Math.min(
      604800,
      Math.max(60, normalizedExpiry),
    );

    const configuredTimeout = Number(
      configService.get<string>('MINIO_PRESIGNED_TIMEOUT_MS') || '2000',
    );
    const normalizedTimeout = Number.isFinite(configuredTimeout)
      ? Math.floor(configuredTimeout)
      : 2000;
    this.presignedTimeoutMs = Math.min(10000, Math.max(500, normalizedTimeout));

    this.bucketMap = {
      [JenisDokumen.KTP]: this.normalizeBucket(
        configService.get<string>('MINIO_BUCKET_KTP') || 'ktp-docs',
      ),
      [JenisDokumen.KK]: this.normalizeBucket(
        configService.get<string>('MINIO_BUCKET_KK') || 'kk-docs',
      ),
      [JenisDokumen.SLIP_GAJI]: this.normalizeBucket(
        configService.get<string>('MINIO_BUCKET_SLIP_GAJI') || 'slip-gaji-docs',
      ),
    };

    this.internalClient = new Client({
      endPoint: internalEndpoint,
      port: internalPort,
      useSSL: internalUseSSL,
      accessKey,
      secretKey,
    });

    this.publicClient = new Client({
      endPoint: publicEndpoint,
      port: publicPort,
      useSSL: publicUseSSL,
      accessKey,
      secretKey,
    });
  }

  private async ensureBucket(bucket: string) {
    if (this.ensuredBuckets.has(bucket)) {
      return;
    }

    const exists = await this.internalClient.bucketExists(bucket);
    if (!exists) {
      await this.internalClient.makeBucket(bucket);
    }

    this.ensuredBuckets.add(bucket);
  }

  private normalizeBucket(name: string) {
    const normalized = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '-');

    if (normalized.length >= 3) {
      return normalized;
    }

    return `docs-${normalized.padEnd(3, '-')}`;
  }

  getBucketNameForJenis(jenis: JenisDokumen) {
    return this.bucketMap[jenis];
  }

  async uploadObject(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ) {
    await this.ensureBucket(bucket);
    return this.internalClient.putObject(
      bucket,
      objectName,
      buffer,
      buffer.length,
      {
        'Content-Type': contentType,
      },
    );
  }

  buildPublicUrl(bucket: string, objectName: string) {
    return `${this.publicUrl}/${bucket}/${objectName}`;
  }

  buildObjectKey(bucket: string, objectName: string) {
    return `${bucket}/${objectName}`;
  }

  private extractBucketAndObjectFromStoredRef(storedRef: string) {
    const trimmed = storedRef.trim();
    if (!trimmed) {
      return null;
    }

    // New format: bucket/path/to/object
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const plainRef = trimmed.replace(/^\/+/, '');
      const slashIndex = plainRef.indexOf('/');
      if (slashIndex <= 0) {
        return null;
      }

      const bucket = plainRef.slice(0, slashIndex);
      const objectName = plainRef.slice(slashIndex + 1);
      if (!bucket || !objectName) {
        return null;
      }

      return {
        bucket,
        objectName,
      };
    }

    // Legacy format: full URL
    let path = trimmed;
    try {
      path = new URL(trimmed).pathname;
    } catch {
      path = trimmed;
    }

    const normalizedPath = path.replace(/^\/+/, '');
    const slashIndex = normalizedPath.indexOf('/');
    if (slashIndex <= 0) {
      return null;
    }

    const bucket = normalizedPath.slice(0, slashIndex);
    const objectName = normalizedPath.slice(slashIndex + 1);
    if (!bucket || !objectName) {
      return null;
    }

    return {
      bucket,
      objectName,
    };
  }

  async getPresignedGetUrl(
    bucket: string,
    objectName: string,
    expiresInSeconds = this.presignedExpirySeconds,
  ) {
    this.logger.log(
      `[MINIO] START presignedGetObject bucket=${bucket} object=${objectName}`,
    );
    const timerLabel = `[MINIO] presignedGetObject ${bucket}/${objectName}`;
    console.time(timerLabel);

    try {
      const result = await this.withTimeout(
        this.publicClient.presignedGetObject(
          bucket,
          objectName,
          expiresInSeconds,
        ),
        this.presignedTimeoutMs,
        `presignedGetObject timeout (${this.presignedTimeoutMs}ms)`,
      );
      this.logger.log(`[MINIO] DONE presignedGetObject bucket=${bucket}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[MINIO] ERROR presignedGetObject bucket=${bucket}: ${message}`,
      );
      throw error;
    } finally {
      console.timeEnd(timerLabel);
    }
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async buildAccessibleUrl(bucket: string, objectName: string) {
    try {
      return await this.getPresignedGetUrl(bucket, objectName);
    } catch {
      return this.buildPublicUrl(bucket, objectName);
    }
  }

  async buildAccessibleUrlFromStoredUrl(fileUrl: string) {
    const resolved = this.extractBucketAndObjectFromStoredRef(fileUrl);
    if (!resolved) {
      return fileUrl;
    }

    return this.buildAccessibleUrl(resolved.bucket, resolved.objectName);
  }

  async deleteObjectByStoredRef(storedRef: string) {
    const resolved = this.extractBucketAndObjectFromStoredRef(storedRef);
    if (!resolved) {
      return;
    }

    await this.ensureBucket(resolved.bucket);
    await this.internalClient.removeObject(
      resolved.bucket,
      resolved.objectName,
    );
  }
}
