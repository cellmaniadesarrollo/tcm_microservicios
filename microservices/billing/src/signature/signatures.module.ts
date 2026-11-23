import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Module } from '../aws-s3/aws-s3.module';
import { Signature } from './entities/signature.entity';
import { SignatureBranch } from './entities/signature-branch.entity';
import { SignatureCryptoService } from './services/signature-crypto.service';
import { SignaturesController } from './controllers/signatures.controller';
import { SignaturesService } from './services/signatures.service';
import { BranchReplica } from '../companies/entities/branch-replica.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Signature, SignatureBranch, BranchReplica]), AwsS3Module],
    controllers: [SignaturesController],
    providers: [SignaturesService, SignatureCryptoService],
    exports: [SignaturesService, SignatureCryptoService], // SigningService (documents) usa el cifrado
})
export class SignaturesModule {}