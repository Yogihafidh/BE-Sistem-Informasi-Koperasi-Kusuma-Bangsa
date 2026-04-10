import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuditAction, PrismaClient } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import { CacheService } from '../../common/cache/cache.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  CreateRoleDto,
  UpdateRoleDto,
  CreatePermissionDto,
  AssignPermissionsDto,
  AssignRolesDto,
  UpdateUserDto,
} from './dto';
import { AuditTrailService } from '../audit/audit.service';
import { SecurityLogService } from './security-log.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditTrailService: AuditTrailService,
    private readonly securityLogService: SecurityLogService,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaClient,
  ) {}

  private getBlacklistKey(token: string) {
    return `auth:blacklist:${token}`;
  }

  private getBcryptRounds(): number {
    const rawRounds = this.configService.get<string | number>('BCRYPT_ROUNDS');
    const parsedRounds = Number(rawRounds);

    if (!Number.isFinite(parsedRounds) || parsedRounds < 4) {
      return 10;
    }

    return Math.floor(parsedRounds);
  }

  // ==================== AUTHENTICATION ====================
  async register(registerDto: RegisterDto, ipAddress?: string) {
    // Check if username already exists
    const existingUsername = await this.authRepository.findUserByUsername(
      registerDto.username,
    );
    if (existingUsername) {
      throw new ConflictException('Username sudah digunakan');
    }

    // Check if email already exists
    const existingEmail = await this.authRepository.findUserByEmail(
      registerDto.email,
    );
    if (existingEmail) {
      throw new ConflictException('Email sudah digunakan');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      this.getBcryptRounds(),
    );

    // Create user
    const user = await this.authRepository.createUser({
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
    });

    await this.auditTrailService.log({
      action: AuditAction.CREATE,
      entityName: 'User',
      entityId: user.id,
      userId: user.id,
      after: {
        username: user.username,
        email: user.email,
        isActive: user.isActive,
      },
      ipAddress,
    });

    return {
      message: 'Registrasi berhasil',
      user,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string) {
    // Find user by username or email
    const user = await this.authRepository.findUserByUsernameOrEmail(
      loginDto.usernameOrEmail,
    );

    if (!user) {
      this.securityLogService.logLoginFailed({
        identifier: loginDto.usernameOrEmail,
        reason: 'USER_NOT_FOUND',
        ipAddress,
      });
      throw new UnauthorizedException('Username/email atau password salah');
    }

    // Check if user is active
    if (!user.isActive) {
      this.securityLogService.logLoginFailed({
        identifier: loginDto.usernameOrEmail,
        reason: 'INACTIVE',
        ipAddress,
        userId: user.id,
      });
      throw new UnauthorizedException('Akun Anda tidak aktif');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      this.securityLogService.logLoginFailed({
        identifier: loginDto.usernameOrEmail,
        reason: 'INVALID_CREDENTIALS',
        ipAddress,
        userId: user.id,
      });
      throw new UnauthorizedException('Username/email atau password salah');
    }

    // Update last login
    const loginAt = new Date();
    await this.authRepository.updateLastLogin(user.id, loginAt);
    await this.auditTrailService.log({
      action: AuditAction.LOGIN,
      entityName: 'User',
      entityId: user.id,
      userId: user.id,
      before: { lastLoginAt: user.lastLoginAt?.toISOString() ?? null },
      after: { lastLoginAt: loginAt.toISOString() },
      ipAddress,
    });

    // Extract roles and permissions
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );
    const uniquePermissions = [...new Set(permissions)];

    // Generate tokens
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      permissions: uniquePermissions,
    };

    const accessTokenExpiresIn =
      this.configService.get<string>('jwt.accessTokenExpiresIn') || '15m';
    const refreshTokenExpiresIn =
      this.configService.get<string>('jwt.refreshTokenExpiresIn') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiresIn as StringValue,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenType: 'refresh' },
      {
        expiresIn: refreshTokenExpiresIn as StringValue,
      },
    );

    return {
      message: 'Login berhasil',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
        permissions: uniquePermissions,
      },
      accessToken,
      refreshToken,
    };
  }

  async getProfile(userId: number) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );
    const uniquePermissions = [...new Set(permissions)];

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles,
      permissions: uniquePermissions,
    };
  }

  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
    ipAddress?: string,
  ) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException('Password lama tidak sesuai');
    }

    // Check if new password matches confirmation
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('Konfirmasi password tidak sesuai');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      this.getBcryptRounds(),
    );

    // Update password
    await this.authRepository.updateUserPassword(userId, hashedPassword);

    const changedAt = new Date().toISOString();
    await this.auditTrailService.log({
      action: AuditAction.UPDATE,
      entityName: 'User',
      entityId: userId,
      userId,
      before: { passwordChangedAt: null },
      after: { passwordChangedAt: changedAt },
      ipAddress,
    });

    return {
      message: 'Password berhasil diubah',
    };
  }

  async updateUser(
    userId: number,
    updateUserDto: UpdateUserDto,
    actorUserId?: number,
    ipAddress?: string,
  ) {
    // Check if user exists
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // Prepare update data
    const updateData: {
      username?: string;
      email?: string;
      password?: string;
      isActive?: boolean;
    } = {};

    // Check if username is being updated and not already taken
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUser = await this.authRepository.findUserByUsername(
        updateUserDto.username,
      );
      if (existingUser) {
        throw new ConflictException('Username sudah digunakan');
      }
      updateData.username = updateUserDto.username;
    }

    // Check if email is being updated and not already taken
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.authRepository.findUserByEmail(
        updateUserDto.email,
      );
      if (existingUser) {
        throw new ConflictException('Email sudah digunakan');
      }
      updateData.email = updateUserDto.email;
    }

    // Hash password if being updated
    if (updateUserDto.password) {
      updateData.password = await bcrypt.hash(
        updateUserDto.password,
        this.getBcryptRounds(),
      );
    }

    // Update isActive status
    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }

    // Perform update
    const updatedUser = await this.authRepository.updateUser(
      userId,
      updateData,
    );

    await this.auditTrailService.log({
      action: AuditAction.UPDATE,
      entityName: 'User',
      entityId: userId,
      userId: actorUserId,
      before: {
        username: user.username,
        email: user.email,
        isActive: user.isActive,
      },
      after: {
        username: updatedUser.username,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
      },
      ipAddress,
    });

    return {
      message: 'Data user berhasil diubah',
      data: updatedUser,
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token wajib diisi');
    }

    type RefreshTokenPayload = {
      sub?: number;
      tokenType?: string;
      username?: string;
      email?: string;
      roles?: unknown;
      permissions?: unknown;
    };

    let verifiedPayload: RefreshTokenPayload;
    try {
      verifiedPayload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret:
            this.configService.get<string>('jwt.secret') ||
            'your-secret-key-change-in-production',
        },
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token tidak valid atau sudah kedaluwarsa',
      );
    }

    // Backward-compatible: old refresh token only has { sub }.
    // Also prevents access token payload from being used for refresh.
    const isLegacyRefreshToken =
      !verifiedPayload.tokenType &&
      !verifiedPayload.username &&
      !verifiedPayload.email &&
      !Array.isArray(verifiedPayload.roles) &&
      !Array.isArray(verifiedPayload.permissions);

    const isTypedRefreshToken = verifiedPayload.tokenType === 'refresh';

    if (
      !verifiedPayload.sub ||
      (!isTypedRefreshToken && !isLegacyRefreshToken)
    ) {
      throw new UnauthorizedException(
        'Refresh token tidak valid atau sudah kedaluwarsa',
      );
    }

    const userId = verifiedPayload.sub;
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Akun Anda tidak aktif');
    }

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code),
    );
    const uniquePermissions = [...new Set(permissions)];

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      permissions: uniquePermissions,
    };

    const accessTokenExpiresIn =
      this.configService.get<string>('jwt.accessTokenExpiresIn') || '15m';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiresIn as StringValue,
    });

    return {
      message: 'Token berhasil diperbarui',
      accessToken,
    };
  }

  async logout(accessToken: string, ipAddress?: string) {
    if (!accessToken) {
      throw new UnauthorizedException(
        'Token tidak valid atau sudah kedaluwarsa',
      );
    }

    const decoded = this.jwtService.decode(accessToken);
    const tokenPayload =
      decoded && typeof decoded === 'object'
        ? (decoded as { sub?: number; exp?: number })
        : null;

    if (!tokenPayload?.exp) {
      throw new UnauthorizedException(
        'Token tidak valid atau sudah kedaluwarsa',
      );
    }

    const expiresAtMs = tokenPayload.exp * 1000;
    if (expiresAtMs <= Date.now()) {
      throw new UnauthorizedException(
        'Token tidak valid atau sudah kedaluwarsa',
      );
    }

    // sisa waktu hidup token
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAtMs - Date.now()) / 1000),
    );

    // Simpan token jwt ke cache redis saat logout sebagai blacklist sampai token expired.
    await this.cacheService.setString(
      this.getBlacklistKey(accessToken),
      '1',
      ttlSeconds,
    );

    if (tokenPayload?.sub) {
      await this.auditTrailService.log({
        action: AuditAction.LOGOUT,
        entityName: 'User',
        entityId: tokenPayload.sub,
        userId: tokenPayload.sub,
        ipAddress,
      });
    }

    return {
      message: 'Logout berhasil',
    };
  }

  async isTokenBlacklisted(accessToken: string) {
    try {
      // Cek token di cache kalau ada nilai berarti token sudah tidak boleh dipakai
      const cached = await this.cacheService.getString(
        this.getBlacklistKey(accessToken),
      );
      return Boolean(cached);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Cache blacklist tidak tersedia, gunakan fail-open policy: ${message}`,
      );
      return false;
    }
  }

  // ==================== ROLE MANAGEMENT ====================
  async createRole(createRoleDto: CreateRoleDto, ipAddress?: string) {
    // Check if role already exists
    const existingRole = await this.authRepository.findRoleByName(
      createRoleDto.name,
    );

    if (existingRole) {
      throw new ConflictException('Role sudah ada');
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const created = await this.authRepository.createRole(createRoleDto, tx);
      await this.auditTrailService.log(
        {
          action: AuditAction.CREATE,
          entityName: 'Role',
          entityId: created.id,
          after: {
            name: created.name,
            description: created.description ?? null,
          },
          ipAddress,
        },
        tx,
      );
      return created;
    });

    return {
      message: 'Role berhasil dibuat',
      role,
    };
  }

  async getAllRoles() {
    const roles = await this.authRepository.findAllRoles();

    const summarizedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      totalUsers: role._count.users,
    }));

    return {
      message: 'Berhasil mengambil data role',
      data: summarizedRoles,
    };
  }

  async getRoleById(id: number) {
    const role = await this.authRepository.findRoleById(id);

    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    const permissions = role.permissions.map(
      (rolePermission) => rolePermission.permission.code,
    );
    const users = role.users.map((userRole) => userRole.user);

    return {
      message: 'Berhasil mengambil detail role',
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions,
        users,
      },
    };
  }

  async updateRole(
    id: number,
    updateRoleDto: UpdateRoleDto,
    ipAddress?: string,
  ) {
    const role = await this.authRepository.findRoleById(id);

    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    // Check if new name already exists (if name is being updated)
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.authRepository.findRoleByName(
        updateRoleDto.name,
      );

      if (existingRole) {
        throw new ConflictException('Nama role sudah digunakan');
      }
    }

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const updated = await this.authRepository.updateRole(
        id,
        updateRoleDto,
        tx,
      );
      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Role',
          entityId: updated.id,
          before: {
            name: role.name,
            description: role.description ?? null,
          },
          after: {
            name: updated.name,
            description: updated.description ?? null,
          },
          ipAddress,
        },
        tx,
      );
      return updated;
    });

    return {
      message: 'Role berhasil diperbarui',
      role: updatedRole,
    };
  }

  async deleteRole(id: number, userId?: number, ipAddress?: string) {
    const role = await this.authRepository.findRoleById(id);

    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    await this.authRepository.deleteRole(id);

    await this.auditTrailService.log({
      action: AuditAction.DELETE,
      entityName: 'Role',
      entityId: id,
      userId,
      before: {
        name: role.name,
        description: role.description ?? null,
      },
      after: null,
      ipAddress,
    });

    return {
      message: 'Role berhasil dihapus',
    };
  }

  // ==================== PERMISSION MANAGEMENT ====================
  async createPermission(
    createPermissionDto: CreatePermissionDto,
    ipAddress?: string,
  ) {
    // Check if permission already exists
    const existingPermission = await this.authRepository.findPermissionByCode(
      createPermissionDto.code,
    );

    if (existingPermission) {
      throw new ConflictException('Permission sudah ada');
    }

    const permission = await this.prisma.$transaction(async (tx) => {
      const created = await this.authRepository.createPermission(
        createPermissionDto,
        tx,
      );
      await this.auditTrailService.log(
        {
          action: AuditAction.CREATE,
          entityName: 'Permission',
          entityId: created.id,
          after: {
            code: created.code,
            description: created.description ?? null,
          },
          ipAddress,
        },
        tx,
      );
      return created;
    });

    return {
      message: 'Permission berhasil dibuat',
      permission,
    };
  }

  async getAllPermissions() {
    const permissions = await this.authRepository.findAllPermissions();

    const summarizedPermissions = permissions.map((permission) => ({
      id: permission.id,
      code: permission.code,
      description: permission.description,
    }));

    return {
      message: 'Berhasil mengambil data permission',
      data: summarizedPermissions,
    };
  }

  async deletePermission(id: number, userId?: number, ipAddress?: string) {
    const permission = await this.authRepository.findPermissionById(id);

    if (!permission) {
      throw new NotFoundException('Permission tidak ditemukan');
    }

    await this.authRepository.deletePermission(id);

    await this.auditTrailService.log({
      action: AuditAction.DELETE,
      entityName: 'Permission',
      entityId: id,
      userId,
      before: {
        code: permission.code,
        description: permission.description ?? null,
      },
      after: null,
      ipAddress,
    });

    return {
      message: 'Permission berhasil dihapus',
    };
  }

  // ==================== ROLE-PERMISSION ASSIGNMENT ====================
  async assignPermissionsToRole(
    roleId: number,
    assignPermissionsDto: AssignPermissionsDto,
    ipAddress?: string,
  ) {
    const role = await this.authRepository.findRoleById(roleId);

    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    // Verify all permissions exist
    for (const permissionId of assignPermissionsDto.permissionIds) {
      const permission =
        await this.authRepository.findPermissionById(permissionId);

      if (!permission) {
        throw new NotFoundException(
          `Permission dengan ID ${permissionId} tidak ditemukan`,
        );
      }
    }

    const beforeIds = role.permissions.map((rp) => rp.permissionId);
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.assignPermissionsToRole(
        roleId,
        assignPermissionsDto.permissionIds,
        tx,
      );
      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Role',
          entityId: roleId,
          before: { permissionIds: beforeIds },
          after: { permissionIds: assignPermissionsDto.permissionIds },
          ipAddress,
        },
        tx,
      );
    });

    return {
      message: 'Permission berhasil di-assign ke role',
    };
  }

  async removePermissionFromRole(
    roleId: number,
    permissionId: number,
    ipAddress?: string,
  ) {
    const role = await this.authRepository.findRoleById(roleId);

    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    const permission =
      await this.authRepository.findPermissionById(permissionId);

    if (!permission) {
      throw new NotFoundException('Permission tidak ditemukan');
    }

    const beforeIds = role.permissions.map((rp) => rp.permissionId);
    const afterIds = beforeIds.filter((id) => id !== permissionId);
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.removePermissionFromRole(
        roleId,
        permissionId,
        tx,
      );
      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Role',
          entityId: roleId,
          before: { permissionIds: beforeIds },
          after: { permissionIds: afterIds },
          ipAddress,
        },
        tx,
      );
    });

    return {
      message: 'Permission berhasil dihapus dari role',
    };
  }

  // ==================== USER-ROLE ASSIGNMENT ====================
  async assignRolesToUser(
    userId: number,
    assignRolesDto: AssignRolesDto,
    ipAddress?: string,
  ) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    // Verify all roles exist
    for (const roleId of assignRolesDto.roleIds) {
      const role = await this.authRepository.findRoleById(roleId);

      if (!role) {
        throw new NotFoundException(`Role dengan ID ${roleId} tidak ditemukan`);
      }
    }

    const beforeRoles = await this.authRepository.getUserRoles(userId);
    const beforeIds = beforeRoles.map((ur) => ur.roleId);
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.assignRolesToUser(
        userId,
        assignRolesDto.roleIds,
        tx,
      );
      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'User',
          entityId: userId,
          userId,
          before: { roleIds: beforeIds },
          after: { roleIds: assignRolesDto.roleIds },
          ipAddress,
        },
        tx,
      );
    });

    return {
      message: 'Role berhasil di-assign ke user',
    };
  }

  async removeRoleFromUser(userId: number, roleId: number, ipAddress?: string) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const role = await this.authRepository.findRoleById(roleId);

    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    const beforeRoles = await this.authRepository.getUserRoles(userId);
    const beforeIds = beforeRoles.map((ur) => ur.roleId);
    const afterIds = beforeIds.filter((id) => id !== roleId);
    await this.prisma.$transaction(async (tx) => {
      await this.authRepository.removeRoleFromUser(userId, roleId, tx);
      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'User',
          entityId: userId,
          userId,
          before: { roleIds: beforeIds },
          after: { roleIds: afterIds },
          ipAddress,
        },
        tx,
      );
    });

    return {
      message: 'Role berhasil dihapus dari user',
    };
  }

  async getUserRoles(userId: number) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const userRoles = await this.authRepository.getUserRoles(userId);

    const roles = userRoles.map((userRole) => userRole.role.name);
    const permissions = userRoles.flatMap((userRole) =>
      userRole.role.permissions.map(
        (rolePermission) => rolePermission.permission.code,
      ),
    );

    return {
      message: 'Berhasil mengambil role user',
      data: {
        userId,
        roles,
        permissions: [...new Set(permissions)],
      },
    };
  }
}
