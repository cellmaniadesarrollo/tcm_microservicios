// receipts.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { User } from '../../common/auth/decorators/user.decorator';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { ReceiptsService } from './receipts.service';
import { SearchReceiptProductsQueryDto } from './dto/search-receipt-products-query.dto';
import { SearchSuppliersQueryDto } from './dto/search-suppliers-query.dto';

@Controller('receipts')
@Auth()
export class ReceiptsController {
    constructor(private readonly receiptsService: ReceiptsService) { }

    private ctx(user: any) {
        return { userId: user.sub, companyId: user.companyId, branchId: user.branchId };
    }

    @Get('new-data')
    async getNewData(@User() user: any) {
        return this.receiptsService.getNewData(this.ctx(user));
    }
    @Get('products')
    async searchProducts(@Query() query: SearchReceiptProductsQueryDto, @User() user: any) {
        return this.receiptsService.searchProducts(query, this.ctx(user));
    }
    @Get('search')
    async search(@Query() query: SearchSuppliersQueryDto, @User() user: any) {
        return this.receiptsService.search(query, this.ctx(user));
    }
}