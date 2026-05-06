import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Kode permission (unik)',
    example: 'MANAGE_REPORTS',
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Deskripsi permission',
    example: 'Dapat mengelola laporan koperasi',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
