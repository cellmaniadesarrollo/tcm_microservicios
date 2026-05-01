export interface INotificationChannel {
    send(recipient: string, message: string): Promise<void>;
}

export const CHANNEL_WHATSAPP = 'CHANNEL_WHATSAPP';