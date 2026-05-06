import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'Nama role',
    example: 'Senior Manager',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Deskripsi role',
    example: 'Role untuk senior manager koperasi',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
