import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class SignatureCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    // SIGNATURE_ENC_KEY: 32 bytes en base64 (openssl rand -base64 32)
    this.key = Buffer.from(config.getOrThrow<string>('SIGNATURE_ENC_KEY'), 'base64');
    if (this.key.length !== 32) throw new Error('SIGNATURE_ENC_KEY debe tener 32 bytes');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join(':');
  }

  decrypt(payload: string): string {
    const [iv, tag, data] = payload.split(':').map(p => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}