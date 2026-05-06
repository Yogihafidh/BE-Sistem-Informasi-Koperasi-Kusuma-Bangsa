import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertSettingDto {
  @ApiProperty({
    description: 'Nilai setting dalam format string',
    example: '24',
  })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiPropertyOptional({
    description: 'Deskripsi setting',
    example: 'Maksimum tenor pinjaman dalam bulan',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
