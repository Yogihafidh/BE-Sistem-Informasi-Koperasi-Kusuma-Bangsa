import { Injectable } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { JenisDokumen } from '@prisma/client';

@Injectable()
export class MinioService {
  private readonly client: Client;
  private readonly publicUrl: string;
  private readonly presignedExpirySeconds: number;
  private readonly bucketMap: Record<JenisDokumen, string>;
  private readonly ensuredBuckets = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    const endPoint = configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = parseInt(
      configService.get<string>('MINIO_PORT') || '9000',
      10,
    );
    const useSSL =
      (configService.get<string>('MINIO_USE_SSL') || 'false') === 'true';
    const accessKey = configService.get<string>('MINIO_ACCESS_KEY') || '';
    const secretKey = configService.get<string>('MINIO_SECRET_KEY') || '';

    this.publicUrl =
      configService.get<string>('MINIO_PUBLIC_URL') ||
      `http://${endPoint}:${port}`;

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

    this.client = new Client({
      endPoint,
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

    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
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
    return this.client.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
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
    return this.client.presignedGetObject(bucket, objectName, expiresInSeconds);
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
    try {
      await this.client.removeObject(resolved.bucket, resolved.objectName);
    } catch {
      // Ignore delete failure to keep idempotent replacement flow.
    }
  }
}
