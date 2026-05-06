import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'minio';
import { ConfigService } from '@nestjs/config';
import { JenisDokumen } from '@prisma/client';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly minioClient: Client;
  private readonly publicUrl: string;
  private readonly ioTimeoutMs: number;
  private readonly bucketMap: Record<JenisDokumen, string>;
  private readonly ensuredBuckets = new Set<string>();
  private readonly ensuringBuckets = new Map<string, Promise<void>>();

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

    this.publicUrl =
      process.env.MINIO_PUBLIC_URL ||
      `${publicUseSSL ? 'https' : 'http'}://${publicEndpoint}:${publicPort}`;

    const configuredTimeout = Number(process.env.MINIO_IO_TIMEOUT_MS || '8000');
    const normalizedTimeout = Number.isFinite(configuredTimeout)
      ? Math.floor(configuredTimeout)
      : 8000;
    this.ioTimeoutMs = Math.min(30000, Math.max(1000, normalizedTimeout));

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

    const inFlight = this.ensuringBuckets.get(bucket);
    if (inFlight) {
      await inFlight;
      return;
    }

    const ensurePromise = (async () => {
      try {
        const exists = await this.withTimeout(
          this.minioClient.bucketExists(bucket),
          this.ioTimeoutMs,
          `bucketExists timeout (${this.ioTimeoutMs}ms)`,
        );

        if (!exists) {
          await this.withTimeout(
            this.minioClient.makeBucket(bucket),
            this.ioTimeoutMs,
            `makeBucket timeout (${this.ioTimeoutMs}ms)`,
          );
        }

        this.ensuredBuckets.add(bucket);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Ensure bucket gagal untuk ${bucket}: ${message}`);
        throw error;
      }
    })();

    this.ensuringBuckets.set(bucket, ensurePromise);
    try {
      await ensurePromise;
    } finally {
      this.ensuringBuckets.delete(bucket);
    }
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
    try {
      return await this.withTimeout(
        this.minioClient.putObject(bucket, objectName, buffer, buffer.length, {
          'Content-Type': contentType,
        }),
        this.ioTimeoutMs,
        `putObject timeout (${this.ioTimeoutMs}ms)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Upload object gagal untuk ${bucket}/${objectName}: ${message}`,
      );
      throw error;
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

  buildAccessibleUrl(bucket: string, objectName: string) {
    return this.buildPublicUrl(bucket, objectName);
  }

  buildAccessibleUrlFromStoredUrl(fileUrl: string) {
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
      await this.withTimeout(
        this.minioClient.removeObject(resolved.bucket, resolved.objectName),
        this.ioTimeoutMs,
        `removeObject timeout (${this.ioTimeoutMs}ms)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Delete object gagal untuk ${resolved.bucket}/${resolved.objectName}: ${message}`,
      );
      throw error;
    }
  }
}
