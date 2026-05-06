import { JenisDokumen, NasabahStatus, Prisma } from '@prisma/client';

class NasabahPegawaiDto {
  id!: number;
  nama!: string;
  jabatan!: string;
}

class NasabahUserDto {
  id!: number;
  username!: string;
  email!: string;
}

class NasabahDokumenDto {
  id!: number;
  nasabahId!: number;
  jenisDokumen!: JenisDokumen;
  fileUrl!: string;
  uploadedAt!: Date;
}

export class NasabahDetailDto {
  id!: number;
  userId!: number | null;
  pegawaiId!: number;
  nomorAnggota!: string;
  nama!: string;
  nik!: string;
  alamat!: string;
  noHp!: string;
  pekerjaan!: string;
  instansi!: string | null;
  penghasilanBulanan!: Prisma.Decimal;
  tanggalLahir!: Date;
  tanggalDaftar!: Date;
  status!: NasabahStatus;
  catatan!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
  pegawai!: NasabahPegawaiDto;
  user!: NasabahUserDto | null;
  dokumen!: NasabahDokumenDto[];
}
