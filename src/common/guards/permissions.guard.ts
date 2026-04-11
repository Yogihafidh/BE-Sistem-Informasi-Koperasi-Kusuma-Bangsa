import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserFromJwt } from '../../modules/auth/interfaces/jwt-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Ambil metadata 'permissions' dari decorator @Permissions()
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    // Jika endpoint tidak punya decorator @Permissions() maka langsung izinkan akses
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Ambil request dari context (HTTP request) lalu ambil user yang sudah di-decode dari JWT oleh JwtAuthGuard
    const request = context.switchToHttp().getRequest<{ user: UserFromJwt }>();
    const user = request.user;

    // Jika user tidak punya permissions di JWT, berarti tidak valid untuk akses endpoint yang butuh permissions
    if (!user?.permissions) {
      throw new ForbiddenException(
        'Anda tidak memiliki permission untuk mengakses endpoint ini',
      );
    }

    // Cek apakah user punya minimal salah satu permission yang dibutuhkan untuk akses endpoint ini
    const hasPermissions = requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasPermissions) {
      throw new ForbiddenException(
        'Anda tidak memiliki permission untuk mengakses endpoint ini',
      );
    }

    return true;
  }
}
