import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
    const raw = process.env.MAIL_ENCRYPTION_KEY;
    if (!raw) throw new Error('MAIL_ENCRYPTION_KEY no está definida');
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('MAIL_ENCRYPTION_KEY debe ser 32 bytes en base64');
    return key;
}

/** Formato: iv.tag.cifrado (base64) */
export function encryptSecret(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(payload: string): string {
    const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}