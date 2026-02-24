import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * ENTIDADES DE PLANES
 */
import { Plan } from './entities/plan.entity';
import { PlanFeature } from './entities/plan-feature.entity';
import { PlanLimit } from './entities/plan-limit.entity';

/**
 * CATÁLOGOS
 */
import { BillingCycle } from '../catalogs/entities/billing-cycle.entity';
import { Feature } from '../catalogs/entities/feature.entity';
import { Resource } from '../catalogs/entities/resource.entity';

import { OWNER_PLAN_CODE, UNLIMITED } from '../subscriptions-module/constants/subscription.constants';

/**
 * Servicio responsable de inicializar los planes del sistema.
 *
 * ✔ Se ejecuta al iniciar el microservicio
 * ✔ Es idempotente (no duplica datos)
 * ❗ NO crea suscripciones
 * ❗ NO depende de empresas
 */
@Injectable()
export class PlansService implements OnModuleInit {

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,

    @InjectRepository(PlanFeature)
    private readonly planFeatureRepo: Repository<PlanFeature>,

    @InjectRepository(PlanLimit)
    private readonly planLimitRepo: Repository<PlanLimit>,

    @InjectRepository(BillingCycle)
    private readonly billingCycleRepo: Repository<BillingCycle>,

    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,

    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
  ) { }

  async onModuleInit() {
    await this.seedPlans();
  }

/**
 * Definición declarativa de planes del sistema
 * - Crea planes
 * - Asigna features según configuración
 * - Asigna límites por recurso
 * - OWNER tiene acceso total (sin features reales)
 */
private async seedPlans() {
  // 🔹 Ciclo mensual obligatorio
  const monthly = await this.billingCycleRepo.findOne({
    where: { code: 'monthly' },
  });
  if (!monthly) throw new Error('BillingCycle "monthly" not found');

  // 🔹 Recursos limitables
  const usersResource = await this.resourceRepo.findOne({ where: { code: 'users' } });
  const branchesResource = await this.resourceRepo.findOne({ where: { code: 'branches' } });
  if (!usersResource || !branchesResource) {
    throw new Error('Resources users/branches not found');
  }

  /**
   * 🧠 Configuración declarativa de planes
   */
  const plans = [
    {
      code: 'TRIAL',
      name: 'Trial',
      price: 0,
      isInternal: false,
      features: ['orders'],
      limits: { users: 2, branches: 1 },
    },
    {
      code: 'BASIC',
      name: 'Basic',
      price: 10,
      isInternal: false,
      features: ['orders'],
      limits: { users: 2, branches: 2 },
    },
    {
      code: 'PRO',
      name: 'Pro',
      price: 20,
      isInternal: false,
      features: ['orders', 'inventory'],
      limits: { users: 4, branches: 3 },
    },
    {
      code: OWNER_PLAN_CODE,
      name: 'Owner System',
      price: 0,
      isInternal: true,
      features: ['all'], // 👑 acceso total (no se guarda en DB)
      limits: {
        users: UNLIMITED,
        branches: UNLIMITED,
      },
    },
  ];

  /**
   * 🔁 Creación de planes
   */
  for (const planDef of plans) {
    const exists = await this.planRepo.findOne({
      where: { code: planDef.code },
    });
    if (exists) continue;

    // 🧾 Crear plan
    const plan = await this.planRepo.save(
      this.planRepo.create({
        code: planDef.code,
        name: planDef.name,
        price: planDef.price,
        billingCycle: monthly,
        active: true,
        isInternal: planDef.isInternal,
      }),
    );

    /**
     * 🔐 Asignación de features según definición
     */
    if (planDef.features?.length) {
      for (const featureCode of planDef.features) {
 
        const feature = await this.featureRepo.findOne({
          where: { code: featureCode },
        });

        if (!feature) { 
          throw new Error(`Feature "${featureCode}" not found`);
        }

        await this.planFeatureRepo.save(
          this.planFeatureRepo.create({
            plan, 
            feature,
            featureCode: feature.code,
            enabled: true,
          }),
        );
      }
    }

    /**
     * 📦 Límites por recurso
     */
    await this.planLimitRepo.save([
      this.planLimitRepo.create({
        plan,
        resource: usersResource,
        maxValue: planDef.limits.users,
      }),
      this.planLimitRepo.create({
        plan,
        resource: branchesResource,
        maxValue: planDef.limits.branches,
      }),
    ]);

    Logger.log(`Plan ${planDef.code} creado`, 'PlansService'); 
  }
}
}
