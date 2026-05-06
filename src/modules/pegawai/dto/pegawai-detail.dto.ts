class PegawaiDetailUserDto {
  id!: number;
  username!: string;
  email!: string;
}

export class PegawaiDetailDto {
  id!: number;
  userId!: number;
  nama!: string;
  jabatan!: string;
  noHp!: string;
  alamat!: string;
  statusAktif!: boolean;
  createdAt!: Date;
  user!: PegawaiDetailUserDto;
}
