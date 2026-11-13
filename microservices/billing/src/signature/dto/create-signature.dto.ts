import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSignatureDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    password!: string;

    /** En multipart llega como string JSON: '["uuid1","uuid2"]'. */
    @Transform(({ value }) => {
        try {
            return typeof value === 'string' ? [...new Set(JSON.parse(value) as string[])] : value;
        } catch {
            return value;
        }
    })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(50)
    @IsUUID('all', { each: true })
    branchIds!: string[];

    @IsUUID()
    clientRequestId!: string;
}