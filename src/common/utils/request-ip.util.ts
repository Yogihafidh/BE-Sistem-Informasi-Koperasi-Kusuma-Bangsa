import type { Request } from 'express';

function pickFirstForwardedIp(value: string) {
  const first = value.split(',')[0]?.trim();
  return first || null;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string') {
    const ip = pickFirstForwardedIp(forwardedFor);
    if (ip) {
      return ip;
    }
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const ip = pickFirstForwardedIp(forwardedFor[0]);
    if (ip) {
      return ip;
    }
  }

  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
