// microservices/orders/src/order-payments/helpers/sign-payment-attachments.helper.ts
import { Attachment } from '../../order-findings/entities/attachment.entity';

// Interfaz mínima: tu AwsS3Service ya la cumple
interface PresignedUrlProvider {
    getPresignedUrl(fileUrl: string, expiresInSeconds: number): Promise<string>;
}

const DEFAULT_EXPIRATION_SECONDS = 1800;

/**
 * Firma las URLs de una lista de attachments (muta file_url).
 * Si falla uno, se loguea y se conserva el resto.
 */
export async function signAttachmentUrls(
    attachments: Attachment[],
    s3: PresignedUrlProvider,
    expiresInSeconds = DEFAULT_EXPIRATION_SECONDS,
): Promise<void> {
    await Promise.allSettled(
        attachments.map(async (att) => {
            try {
                att.file_url = await s3.getPresignedUrl(att.file_url, expiresInSeconds);
            } catch (err: any) {
                console.error(`[ERROR] Falló presigned PAYMENT attachment ${att.id}:`, err.message);
            }
        }),
    );
}
