import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  // Create a new user
  async createUser(data: {
    username: string;
    email: string;
    password: string;
  }) {
    return this.prisma.user.create({
      data,
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Find users based on username
  async findUserByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // Find users based on email
  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // Find users based on ID
  async findUserById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        pegawai: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
            noHp: true,
            alamat: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // Find users based on username or email
  async findUserByUsernameOrEmail(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
      include: {
        pegawai: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
            noHp: true,
            alamat: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // Update user password
  async updateUserPassword(
    userId: number,
    hashedPassword: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });
  }

  // Update user details
  async updateUser(
    userId: number,
    data: {
      username?: string;
      email?: string;
      password?: string;
      isActive?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Update last login timestamp
  async updateLastLogin(
    userId: number,
    lastLoginAt: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.user.update({
      where: { id: userId },
      data: { lastLoginAt },
    });
  }

  // Create a new role
  async createRole(
    data: { name: string; description?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.role.create({
      data,
    });
  }

  // Find all roles
  async findAllRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  // Find role by ID
  async findRoleById(id: number) {
    return this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  // Find role by name
  async findRoleByName(name: string) {
    return this.prisma.role.findUnique({
      where: { name },
    });
  }

  // Update role details
  async updateRole(
    id: number,
    data: { name?: string; description?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.role.update({
      where: { id },
      data,
    });
  }

  // Delete role
  async deleteRole(id: number, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    return client.role.delete({
      where: { id },
    });
  }

  // Create a new permission
  async createPermission(
    data: { code: string; description?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.permission.create({
      data,
    });
  }

  // Find all permissions
  async findAllPermissions() {
    return this.prisma.permission.findMany();
  }

  // Find permission by ID
  async findPermissionById(id: number) {
    return this.prisma.permission.findUnique({
      where: { id },
    });
  }

  // Find permission by code
  async findPermissionByCode(code: string) {
    return this.prisma.permission.findUnique({
      where: { code },
    });
  }

  // Delete permission
  async deletePermission(id: number, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    return client.permission.delete({
      where: { id },
    });
  }

  // Assign permissions to role
  async assignPermissionsToRole(
    roleId: number,
    permissionIds: number[],
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    // Delete existing permissions for the role
    await client.rolePermission.deleteMany({
      where: { roleId },
    });

    // Create new permissions
    const data = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    return client.rolePermission.createMany({
      data,
    });
  }

  // Remove permission from role
  async removePermissionFromRole(
    roleId: number,
    permissionId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });
  }

  // Assign roles to user
  async assignRolesToUser(
    userId: number,
    roleIds: number[],
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    // Delete existing roles for the user
    await client.userRole.deleteMany({
      where: { userId },
    });

    // Create new roles
    const data = roleIds.map((roleId) => ({
      userId,
      roleId,
    }));

    return client.userRole.createMany({
      data,
    });
  }

  // Remove role from user
  async removeRoleFromUser(
    userId: number,
    roleId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  }

  // Get roles of a user along with their permissions
  async getUserRoles(userId: number) {
    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }
}
