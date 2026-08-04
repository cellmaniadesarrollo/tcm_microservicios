import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    OrderPrintStatus,
    OrderPrintStatusDocument,
    PrintableType,
    OrderMiniSnapshot,
    PaymentMiniSnapshot,
} from './schemas/order-print-status.schema';
import { OrderPrintLog, OrderPrintLogDocument, PrintType } from './schemas/order-print-log.schema';
import { RegisterOrderPrintDto } from './dto/register-order-print.dto';
import { UserSnapshot } from '../orders-relay/schemas/order-replica.schema';
import { OrdersRelayService } from '../orders-relay/orders-relay.service';
import { UsersEmployeesEventsService } from '../users-employees-events/users-employees-events.service';
import { RegisterPrintCopyDto } from './dto/register-print-copy.dto';
import { FinesService } from '../fines/fines.service';
import { FineType } from '../fines/schemas/fine.schema';

@Injectable()
export class PrintService {
    constructor(
        @InjectModel(OrderPrintStatus.name)
        private readonly printStatusModel: Model<OrderPrintStatusDocument>,
        @InjectModel(OrderPrintLog.name)
        private readonly printLogModel: Model<OrderPrintLogDocument>,
        private readonly ordersRelayService: OrdersRelayService,
        private readonly usersEmployeesEventsService: UsersEmployeesEventsService,
        private readonly finesService: FinesService
    ) { }

