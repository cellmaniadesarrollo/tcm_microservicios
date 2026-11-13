import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { Signature } from './entities/signature.entity';
import { SignatureBranch } from './entities/signature-branch.entity';
import { SignatureCryptoService } from './services/signature-crypto.service';
import { SignaturesController } from './controllers/signatures.controller';
import { SignaturesService } from './services/signatures.service';

@Module({
    imports: [TypeOrmModule.forFeature([Signature, SignatureBranch]), AwsS3Module],
    controllers: [SignaturesController],
    providers: [SignaturesService, SignatureCryptoService],
    exports: [SignaturesService], // el servicio que firma facturas lo necesitará
})
export class SignaturesModule {}