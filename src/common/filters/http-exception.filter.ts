import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { winstonLogger } from '../logger/winston.logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // 1. Ambil konteks HTTP (karena NestJS bisa support multiple transport HTTP, WS, RPC)
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 2. Buat timestamp error terjadi (format ISO)
    const timestamp = new Date().toISOString();

    // 3. Tentukan status code berdasarkan jenis exception (default 500 untuk error tak terduga)
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    // 4. Ambil isi exception
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // 5. Normalisasi message (untuk client)
    let responseMessage: string | string[] = 'Internal server error';

    if (typeof exceptionResponse === 'string') {
      responseMessage = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message = (exceptionResponse as { message?: unknown }).message;
      if (typeof message === 'string' || Array.isArray(message)) {
        responseMessage = message as string | string[];
      }
    }

    // 6. Siapkan message untuk logging
    let errorMessage = 'Internal server error';
    if (exception instanceof Error) {
      errorMessage = exception.message;
    } else if (typeof responseMessage === 'string') {
      errorMessage = responseMessage;
    } else if (responseMessage.length > 0) {
      errorMessage = responseMessage.join(', ');
    }

    // 7. Ambil stack trace (debugging)
    const stack = exception instanceof Error ? exception.stack : undefined;

    // 8. Logging error dengan winston (level error untuk 5xx, warn untuk 4xx)
    winstonLogger.error(errorMessage, stack, 'AllExceptionsFilter');
    winstonLogger.warn({
      status,
      path: request.url,
      method: request.method,
      exception: exceptionResponse,
      timestamp,
      ip: request.ip,
    });

    // 9. Kirim response ke client
    response.status(status).json({
      statusCode: status,
      message: responseMessage,
      timestamp,
      path: request.url,
    });
  }
}
