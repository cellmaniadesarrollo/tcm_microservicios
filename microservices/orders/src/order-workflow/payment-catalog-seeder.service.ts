// src/order-payments/seeders/payment-catalog-seeder.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentType } from './entities/payment-type.entity';
import { PaymentMethod } from './entities/payment-method.entity';



@Injectable()
export class PaymentCatalogSeederService implements OnModuleInit {
    private readonly logger = new Logger(PaymentCatalogSeederService.name);

    constructor(
        @InjectRepository(PaymentType)
        private readonly paymentTypeRepo: Repository<PaymentType>,

        @InjectRepository(PaymentMethod)
        private readonly paymentMethodRepo: Repository<PaymentMethod>,
    ) { }

    async onModuleInit(): Promise<void> {
        await this.seedPaymentTypes();
        await this.seedPaymentMethods();
    }

    private async seedPaymentTypes(): Promise<void> {
        const existing = await this.paymentTypeRepo.count();

        if (existing > 0) {
            this.logger.log(`Tipos de pago ya existen (${existing}). Skip seed.`);
            return;
        }

        this.logger.log('Poblando tipos de pago iniciales...');

        const initialData = [
            {
                code: 'ABONO',
                name: 'Abono inicial',
                description: 'Pago inicial al recibir el equipo o diagnóstico',
                is_active: true,
                sort_order: 10,
                icon: 'attach_money',
                color: '#4CAF50', // verde ingreso
            },
            {
                code: 'PAGO_PARCIAL',
                name: 'Pago parcial',
                description: 'Abono intermedio durante la reparación',
                is_active: true,
                sort_order: 20,
                icon: 'payments',
                color: '#2196F3',
            },
            {
                code: 'PAGO_FINAL',
                name: 'Pago final',
                description: 'Liquidación completa al entregar el equipo',
                is_active: true,
                sort_order: 30,
                icon: 'done_all',
                color: '#4CAF50',
            },
            {
                code: 'DEVOLUCION',
                name: 'Devolución a cliente',
                description: 'Devolución total o parcial al cliente',
                is_active: true,
                sort_order: 90,
                icon: 'money_off',
                color: '#F44336', // rojo egreso
            },
            {
                code: 'PAGO_A_CLIENTE',
                name: 'Pago del taller al cliente',
                description: 'Indemnización, compensación, etc.',
                is_active: true,
                sort_order: 95,
                icon: 'send_money',
                color: '#F44336',
            },
        ];

        const entities = initialData.map(data => this.paymentTypeRepo.create(data));

        await this.paymentTypeRepo.save(entities, { chunk: 100 });

        this.logger.log(`Creados ${entities.length} tipos de pago iniciales.`);
    }

    private async seedPaymentMethods(): Promise<void> {
        const count = await this.paymentMethodRepo.count();

        if (count > 0) {
            this.logger.log(`Métodos de pago ya existen (${count} registros). Se omite el seed.`);
            return;
        }

        this.logger.warn('No se encontraron métodos de pago → iniciando población inicial...');

        const initialMethods = [
            { name: 'EFECTIVO', description: 'Pago en efectivo en caja' },
            { name: 'TARJETA_DEBITO', description: 'Tarjeta de débito' },
            { name: 'TARJETA_CREDITO', description: 'Tarjeta de crédito' },
            { name: 'TRANSFERENCIA', description: 'Transferencia bancaria o depósito' },
            { name: 'SINPE_MOVIL', description: 'SINPE Móvil (Costa Rica) o similar' },
            { name: 'OTRO', description: 'Otro método no especificado' },
            // Agrega según tu país/negocio (PayPal, Binance Pay, etc.)
        ];

        const entities = initialMethods.map((data) =>
            this.paymentMethodRepo.create({
                ...data,
                // Puedes agregar un campo isActive: true, etc.
            }),
        );

        await this.paymentMethodRepo.save(entities, { chunk: 50 });

        this.logger.log(`Se poblaron ${entities.length} métodos de pago iniciales.`);
    }
}