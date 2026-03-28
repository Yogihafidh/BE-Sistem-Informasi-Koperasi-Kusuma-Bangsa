import { BadRequestException } from '@nestjs/common';

export function validateBidirectionalPaginationParams(
  after?: number,
  before?: number,
) {
  if (typeof after === 'number' && typeof before === 'number') {
    throw new BadRequestException(
      "Query parameter 'after' dan 'before' tidak boleh digunakan bersamaan",
    );
  }
}
