import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger(SecurityLogService.name);

  logLoginFailed(payload: {
    identifier: string;
    reason: 'USER_NOT_FOUND' | 'INACTIVE' | 'INVALID_CREDENTIALS';
    ipAddress?: string;
    userId?: number;
    requestId?: string;
    sessionId?: string;
  }) {
    this.logger.warn({
      category: 'SECURITY_LOG',
      event: 'LOGIN_FAILED',
      identifier: payload.identifier,
      reason: payload.reason,
      userId: payload.userId,
      ipAddress: payload.ipAddress,
      requestId: payload.requestId,
      sessionId: payload.sessionId,
      timestamp: new Date().toISOString(),
    });
  }
}
