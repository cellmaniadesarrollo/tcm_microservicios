import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ReferralClaim } from './entities/referral-claim.entity';
import { ReferralProfile } from '../referral-profiles/entities/referral-profile.entity';
import { CustomerCache } from '../customers-events/entities/customer-cache.entity';

// Hasta definir la equivalencia, cada referido válido = 1 punto
const POINTS_PER_REFERRAL = 1;
// Estados que cuentan como puntos (ajústalos a tu flujo)
const POINT_STATUSES = ['CONFIRMED', 'REWARDED'];

@Injectable()
export class ReferralClaimsService {
  constructor(
    @InjectRepository(ReferralClaim)
    private readonly claimRepo: Repository<ReferralClaim>,
    @InjectRepository(ReferralProfile)
    private readonly profileRepo: Repository<ReferralProfile>,
    @InjectRepository(CustomerCache)
    private readonly customerRepo: Repository<CustomerCache>,
  ) {}

  async findByReferrerDocument(companyId: string, document: string) {
    // 1. Cédula -> cliente
    const customer = await this.customerRepo.findOne({
      where: { companyId, idNumber: document },
    });
    // 2. Cliente -> perfil de referidor
    const profile = customer
      ? await this.profileRepo.findOne({
          where: { companyId, customerId: customer.customerId },
        })
      : null;

    // Mismo mensaje en ambos casos para no revelar qué cédulas existen
    if (!customer || !profile) {
      throw new NotFoundException('Referidor no encontrado');
    }

    // 3. Referidos de ese cliente
    const claims = await this.claimRepo.find({
      where: { companyId, referrerCustomerId: customer.customerId },
      order: { createdAt: 'DESC' },
    });

    // 4. Nombres de los referidos
    const ids = claims.map((c) => c.referredCustomerId);
    const referred = ids.length
      ? await this.customerRepo.find({
          where: { companyId, customerId: In(ids) },
        })
      : [];
    const byId = new Map(referred.map((r) => [r.customerId, r]));

    // 5. Puntos: 1 por referido válido
    const validClaims = claims.filter((c) => POINT_STATUSES.includes(c.status));

    return {
      referrer: {
        referralCode: profile.code,
        publicToken: profile.publicToken,
      },
      points: validClaims.length * POINTS_PER_REFERRAL,
      total: claims.length,
      claims: claims.map((c) => ({
        referredName: this.maskName(byId.get(c.referredCustomerId)),
        status: c.status,
        points: POINT_STATUSES.includes(c.status) ? POINTS_PER_REFERRAL : 0,
        createdAt: c.createdAt,
      })),
    };
  }

  // "Juan Pérez" -> "Juan P."
  private maskName(c?: CustomerCache): string {
    if (!c) return 'Referido';
    const last = c.lastName?.trim();
    return last ? `${c.firstName} ${last[0]}.` : c.firstName;
  }
}