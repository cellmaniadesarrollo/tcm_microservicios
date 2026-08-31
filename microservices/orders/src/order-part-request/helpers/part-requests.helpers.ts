import { Attachment } from '../../order-findings/entities/attachment.entity';
import { AwsS3Service } from '../../aws-s3/aws-s3.service';

/**
 * Mapea un usuario a un DTO reducido, exponiendo solo los campos
 * necesarios para el frontend (evita filtrar el objeto completo).
 */
export function mapUser(u: any) {
    if (!u) return undefined;
    return {
        id: u.id,
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        ...(u.dni !== undefined && { dni: u.dni }),
        ...(u.email !== undefined && { email: u.email }),
        ...(u.phone !== undefined && { phone: u.phone }),
    };
}

/**
 * Enriquece los adjuntos de una lista de part requests con URLs firmadas de S3.
 * Muta los objetos `attachments` in-place (mismo comportamiento que antes).
 */
export async function enrichPartRequestAttachmentsWithSignedUrls(
    partRequests: Array<{ id: number; attachments?: Attachment[] }>,
    awsS3Service: AwsS3Service,
) {
    const promises: Promise<void>[] = [];

    for (const pr of partRequests) {
        if (pr.attachments?.length) {
            for (const att of pr.attachments) {
                promises.push(
                    awsS3Service
                        .getPresignedUrl(att.file_url, 1800)
                        .then((signed) => { att.file_url = signed; })
                        .catch((err) => {
                            console.error(`[ERROR] Falló presigned PART_REQUEST ${att.id}:`, err.message);
                        }),
                );
            }
        }
    }

    await Promise.allSettled(promises);
}