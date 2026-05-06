import type { Request } from 'express';

// Helper function to get first IP from 'x-forwarded-for' header
function pickFirstForwardedIp(value: string) {
  const first = value.split(',')[0]?.trim();
  return first || null;
}

// Get client IP address from request (header x-forwarded-for)
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers['x-forwarded-for'];

  // Jika header bertipe string
  if (typeof forwardedFor === 'string') {
    const ip = pickFirstForwardedIp(forwardedFor);
    if (ip) {
      return ip;
    }
  }

  // Jika header bertipe array (bisa terjadi jika ada multiple header dengan nama sama)
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const ip = pickFirstForwardedIp(forwardedFor[0]);
    if (ip) {
      return ip;
    }
  }

  return request.ip ?? request.socket.remoteAddress ?? 'unknown';
}
