import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { JenisDokumen } from '@prisma/client';

export class UploadDokumenDto {
  @ApiProperty({
    description: 'Jenis dokumen nasabah',
    enum: JenisDokumen,
    example: 'KTP',
  })
  @IsEnum(JenisDokumen)
  jenisDokumen: JenisDokumen;
}
