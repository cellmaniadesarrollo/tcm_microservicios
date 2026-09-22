import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { PartRequestService } from './part-request.service';
import { PartRequestSourcingService } from './part-request-sourcing.service';
import { PartRequestPaymentService } from './part-request-payment.service';
import { PartRequestArrivalService } from './part-request-arrival.service';

@Controller('order-part-request')
export class OrderPartRequestController {
  constructor(
    private readonly partRequestService: PartRequestService,
    private readonly partRequestSourcingService: PartRequestSourcingService,
    private readonly partRequestPaymentService: PartRequestPaymentService,
    private readonly partRequestArrivalService: PartRequestArrivalService,
  ) { }

  // ─────────────────────────────────────────────────────────────
  // 1. CREACIÓN Y CONSULTA BÁSICA
  // ─────────────────────────────────────────────────────────────

  /** Crear una nueva solicitud de repuesto */
  @MessagePattern({ cmd: 'create_part_request' })
  async createPartRequest(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      const result = await this.partRequestService.createPartRequest(
        data.dto,
        data.files ?? [],
        data.user,
      );

      console.log('✅ MS Órdenes - Solicitud de repuesto registrada');
      return result;
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (createPartRequest):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Listar solicitudes de repuesto de una orden específica */
  @MessagePattern({ cmd: 'list_part_requests_by_order' })
  async listByOrder(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestService.listByOrder(data.dto.orderId, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listByOrder):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Listar solicitudes de repuesto (con filtros generales) */
  @MessagePattern({ cmd: 'list_part_requests' })
  async listPartRequests(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestService.listPartRequests(data.dto, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listPartRequests):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Obtener el detalle completo de una solicitud de repuesto */
  @MessagePattern({ cmd: 'get_part_request_full_data' })
  async getPartRequestFullData(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestService.getPartRequestFullData(data.dto.id, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (getPartRequestFullData):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Obtener contadores de solicitudes de repuesto (por estado) */
  @MessagePattern({ cmd: 'get_part_request_counts' })
  async getPartRequestCounts(@Payload() data: any) {
    try {
      if (!data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta user');
      }

      return await this.partRequestService.getPartRequestCounts(data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (getPartRequestCounts):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. SOURCING / BÚSQUEDA DE PROVEEDORES
  // ─────────────────────────────────────────────────────────────

  /** Registrar que el repuesto fue encontrado a nivel nacional */
  @MessagePattern({ cmd: 'encontrado_nacional_part_request' })
  async encontradoNacional(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestSourcingService.encontradoNacional(
        data.dto,
        data.files ?? [],
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (encontradoNacional):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Buscar proveedores disponibles */
  @MessagePattern({ cmd: 'search_providers' })
  async search(@Payload() data: any) {
    try {
      if (!data.dto) {
        throw new RpcException('Payload incompleto: falta dto');
      }

      return await this.partRequestSourcingService.search(data.dto, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (searchProviders):', error);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PAGOS
  // ─────────────────────────────────────────────────────────────

  /** Listar solicitudes de repuesto listas para pago */
  @MessagePattern({ cmd: 'list_part_requests_para_pago' })
  async listParaPago(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestPaymentService.listParaPago(data.dto, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listParaPago):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Listar solicitudes pendientes de pago por proveedor */
  @MessagePattern({ cmd: 'list_part_requests_pendientes_por_proveedor' })
  async listPendientesPorProveedor(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestPaymentService.listPendientesPorProveedor(
        data.dto.providerId,
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listPendientesPorProveedor):', error);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Obtener el detalle de un pago de solicitud de repuesto */
  @MessagePattern({ cmd: 'get_part_request_payment_detail' })
  async getPaymentDetail(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestPaymentService.getPaymentDetail(
        data.dto.paymentId,
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (getPaymentDetail):', error);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Crear un pago asociado a una o varias solicitudes de repuesto */
  @MessagePattern({ cmd: 'create_part_request_payment' })
  async createPartRequestPayment(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestPaymentService.createPartRequestPayment(
        data.dto,
        data.files ?? [],
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (createPartRequestPayment):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Obtener datos previos necesarios para realizar el pago */
  @MessagePattern({ cmd: 'get_part_request_datos_pago' })
  async getDatosPago(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestPaymentService.getDatosPago(data.dto.id, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (getDatosPago):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ENVÍO Y LLEGADA
  // ─────────────────────────────────────────────────────────────

  /** Registrar el envío del repuesto */
  @MessagePattern({ cmd: 'registrar_envio_part_request' })
  async registrarEnvio(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestArrivalService.registrarEnvio(
        data.dto,
        data.files ?? [],
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (registrarEnvio):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }


  /** Aprobar la llegada del repuesto */
  @MessagePattern({ cmd: 'aprobar_llegada_part_request' })
  async aprobarLlegada(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestArrivalService.aprobarLlegada(
        data.dto,
        data.files ?? [],
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (aprobarLlegada):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Rechazar / no aprobar la llegada del repuesto */
  @MessagePattern({ cmd: 'no_aprobar_llegada_part_request' })
  async noAprobarLlegada(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestArrivalService.cancelarPartRequest(
        data.dto,
        data.files ?? [],
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (noAprobarLlegada):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  // microservices/orders/src/order-part-requests/order-part-request.controller.ts

  @MessagePattern({ cmd: 'litigio_llegada_part_request' })
  async litigioLlegada(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) throw new RpcException('Payload incompleto: falta dto o user');
      return await this.partRequestArrivalService.litigioLlegada(data.dto, data.files ?? [], data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (litigioLlegada):', error);
      if (error.stack) console.error(error.stack);
      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }
  // ─────────────────────────────────────────────────────────────
  // 5. COMPLETAR / ACTUALIZAR DATOS
  // ─────────────────────────────────────────────────────────────

  /** Obtener datos previos de una solicitud (para completar información) */
  @MessagePattern({ cmd: 'get_part_request_datos_previos' })
  async getDatosPrevios(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestService.getDatosPrevios(data.dto.id, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (getDatosPrevios):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Completar o actualizar datos de una solicitud de repuesto */
  @MessagePattern({ cmd: 'completar_datos_part_request' })
  async completarDatos(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestService.completarDatos(data.dto, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (completarDatos):', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. LISTADOS ESPECIALES (PAGADAS SIN CIERRE DE ORDEN)
  // ─────────────────────────────────────────────────────────────

  /** Listar solicitudes pagadas que aún no tienen cierre de orden */
  @MessagePattern({ cmd: 'list_part_requests_pagadas_sin_cierre' })
  async listPagadasSinCierreOrden(@Payload() data: any) {
    try {
      if (!data?.user?.companyId) {
        throw new RpcException('Payload incompleto: falta user.companyId');
      }

      return await this.partRequestService.listPagadasSinCierreOrden(
        data.dto ?? {},
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error en listPagadasSinCierreOrden:', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  /** Contar solicitudes pagadas que aún no tienen cierre de orden */
  @MessagePattern({ cmd: 'count_part_requests_pagadas_sin_cierre' })
  async countPagadasSinCierreOrden(@Payload() data: any) {
    try {
      if (!data?.user?.companyId) {
        throw new RpcException('Payload incompleto: falta user.companyId');
      }

      return await this.partRequestService.countPagadasSinCierreOrden(
        data.dto ?? {},
        data.user,
      );
    } catch (error: any) {
      console.error('🔥 Error en countPagadasSinCierreOrden:', error);
      if (error.stack) console.error(error.stack);

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }

  @MessagePattern({ cmd: 'list_part_requests_litigios' })
  async listLitigios(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) throw new RpcException('Payload incompleto: falta dto o user');
      return await this.partRequestArrivalService.listLitigios(data.dto, data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (listLitigios):', error);
      throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
    }
  }
}