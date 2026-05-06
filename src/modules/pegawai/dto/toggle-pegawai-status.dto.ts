import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class TogglePegawaiStatusDto {
  @ApiProperty({
    description: 'Status aktif pegawai',
    example: true,
  })
  @IsBoolean()
  statusAktif: boolean;
}
