import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderProductImagesDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsUUID('4', { each: true, message: 'Cada id de imagen debe ser un UUID válido' })
    imageIds!: string[];
}