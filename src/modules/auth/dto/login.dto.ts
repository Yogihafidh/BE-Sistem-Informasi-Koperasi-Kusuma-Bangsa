import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username atau email untuk login',
    example: 'johndoe',
  })
  @IsNotEmpty({ message: 'Username atau email tidak boleh kosong' })
  @IsString({ message: 'Username atau email harus berupa string' })
  usernameOrEmail: string;

  @ApiProperty({
    description: 'Password pengguna',
    example: 'Password123!',
  })
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @IsString({ message: 'Password harus berupa string' })
  password: string;
}
