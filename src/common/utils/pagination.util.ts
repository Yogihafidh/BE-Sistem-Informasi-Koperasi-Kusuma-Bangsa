import { BadRequestException } from '@nestjs/common';

const MAX_DB_INT = 2147483647;

function validatePaginationCursorValue(
  paramName: 'after' | 'before',
  value: number,
) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_DB_INT) {
    throw new BadRequestException(
      `Query parameter '${paramName}' harus berupa integer antara 1 dan ${MAX_DB_INT}`,
    );
  }
}

export function validateBidirectionalPaginationParams(
  after?: number,
  before?: number,
) {
  if (typeof after === 'number' && typeof before === 'number') {
    throw new BadRequestException(
      "Query parameter 'after' dan 'before' tidak boleh digunakan bersamaan",
    );
  }

  if (typeof after === 'number') {
    validatePaginationCursorValue('after', after);
  }

  if (typeof before === 'number') {
    validatePaginationCursorValue('before', before);
  }
}
