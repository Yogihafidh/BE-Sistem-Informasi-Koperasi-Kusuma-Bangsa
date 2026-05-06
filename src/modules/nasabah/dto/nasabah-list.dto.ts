import { NasabahStatus } from '@prisma/client';

export class NasabahListDto {
  id!: number;
  nomorAnggota!: string;
  nama!: string;
  nik!: string;
  noHp!: string;
  pekerjaan!: string;
  instansi!: string | null;
  status!: NasabahStatus;
  tanggalDaftar!: Date;
}
