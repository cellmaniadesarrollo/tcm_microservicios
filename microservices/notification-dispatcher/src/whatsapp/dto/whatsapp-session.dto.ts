// whatsapp-session.dto.ts
export class CreateSessionDto {
    routingId!: string; // UUID del WhatsappRouting
}

export class UpdateSessionDto {
    sessionId!: string;
    routingId!: string;
}