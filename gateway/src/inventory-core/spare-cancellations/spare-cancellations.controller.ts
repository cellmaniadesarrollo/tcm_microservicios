import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, ValidationPipe } from '@nestjs/common';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { ListSpareCancellationsQueryDto } from './dto/list-spare-cancellations-query.dto';
import { SpareCancellationsService } from './spare-cancellations.service';
import { RejectSpareCancellationDto } from './dto/reject-spare-cancellation.dto';
import { ApproveSpareCancellationDto } from './dto/approve-spare-cancellation.dto';

@Controller('inventory-core/spare-cancellations')
@Auth()
export class SpareCancellationsController {
    constructor(private readonly service: SpareCancellationsService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    // GET /inventory-core/spare-cancellations?status=PENDING&search=...&page=1&limit=20
    @Get()
    list(
        @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
        query: ListSpareCancellationsQueryDto,
        @User() user: any,
    ) {
        return this.service.list(query, this.ctx(user));
    }
    // POST /inventory-core/spare-cancellations/:id/reject
    @Post(':id/reject')
    reject(
        @Param('id', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('La solicitud no es válida') }))
        id: string,
        @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
        dto: RejectSpareCancellationDto,
        @User() user: any,
    ) {
        return this.service.reject(id, dto, this.ctx(user));
    }
    // POST /inventory-core/spare-cancellations/:id/approve
    @Post(':id/approve')
    approve(
        @Param('id', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('La solicitud no es válida') }))
        id: string,
        @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
        dto: ApproveSpareCancellationDto,
        @User() user: any,
    ) {
        return this.service.approve(id, dto, this.ctx(user));
    }
}