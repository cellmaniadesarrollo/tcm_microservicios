import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrintEndpoint } from './entities/print-endpoint.entity';

const ALLOWED_HOSTS = ['.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.trycloudflare.com', '.teamcellmania.com'];
const norm = (c: string) => String(c).padStart(3, '0');

@Injectable()
export class PrintEndpointsService {
  constructor(@InjectRepository(PrintEndpoint) private readonly repo: Repository<PrintEndpoint>) {}

  private isAllowedUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && ALLOWED_HOSTS.some((h) => u.hostname.endsWith(h));
    } catch {
      return false;
    }
  }

  async save(companyId: string, code: string, url: string) {
    if (!this.isAllowedUrl(url)) throw new BadRequestException('URL no permitida');
    const clean = url.replace(/\/+$/, '');
    await this.repo.upsert(
      { companyId, codeEstablecimiento: norm(code), url: clean },
      ['companyId', 'codeEstablecimiento'],
    );
    return { success: true, url: clean };
  }

  async get(companyId: string, code: string) {
      const doc = await this.repo.findOne({
          where: { companyId, codeEstablecimiento: norm(code) },
      });
      if (!doc) {
          // fallback: cualquier endpoint de esa empresa
          const fallback = await this.repo.findOne({ where: { companyId } });
          if (!fallback) throw new NotFoundException('No hay URL de impresión registrada');
          return { url: fallback.url, updatedAt: fallback.updatedAt };
      }
      return { url: doc.url, updatedAt: doc.updatedAt };
  }
}