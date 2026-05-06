import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    description: 'Username pengguna',
    example: 'johndoe',
    required: false,
    minLength: 3,
  })
  @IsOptional()
  @IsString({ message: 'Username harus berupa string' })
  @MinLength(3, { message: 'Username minimal 3 karakter' })
  username?: string;

  @ApiProperty({
    description: 'Email pengguna',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email tidak valid' })
  email?: string;

  @ApiProperty({
    description:
      'Password baru (minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, angka, dan simbol)',
    example: 'NewPassword123!',
    required: false,
    minLength: 8,
  })
  @IsOptional()
  @IsString({ message: 'Password harus berupa string' })
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
    {
      message:
        'Password harus mengandung huruf besar, huruf kecil, angka, dan simbol',
    },
  )
  password?: string;

  @ApiProperty({
    description: 'Status aktif pengguna (true = aktif, false = nonaktif)',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive harus berupa boolean' })
  isActive?: boolean;
}
