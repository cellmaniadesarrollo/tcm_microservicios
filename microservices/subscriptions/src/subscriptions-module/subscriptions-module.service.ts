import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompanyReplica } from '../companies/entities/company-replica.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscriptions.entity';
import { SubscriptionStatus } from '../catalogs/entities/subscription-status.entity';
import { DEFAULT_PUBLIC_PLAN_CODE } from './constants/subscription.constants';
import { RpcException } from '@nestjs/microservices';
import { UserEmployeeCache } from '../users-employees-events/entities/user_employee_cache.entity';
/**
 * Servicio responsable de gestionar suscripciones.
 *
 * ✔ Asigna TRIAL automáticamente
 * ✔ Idempotente
 * ❗ NO crea planes
 */
@Injectable()
export class SubscriptionsModuleService {

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,

    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,

    @InjectRepository(CompanyReplica)
    private readonly companyRepo: Repository<CompanyReplica>,

    @InjectRepository(SubscriptionStatus)
    private readonly statusRepo: Repository<SubscriptionStatus>,

    @InjectRepository(UserEmployeeCache)
    private readonly userCacheRepo: Repository<UserEmployeeCache>,
  ) { }

  /**
   * Registra automáticamente la suscripción por defecto (TRIAL).
   *
   * 👉 Puede llamarse desde:
   * - listener
   * - sync masivo
   * - recovery
   */
  async registerDefaultSubscription(companyId: string): Promise<void> {

    // 1️⃣ Empresa
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });
    if (!company) return;

    // 2️⃣ Ya tiene suscripción
    const existing = await this.subscriptionRepo.findOne({
      where: { company: { id: companyId } },
    });
    if (existing) return;

    // 3️⃣ Plan público por defecto
    const plan = await this.planRepo.findOne({
      where: {
        code: DEFAULT_PUBLIC_PLAN_CODE,
        active: true,
        isInternal: false,
      },
    });
    if (!plan) {
      throw new RpcException(
        new ForbiddenException(`Plan ${DEFAULT_PUBLIC_PLAN_CODE} no existe`),
      );
    }

    // 4️⃣ Estado ACTIVE
    const activeStatus = await this.statusRepo.findOne({
      where: { code: 'active' },
    });
    if (!activeStatus) {
      throw new RpcException(
        new ForbiddenException('SubscriptionStatus ACTIVE no existe'),
      );
    }

    // 5️⃣ Fechas
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // 6️⃣ Crear suscripción
    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        company,
        plan,
        status: activeStatus,
        startDate,
        endDate,
      }),
    );
  }




  async validateCompanySubscription(companyId: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        company: { id: companyId },
      },
      relations: {
        status: true,
        plan: {
          limits: { resource: true },
          features: true,
        },
      },
    });

    if (!subscription) {
      throw new RpcException(
        new ForbiddenException('La compañía no tiene suscripción'),
      );
    }

    // 🟢 Estado
    if (subscription.status.code !== 'active') {
      throw new RpcException(
        new ForbiddenException('Suscripción inactiva'),
      );
    }

    // 📦 Plan
    if (!subscription.plan.active) {
      throw new RpcException(
        new ForbiddenException('Plan no disponible'),
      );
    }

    // ⏱ Vigencia
    const now = new Date();

    if (subscription.startDate > now) {
      throw new RpcException(
        new ForbiddenException('La suscripción aún no inicia'),
      );
    }

    if (subscription.endDate && subscription.endDate <= now) {
      throw new RpcException(
        new ForbiddenException('La suscripción ha expirado'),
      );
    }

    // 🔢 Límites
    const limits = subscription.plan.limits.reduce(
      (acc, limit) => {
        acc[limit.resource.code] = limit.maxValue;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 🧩 Features
    const features = subscription.plan.features
      .filter(f => f.enabled)
      .map(f => f.featureCode);

    return {
      plan: {
        code: subscription.plan.code,
        name: subscription.plan.name,
      },
      expiresAt: subscription.endDate,
      limits,
      features,
    };
  }
  async validateCompanyUserLimit(companyId: string): Promise<boolean> {
    // 1️⃣ Suscripción activa
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        company: { id: companyId },
        status: { id: 1 }, // ACTIVA
      },
      relations: [
        'plan',
        'plan.limits',
        'plan.limits.resource',
      ],
    });
    if (!subscription) {
      throw new RpcException(
        new ForbiddenException('La compañía no tiene una suscripción activa'),
      );
    }

    // 2️⃣ Límite de usuarios
    const userLimit = subscription.plan.limits.find(
      limit => limit.resource.code === 'users',
    );

    // 🔓 Sin límite configurado → ilimitado
    if (!userLimit) {
      return true;
    }

    // 🔓 Ilimitado explícito
    if (userLimit.maxValue === -1) {
      return true;
    }

    // 3️⃣ Contar usuarios actuales
    const usersCount = await this.userCacheRepo.count({
      where: {
        company: { id: companyId },
      },
    });

    // 4️⃣ Validar
    if (usersCount >= userLimit.maxValue) {
      throw new RpcException(
        new ForbiddenException(
          `Límite de usuarios alcanzado (${userLimit.maxValue})`,
        ),
      );
    }

    return true;
  }

}
