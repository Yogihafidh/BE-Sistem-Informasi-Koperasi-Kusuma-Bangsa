import { Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { JenisDokumen } from '@prisma/client';

@Injectable()
export class MinioService {
  private readonly minioClient: Client;
  private readonly internalBaseUrl: string;
  private readonly publicUrl: string;
  private readonly presignedExpirySeconds: number;
  private readonly presignedTimeoutMs: number;
  private readonly bucketMap: Record<JenisDokumen, string>;
  private readonly ensuredBuckets = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = Number.parseInt(process.env.MINIO_PORT || '9000', 10);
    const useSSL = (process.env.MINIO_USE_SSL || 'false') === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY || '';
    const secretKey = process.env.MINIO_SECRET_KEY || '';

    const publicEndpoint =
      process.env.MINIO_PUBLIC_ENDPOINT ||
      process.env.MINIO_ENDPOINT ||
      endpoint;
    const publicPort = Number.parseInt(
      process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || `${port}`,
      10,
    );
    const publicUseSSL =
      (process.env.MINIO_PUBLIC_USE_SSL ||
        process.env.MINIO_USE_SSL ||
        'false') === 'true';

    this.internalBaseUrl = `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`;
    this.publicUrl =
      process.env.MINIO_PUBLIC_URL ||
      `${publicUseSSL ? 'https' : 'http'}://${publicEndpoint}:${publicPort}`;

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
      process.env.MINIO_PRESIGNED_TIMEOUT_MS || '3000',
    );
    const normalizedTimeout = Number.isFinite(configuredTimeout)
      ? Math.floor(configuredTimeout)
      : 3000;
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

    this.minioClient = new Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  private async ensureBucket(bucket: string) {
    if (this.ensuredBuckets.has(bucket)) {
      return;
    }

    const exists = await this.minioClient.bucketExists(bucket);
    if (!exists) {
      await this.minioClient.makeBucket(bucket);
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
    return this.minioClient.putObject(
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
    const signedUrl = await this.withTimeout(
      this.minioClient.presignedGetObject(bucket, objectName, expiresInSeconds),
      this.presignedTimeoutMs,
      `presignedGetObject timeout (${this.presignedTimeoutMs}ms)`,
    );

    return this.toPublicPresignedUrl(signedUrl);
  }

  private toPublicPresignedUrl(url: string) {
    if (!this.publicUrl || this.publicUrl === this.internalBaseUrl) {
      return url;
    }

    if (!url.startsWith(this.internalBaseUrl)) {
      return url;
    }

    return `${this.publicUrl}${url.slice(this.internalBaseUrl.length)}`;
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
    await this.minioClient.removeObject(resolved.bucket, resolved.objectName);
  }
}