    async registerPrint(
        user: { userId: string; companyId: string; branchId: string },
        dto: RegisterOrderPrintDto,
    ) {
        try {
            const { entity_type, orderId, paymentId, requestedByUserId, forceAsOriginal, reprintReason, authorizedByUserId } = dto;

            if (entity_type === PrintableType.PAYMENT_RECEIPT && !paymentId) {
                throw new RpcException(
                    new BadRequestException('paymentId es requerido cuando entity_type es PAYMENT_RECEIPT'),
                );
            }

            // 1. Traer la orden replicada
            const order = await this.ordersRelayService.findOrderById(orderId);
            if (!order) {
                throw new RpcException(new NotFoundException(`Orden ${orderId} no encontrada`));
            }

            const orderSnapshot: OrderMiniSnapshot = {
                id: order.id,
                order_number: order.order_number,
                company_name: order.company?.name,
                branch_name: order.branch?.name,
            };

            // 2. Si es recibo de pago, buscar el pago embebido dentro de la orden
            let paymentSnapshot: PaymentMiniSnapshot | null = null;
            if (entity_type === PrintableType.PAYMENT_RECEIPT) {
                const payment = order.payments?.find((p: any) => p.id === paymentId);
                if (!payment) {
                    throw new RpcException(
                        new NotFoundException(`Pago ${paymentId} no encontrado en la orden ${orderId}`),
                    );
                }
                paymentSnapshot = {
                    id: payment.id,
                    amount: payment.amount,
                    flow_type: payment.flow_type,
                    payment_type_name: payment.payment_type_name,
                    paid_at: payment.paid_at,
                };
            }

            // 3. Snapshots de usuario
            const printedBy = await this.buildUserSnapshot(user.userId);
            const requestedBy = requestedByUserId
                ? await this.buildUserSnapshot(requestedByUserId)
                : printedBy;

            if (forceAsOriginal && (!reprintReason || !authorizedByUserId)) {
                throw new RpcException(
                    new BadRequestException(
                        'reprintReason y authorizedByUserId son obligatorios para reimprimir como original',
                    ),
                );
            }
            const authorizedBy = authorizedByUserId
                ? await this.buildUserSnapshot(authorizedByUserId)
                : null;

            // 4. Determinar tipo de impresión según el estado actual de ESTA entidad puntual
            const statusFilter = { entity_type, orderId, paymentId: paymentId ?? null };
            const status = await this.printStatusModel.findOne(statusFilter);
            const hasPreviousRecord = !!status?.is_printed;

            let printType: PrintType;
            let isOriginalReprint = false;

            if (!hasPreviousRecord) {
                printType = PrintType.ORIGINAL;
            } else if (forceAsOriginal) {
                printType = PrintType.ORIGINAL;
                isOriginalReprint = true;
            } else {
                printType = PrintType.COPY;
            }

            const copyNumber = (status?.print_count ?? 0) + 1;
            const printedAt = new Date();

            // 5. Crear el log
            const log = await this.printLogModel.create({
                entity_type,
                orderId,
                paymentId: paymentId ?? null,
                order: orderSnapshot,
                payment: paymentSnapshot,
                printedBy,
                requestedBy,
                printed_at: printedAt,
                print_type: printType,
                copy_number: copyNumber,
                was_fined: printType === PrintType.COPY, // el cargo se conecta en el siguiente paso (fines)
                is_original_reprint: isOriginalReprint,
                reprint_reason: reprintReason ?? null,
                authorized_by: authorizedBy,
            });

            // 6. Upsert del estado resumen para esta entidad puntual
            await this.printStatusModel.updateOne(
                statusFilter,
                {
                    $setOnInsert: {
                        ...statusFilter,
                        order: orderSnapshot,
                        payment: paymentSnapshot,
                        first_printed_at: printedAt,
                        first_printed_by: printedBy,
                    },
                    $set: {
                        is_printed: true,
                        last_printed_at: printedAt,
                        last_printed_by: printedBy,
                    },
                    $inc: { print_count: 1 },
                },
                { upsert: true },
            );

            // TODO (siguiente paso): si printType === COPY, crear el Fine (fines.service.createFine)

            return log;
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException(
                    'Error interno al registrar la impresión',
                ),
            );
        }
    }

    private async buildUserSnapshot(userId: string): Promise<UserSnapshot> {
        try {
            // Ajustar nombre del método según UsersEmployeesEventsService real
            const cached = await this.usersEmployeesEventsService.findUserByI(userId);

            if (!cached) {
                throw new RpcException(new NotFoundException(`Usuario ${userId} no encontrado`));
            }

            return {
                id: cached.id,
                username: cached.username,
                first_name: cached.first_name,
                last_name: cached.last_name,
                dni: cached.dni ?? undefined,
                email: cached.email,
                phone: cached.phone,
            };
        } catch (error) {
            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al obtener datos del usuario'),
            );
        }
    }

    async getPrintStatus(
        entity_type: PrintableType,
        orderId: number,
        paymentId?: number,
    ): Promise<{
        is_printed: boolean;
        print_count: number;
        next_print_type: PrintType;
        last_printed_at: Date | null;
        last_printed_by: UserSnapshot | null;
    }> {
        try {
            const statusFilter = { entity_type, orderId, paymentId: paymentId ?? null };
            const status = await this.printStatusModel.findOne(statusFilter).exec();

            const isPrinted = !!status?.is_printed;

            return {
                is_printed: isPrinted,
                print_count: status?.print_count ?? 0,
                next_print_type: isPrinted ? PrintType.COPY : PrintType.ORIGINAL,
                last_printed_at: status?.last_printed_at ?? null,
                last_printed_by: status?.last_printed_by ?? null,
            };
        } catch (error) {
            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al consultar el estado de impresión'),
            );
        }
    }
    async registerPrintCopy(
        user: { userId: string; companyId: string; branchId: string },
        dto: RegisterPrintCopyDto,
    ) {
        try {
            const { entity_type, orderId, paymentId, requestedByUserId, copies, forceAsOriginal, reprintReason, authorizedByUserId } = dto;

            if (entity_type === PrintableType.PAYMENT_RECEIPT && !paymentId) {
                throw new RpcException(
                    new BadRequestException('paymentId es requerido cuando entity_type es PAYMENT_RECEIPT'),
                );
            }

            if (forceAsOriginal && (!reprintReason || !authorizedByUserId)) {
                throw new RpcException(
                    new BadRequestException(
                        'reprintReason y authorizedByUserId son obligatorios para reimprimir como original',
                    ),
                );
            }

            // 1. Orden replicada
            const order = await this.ordersRelayService.findOrderById(orderId);

            const orderSnapshot: OrderMiniSnapshot = {
                id: order.id,
                order_number: order.order_number,
                company_name: order.company?.name,
                branch_name: order.branch?.name,
            };

            // 2. Pago embebido (si aplica)
            let paymentSnapshot: PaymentMiniSnapshot | null = null;
            if (entity_type === PrintableType.PAYMENT_RECEIPT) {
                const payment = order.payments?.find((p: any) => p.id === paymentId);
                if (!payment) {
                    throw new RpcException(
                        new NotFoundException(`Pago ${paymentId} no encontrado en la orden ${orderId}`),
                    );
                }
                paymentSnapshot = {
                    id: payment.id,
                    amount: payment.amount,
                    flow_type: payment.flow_type,
                    payment_type_name: payment.payment_type_name,
                    paid_at: payment.paid_at,
                };
            }

            // 3. Snapshots de usuario
            const printedBy = await this.buildUserSnapshot(user.userId);
            const requestedBy = requestedByUserId
                ? await this.buildUserSnapshot(requestedByUserId)
                : printedBy;
            const authorizedBy = authorizedByUserId
                ? await this.buildUserSnapshot(authorizedByUserId)
                : null;

            // 4. Validar que exista una impresión original previa
            const statusFilter = { entity_type, orderId, paymentId: paymentId ?? null };
            const status = await this.printStatusModel.findOne(statusFilter);
            const hasPreviousRecord = !!status?.is_printed;

            if (!hasPreviousRecord && !forceAsOriginal) {
                throw new RpcException(
                    new BadRequestException(
                        'No existe una impresión original registrada para esta entidad; no se puede registrar una copia',
                    ),
                );
            }

            const printedAt = new Date();
            let runningCopyNumber = status?.print_count ?? 0;
            const logsToCreate: Partial<OrderPrintLog>[] = [];

            if (forceAsOriginal) {
                runningCopyNumber += 1;
                logsToCreate.push({
                    entity_type,
                    orderId,
                    paymentId: paymentId ?? null,
                    order: orderSnapshot,
                    payment: paymentSnapshot,
                    printedBy,
                    requestedBy,
                    printed_at: printedAt,
                    print_type: PrintType.ORIGINAL,
                    copy_number: runningCopyNumber,
                    was_fined: false,
                    is_original_reprint: true,
                    reprint_reason: reprintReason,
                    authorized_by: authorizedBy,
                });
            } else {
                const copyCount = copies && copies > 0 ? copies : 1;
                for (let i = 0; i < copyCount; i++) {
                    runningCopyNumber += 1;
                    logsToCreate.push({
                        entity_type,
                        orderId,
                        paymentId: paymentId ?? null,
                        order: orderSnapshot,
                        payment: paymentSnapshot,
                        printedBy,
                        requestedBy,
                        printed_at: printedAt,
                        print_type: PrintType.COPY,
                        copy_number: runningCopyNumber,
                        was_fined: true,
                        is_original_reprint: false,
                        reprint_reason: null,
                        authorized_by: null,
                    });
                }
            }

            const logs = await this.printLogModel.insertMany(logsToCreate);

            // 5. Actualizar el estado resumen (suma todas las copias creadas en este evento)
            await this.printStatusModel.updateOne(
                statusFilter,
                {
                    $setOnInsert: {
                        ...statusFilter,
                        order: orderSnapshot,
                        payment: paymentSnapshot,
                        first_printed_at: printedAt,
                        first_printed_by: printedBy,
                    },
                    $set: {
                        is_printed: true,
                        last_printed_at: printedAt,
                        last_printed_by: printedBy,
                    },
                    $inc: { print_count: logsToCreate.length },
                },
                { upsert: true },
            );

            // 6. 💰 Multa de $0.25 por cada copia (no aplica a reimpresiones forzadas como "original")
            for (const log of logs) {
                if (log.print_type === PrintType.COPY) {
                    await this.finesService.createFine({
                        fine_type: FineType.REPRINT_COPY,
                        entity_type,
                        orderId,
                        paymentId: paymentId ?? null,
                        order: orderSnapshot,
                        payment: paymentSnapshot,
                        related_entity_id: log._id,
                        finedTo: requestedBy, // ya resuelto: requestedBy si hay solicitante, si no printedBy
                        appliedBy: printedBy,
                    });
                }
            }

            return logs;
        } catch (error) {
            console.error(error);

            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException(
                new InternalServerErrorException('Error interno al registrar la copia de impresión'),
            );
        }
    }
}