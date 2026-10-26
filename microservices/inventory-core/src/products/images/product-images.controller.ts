import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductImagesService, UploadedFilePayload, UserCtx } from './product-images.service';

@Controller()
export class ProductImagesController {

    constructor(private readonly service: ProductImagesService) { }

    @MessagePattern({ cmd: 'add_product_images' })
    add(@Payload() p: { productId: string; files: UploadedFilePayload[]; user: UserCtx }) {
        return this.service.addImages(p.productId, p.files, p.user);
    }

    @MessagePattern({ cmd: 'list_product_images' })
    list(@Payload() p: { productId: string; user: UserCtx }) {
        return this.service.list(p.productId, p.user.companyId);
    }

    // setPrimary, reorder y remove ahora reciben el usuario completo (para la auditoría)
    @MessagePattern({ cmd: 'set_primary_product_image' })
    setPrimary(@Payload() p: { productId: string; imageId: string; user: UserCtx }) {
        return this.service.setPrimary(p.productId, p.imageId, p.user);
    }

    @MessagePattern({ cmd: 'reorder_product_images' })
    reorder(@Payload() p: { productId: string; imageIds: string[]; user: UserCtx }) {
        return this.service.reorder(p.productId, p.imageIds, p.user);
    }

    @MessagePattern({ cmd: 'remove_product_image' })
    remove(@Payload() p: { productId: string; imageId: string; user: UserCtx }) {
        return this.service.remove(p.productId, p.imageId, p.user);
    }
}