import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { buildErrorExample } from '../swagger/examples';

export const ApiBadRequestExample = (message = 'Data tidak valid') =>
  ApiResponse({
    status: 400,
    description: message,
    content: {
      'application/json': {
        example: buildErrorExample(400, message, 'Bad Request'),
      },
    },
  });

export const ApiUnauthorizedExample = (
  message = 'Unauthorized - Token tidak valid',
) =>
  ApiResponse({
    status: 401,
    description: message,
    content: {
      'application/json': {
        example: buildErrorExample(401, message, 'Unauthorized'),
      },
    },
  });

export const ApiForbiddenExample = (message = 'Forbidden') =>
  ApiResponse({
    status: 403,
    description: message,
    content: {
      'application/json': {
        example: buildErrorExample(403, message, 'Forbidden'),
      },
    },
  });

export const ApiNotFoundExample = (message = 'Data tidak ditemukan') =>
  ApiResponse({
    status: 404,
    description: message,
    content: {
      'application/json': {
        example: buildErrorExample(404, message, 'Not Found'),
      },
    },
  });

export const ApiConflictExample = (message = 'Data sudah ada') =>
  ApiResponse({
    status: 409,
    description: message,
    content: {
      'application/json': {
        example: buildErrorExample(409, message, 'Conflict'),
      },
    },
  });

export const ApiAuthErrors = () =>
  applyDecorators(
    ApiUnauthorizedExample('Unauthorized - Token tidak valid'),
    ApiForbiddenExample('Forbidden - Tidak memiliki permission'),
  );
