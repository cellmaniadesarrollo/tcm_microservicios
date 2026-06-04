// task-board/src/images/images.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { ImagesController } from './images.controller';
import { ImagesTcpController } from './images-tcp.controller';
import { ImagesService } from './images.service';
import { TaskImage } from './entities/task-image.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskImage]),
    AwsS3Module,
  ],
  controllers: [ImagesController, ImagesTcpController],  // ← Debe estar aquí
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}