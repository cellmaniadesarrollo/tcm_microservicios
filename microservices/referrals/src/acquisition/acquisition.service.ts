import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HowArrived, CustomerAcquisition } from './entities/customer-acquisition.entity';
import { AcqPlatform } from './platforms/entities/acq-platform.entity';
import { AcqChannel } from './channels/entities/acq-channel.entity';
import { AcqCampaign } from './campaigns/entities/acq-campaign.entity';
import { AcqPublication } from './publications/entities/acq-publication.entity';
import { ReferralProfile } from '../referral-profiles/entities/referral-profile.entity';
import { CustomerCache } from '../customers-events/entities/customer-cache.entity';
import {
  ClaimSource, ClaimStatus, ReferralClaim,
} from '../referral-claims/entities/referral-claim.entity';

export interface SaveAcquisitionInput {
  companyId: string;
  userId: string;
  customerId: string;
  howArrived: HowArrived;
  platformId?: string;
  channelId?: string;
  publicationId?: string;
  notRemembered?: boolean;
  otherText?: string;
  referrer?: { customerId: string; source: 'CODE' | 'QR' | 'SEARCH' };
  referrerPending?: boolean;
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class AcquisitionService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(AcqPlatform) private readonly platforms: Repository<AcqPlatform>,
    @InjectRepository(AcqChannel) private readonly channels: Repository<AcqChannel>,
    @InjectRepository(AcqCampaign) private readonly campaigns: Repository<AcqCampaign>,
    @InjectRepository(AcqPublication) private readonly publications: Repository<AcqPublication>,
    @InjectRepository(ReferralProfile) private readonly profiles: Repository<ReferralProfile>,
    @InjectRepository(CustomerCache) private readonly cache: Repository<CustomerCache>,
  ) {}

  /** Plataforma → canal → publicaciones, armado con las relaciones reales */
  async getCatalog(companyId: string) {
    const where = { companyId, active: true };
    const [platforms, channels, campaigns, publications] = await Promise.all([
      this.platforms.find({ where, order: { name: 'ASC' } }),
      this.channels.find({ where, order: { name: 'ASC' } }),
      this.campaigns.find({ where }),
      this.publications.find({ where, order: { title: 'ASC' } }),
    ]);
    const channelById = new Map(channels.map((c) => [c.id, c]));

    return platforms.map((p) => {
      const byChannel = new Map<string, { id: string; title: string }[]>();
      const touch = (channelId: string | null) => {
        if (channelId && channelById.has(channelId) && !byChannel.has(channelId)) {
          byChannel.set(channelId, []);
        }
      };
      campaigns.filter((c) => c.platformId === p.id).forEach((c) => touch(c.channelId));
      publications
        .filter((x) => x.platformId === p.id)
        .forEach((x) => {
          touch(x.channelId);
          if (x.channelId && byChannel.has(x.channelId)) {
            byChannel.get(x.channelId)!.push({ id: x.id, title: x.title });
          }
        });

      return {
        id: p.id,
        name: p.name,
        channels: [...byChannel].map(([id, pubs]) => ({
          id, name: channelById.get(id)!.name, publications: pubs,
        })),
      };
    });
  }

  /** Solo id y nombre/apellido, nunca contactos */
  async findReferrerByCode(companyId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return null;

    const profile = await this.profiles.findOne({ where: { companyId, code } });
    if (!profile) return null;

    const c = await this.cache.findOne({
      where: { customerId: profile.customerId, companyId },
    });

    return {
      customerId: profile.customerId,
      firstName: c?.firstName ?? '',
      lastName: c?.lastName ?? '',
      idNumber: c?.idNumber ?? null,
    };
  }

  /** Solo clientes que ya tienen código de referido */
  async searchReferrers(companyId: string, q: string) {
    const tokens = norm(q ?? '').split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.join('').length < 2) return [];

    const qb = this.cache
      .createQueryBuilder('c')
      .where('c.company_id = :companyId', { companyId });

    tokens.forEach((t, i) => {
      qb.andWhere(`c.search_text LIKE :t${i}`, { [`t${i}`]: `%${escapeLike(t)}%` });
    });

    const rows = await qb.orderBy('c.first_name', 'ASC').limit(8).getMany();

    return rows.map((c) => ({
      customerId: c.customerId,
      firstName: c.firstName,
      lastName: c.lastName,
      idNumber: c.idNumber,
    }));
  }

  async save(i: SaveAcquisitionInput) {
    let platformId: string | null = null;
    let channelId: string | null = null;
    let campaignId: string | null = null;
    let publicationId: string | null = null;

    if (i.howArrived === HowArrived.SOCIAL) {
      if (!i.platformId || !i.channelId) throw new BadRequestException('Falta plataforma o canal');
      const [pl, ch] = await Promise.all([
        this.platforms.findOneBy({ id: i.platformId, companyId: i.companyId }),
        this.channels.findOneBy({ id: i.channelId, companyId: i.companyId }),
      ]);
      if (!pl || !ch) throw new BadRequestException('Plataforma o canal inválido');
      platformId = pl.id;
      channelId = ch.id;

      if (!i.notRemembered) {
        if (!i.publicationId) throw new BadRequestException('Falta la publicación');
        const pub = await this.publications.findOneBy({ id: i.publicationId, companyId: i.companyId });
        if (!pub || pub.platformId !== platformId || pub.channelId !== channelId) {
          throw new BadRequestException('Publicación inválida');
        }
        publicationId = pub.id;
        campaignId = pub.campaignId;
      }
    }

    let referrerId: string | null = null;
    if (i.howArrived === HowArrived.REFERRED && !i.referrerPending) {
      referrerId = i.referrer?.customerId ?? null;
      if (!referrerId) throw new BadRequestException('Falta el recomendador');
      if (referrerId === i.customerId) throw new BadRequestException('Un cliente no puede recomendarse a sí mismo');
      const ok = await this.profiles.exist({ where: { customerId: referrerId, companyId: i.companyId } });
      if (!ok) throw new BadRequestException('El recomendador no tiene código de referido');
    }

    await this.ds.transaction(async (m) => {
      try {
        await m.insert(CustomerAcquisition, {  // ← entidad nueva
          companyId: i.companyId,
          // orderId eliminado
          customerId: i.customerId,
          howArrived: i.howArrived,
          platformId, channelId, campaignId, publicationId,
          notRemembered: !!i.notRemembered && i.howArrived === HowArrived.SOCIAL,
          otherText: i.howArrived === HowArrived.OTHER ? (i.otherText ?? '').trim().slice(0, 255) || null : null,
          registeredBy: i.userId,
        });
      } catch (e: any) {
        if (e?.code === '23505') throw new ConflictException('El cliente ya tiene origen registrado');
        throw e;
      }

      if (i.howArrived === HowArrived.REFERRED) {
        await m.createQueryBuilder().insert().into(ReferralClaim).values({
          companyId: i.companyId,
          referredCustomerId: i.customerId,
          referrerCustomerId: referrerId,
          status: referrerId ? ClaimStatus.CONFIRMED : ClaimStatus.PENDING_IDENTIFICATION,
          source: referrerId ? ClaimSource[i.referrer!.source] : ClaimSource.STAFF,
          confirmedAt: referrerId ? new Date() : null,
        }).orIgnore().execute();
      }
    });
    return { ok: true };
  }
}