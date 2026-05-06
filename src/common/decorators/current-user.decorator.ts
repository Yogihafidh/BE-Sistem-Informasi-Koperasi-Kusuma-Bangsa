import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserFromJwt } from '../../modules/auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserFromJwt => {
    const request = ctx.switchToHttp().getRequest<{ user: UserFromJwt }>();
    return request.user;
  },
);
