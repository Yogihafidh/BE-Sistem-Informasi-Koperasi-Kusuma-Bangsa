import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Nama role',
    example: 'Manager',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Deskripsi role',
    example: 'Role untuk manager koperasi',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
