// common/auth/decorators/user-groups.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserGroups = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string[] => {
        const request = ctx.switchToHttp().getRequest();
        return request.user?.groups ?? [];
    },
);