//orders/dto/delete-order-note-gateway.dto.ts
import { IsNotEmpty, IsNumber } from 'class-validator';

export class DeleteOrderNoteGatewayDto {
    @IsNumber()
    @IsNotEmpty()
    note_id: number;
}