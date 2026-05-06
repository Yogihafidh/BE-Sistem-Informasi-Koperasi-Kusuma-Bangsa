import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Password lama pengguna',
    example: 'OldPassword123!',
  })
  @IsNotEmpty({ message: 'Password lama tidak boleh kosong' })
  @IsString({ message: 'Password lama harus berupa string' })
  oldPassword: string;

  @ApiProperty({
    description:
      'Password baru (minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, dan angka/simbol)',
    example: 'NewPassword123!',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'Password baru tidak boleh kosong' })
  @IsString({ message: 'Password baru harus berupa string' })
  @MinLength(8, { message: 'Password baru minimal 8 karakter' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password baru harus mengandung huruf besar, huruf kecil, dan angka/simbol',
  })
  newPassword: string;

  @ApiProperty({
    description: 'Konfirmasi password baru (harus sama dengan password baru)',
    example: 'NewPassword123!',
  })
  @IsNotEmpty({ message: 'Konfirmasi password tidak boleh kosong' })
  @IsString({ message: 'Konfirmasi password harus berupa string' })
  confirmPassword: string;
}
