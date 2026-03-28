import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, PrismaClient } from '@prisma/client';
import { PegawaiListRow, PegawaiRepository } from './pegawai.repository';
import {
  CreatePegawaiDto,
  PegawaiDetailDto,
  PegawaiListDto,
  UpdatePegawaiDto,
  TogglePegawaiStatusDto,
} from './dto';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';
import { AuditTrailService } from '../audit/audit.service';

@Injectable()
export class PegawaiService {
  constructor(
    private readonly pegawaiRepository: PegawaiRepository,
    private readonly auditTrailService: AuditTrailService,
    private readonly prisma: PrismaClient,
  ) {}

  private pickPegawaiAuditFields(data: {
    userId: number;
    nama: string;
    jabatan: string;
    noHp: string;
    alamat: string;
    statusAktif?: boolean;
  }) {
    return {
      userId: data.userId,
      nama: data.nama,
      jabatan: data.jabatan,
      noHp: data.noHp,
      alamat: data.alamat,
      statusAktif: data.statusAktif ?? true,
    };
  }

  private toPegawaiListDto(item: PegawaiListRow): PegawaiListDto {
    return {
      id: item.id,
      userId: item.userId,
      nama: item.nama,
      jabatan: item.jabatan,
      noHp: item.noHp,
      alamat: item.alamat,
      statusAktif: item.statusAktif,
    };
  }

  async createPegawai(
    dto: CreatePegawaiDto,
    actorUserId: number,
    ipAddress?: string,
  ) {
    const user = await this.pegawaiRepository.findUserById(dto.userId);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const existingPegawai = await this.pegawaiRepository.findPegawaiByUserId(
      dto.userId,
    );
    if (existingPegawai) {
      throw new ConflictException('User sudah terdaftar sebagai pegawai');
    }

    const pegawai = await this.prisma.$transaction(async (tx) => {
      const created = await this.pegawaiRepository.createPegawai(
        {
          userId: dto.userId,
          nama: dto.nama,
          jabatan: dto.jabatan,
          noHp: dto.noHp,
          alamat: dto.alamat,
        },
        tx,
      );

      await this.auditTrailService.log(
        {
          action: AuditAction.CREATE,
          entityName: 'Pegawai',
          entityId: created.id,
          userId: actorUserId,
          after: this.pickPegawaiAuditFields({
            userId: created.userId,
            nama: created.nama,
            jabatan: created.jabatan,
            noHp: created.noHp,
            alamat: created.alamat,
            statusAktif: created.statusAktif,
          }),
          ipAddress,
        },
        tx,
      );

      return created;
    });

    return {
      message: 'Pegawai berhasil dibuat',
      data: pegawai,
    };
  }

  async getAllPegawai(args: { after?: number; before?: number }) {
    validateBidirectionalPaginationParams(args.after, args.before);

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.pegawaiRepository.findAllPegawai({
        after: args.after,
        before: args.before,
        take: DEFAULT_PAGE_SIZE,
      });

    return {
      message: 'Berhasil mengambil data pegawai',
      data: data.map((item) => this.toPegawaiListDto(item)),
      pagination: {
        nextCursor,
        prevCursor,
        limit: DEFAULT_PAGE_SIZE,
        hasNext,
        hasPrev,
      },
    };
  }

  async getPegawaiById(id: number) {
    const pegawai = await this.pegawaiRepository.findPegawaiById(id);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    return {
      message: 'Berhasil mengambil data pegawai',
      data: pegawai as PegawaiDetailDto,
    };
  }

  async updatePegawai(
    id: number,
    dto: UpdatePegawaiDto,
    actorUserId: number,
    ipAddress?: string,
  ) {
    const pegawai = await this.pegawaiRepository.findPegawaiById(id);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.pegawaiRepository.updatePegawai(id, dto, tx);
      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Pegawai',
          entityId: id,
          userId: actorUserId,
          before: this.pickPegawaiAuditFields({
            userId: pegawai.userId,
            nama: pegawai.nama,
            jabatan: pegawai.jabatan,
            noHp: pegawai.noHp,
            alamat: pegawai.alamat,
            statusAktif: pegawai.statusAktif,
          }),
          after: this.pickPegawaiAuditFields({
            userId: result.userId,
            nama: result.nama,
            jabatan: result.jabatan,
            noHp: result.noHp,
            alamat: result.alamat,
            statusAktif: result.statusAktif,
          }),
          ipAddress,
        },
        tx,
      );
      return result;
    });
    return {
      message: 'Pegawai berhasil diperbarui',
      data: updated,
    };
  }

  async updatePegawaiStatus(
    id: number,
    dto: TogglePegawaiStatusDto,
    actorUserId: number,
    ipAddress?: string,
  ) {
    const pegawai = await this.pegawaiRepository.findPegawaiById(id);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.pegawaiRepository.updatePegawaiStatus(
        id,
        dto.statusAktif,
        tx,
      );
      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Pegawai',
          entityId: id,
          userId: actorUserId,
          before: { statusAktif: pegawai.statusAktif },
          after: { statusAktif: result.statusAktif },
          ipAddress,
        },
        tx,
      );
      return result;
    });

    return {
      message: 'Status pegawai berhasil diperbarui',
      data: updated,
    };
  }
}
