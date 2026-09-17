import { Controller } from '@nestjs/common';
import { OrderPartRequestService } from './order-part-request.service';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

@Controller('order-part-request')
export class OrderPartRequestController {
  constructor(private readonly partRequestsService: OrderPartRequestService) { }

  @MessagePattern({ cmd: 'create_part_request' })
  async createPartRequest(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      const result = await this.partRequestsService.createPartRequest(
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

  @MessagePattern({ cmd: 'list_part_requests_by_order' })
  async listByOrder(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.listByOrder(data.dto.orderId, data.user);
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
  @MessagePattern({ cmd: 'list_part_requests' })
  async listPartRequests(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.listPartRequests(data.dto, data.user);
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
  @MessagePattern({ cmd: 'get_part_request_full_data' })
  async getPartRequestFullData(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.getPartRequestFullData(data.dto.id, data.user);
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


  @MessagePattern({ cmd: 'encontrado_nacional_part_request' })
  async encontradoNacional(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.encontradoNacional(
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
  @MessagePattern({ cmd: 'list_part_requests_para_pago' })
  async listParaPago(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        throw new RpcException('Payload incompleto: falta dto o user');
      }
      return await this.partRequestsService.listParaPago(data.dto, data.user);
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
  @MessagePattern({ cmd: 'create_part_request_payment' })
  async createPartRequestPayment(@Payload() data: any) {
    const timestamp = new Date().toISOString();
    console.log(`\n==================================================`);
    console.log(`📥 [${timestamp}] [INICIO] CMD: create_part_request_payment`);
    console.log(`📦 Payload recibido:`, JSON.stringify(data, null, 2));

    try {
      if (!data?.dto || !data?.user) {
        console.error(`❌ [${timestamp}] [ERROR VALIDACIÓN] Payload incompleto.`);
        console.error(`👉 Recibido: dto=${!!data?.dto}, user=${!!data?.user}, files=${data?.files?.length ?? 0}`);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      console.log(`⚙️ [${timestamp}] Procesando pago en servicio...`);
      console.log(`👤 Usuario ID:`, data.user.id ?? data.user);
      console.log(`📄 Archivos adjuntos:`, data.files ? data.files.length : 0);

      const result = await this.partRequestsService.createPartRequestPayment(
        data.dto,
        data.files ?? [],
        data.user,
      );

      console.log(`✅ [${timestamp}] [ÉXITO] Pago de solicitud creado correctamente.`);
      console.log(`📤 Resultado:`, JSON.stringify(result, null, 2));
      console.log(`==================================================\n`);

      return result;
    } catch (error: any) {
      console.error(`🔥 [${timestamp}] [ERROR CRÍTICO] MS Órdenes (createPartRequestPayment)`);
      console.error(`💬 Mensaje:`, error.message);
      console.error(`📌 Detalle/Response:`, error.response || 'Sin detalles extra');
      if (error.stack) {
        console.error(`📜 Stack Trace:\n`, error.stack);
      }
      console.log(`==================================================\n`);

      // Mantiene el lanzamiento de la excepción RpcException tal como lo tenías
      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: 'error',
        message: error.message || 'Error interno en MS Órdenes',
        details: error.response || null,
      });
    }
  }
  @MessagePattern({ cmd: 'registrar_envio_part_request' })
  async registrarEnvio(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.registrarEnvio(
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

  @MessagePattern({ cmd: 'registrar_llegada_part_request' })
  async registrarLlegada(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) throw new RpcException('Payload incompleto: falta dto o user');
      return await this.partRequestsService.registrarLlegada(data.dto, data.files ?? [], data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (registrarLlegada):', error);
      if (error.stack) console.error(error.stack);
      throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
    }
  }

  @MessagePattern({ cmd: 'aprobar_llegada_part_request' })
  async aprobarLlegada(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) throw new RpcException('Payload incompleto: falta dto o user');
      return await this.partRequestsService.aprobarLlegada(data.dto, data.files ?? [], data.user);
    } catch (error: any) {
      console.error('🔥 Error crítico en MS Órdenes (aprobarLlegada):', error);
      if (error.stack) console.error(error.stack);
      throw new RpcException({ status: 'error', message: error.message || 'Error interno en MS Órdenes', details: error.response || null });
    }
  }
  // ms-orders — controller
  @MessagePattern({ cmd: 'no_aprobar_llegada_part_request' })
  async noAprobarLlegada(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.noAprobarLlegada(data.dto, data.files ?? [], data.user);
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

  @MessagePattern({ cmd: 'get_part_request_datos_previos' })
  async getDatosPrevios(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.getDatosPrevios(data.dto.id, data.user);
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
  @MessagePattern({ cmd: 'completar_datos_part_request' })
  async completarDatos(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.completarDatos(data.dto, data.user);
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
  @MessagePattern({ cmd: 'get_part_request_datos_pago' })
  async getDatosPago(@Payload() data: any) {
    try {
      if (!data.dto || !data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta dto o user');
      }

      return await this.partRequestsService.getDatosPago(data.dto.id, data.user);
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
  @MessagePattern({ cmd: 'get_part_request_counts' })
  async getPartRequestCounts(@Payload() data: any) {
    try {
      if (!data.user) {
        console.error('❌ Error: Payload incompleto', data);
        throw new RpcException('Payload incompleto: falta user');
      }

      return await this.partRequestsService.getPartRequestCounts(data.user);
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
}
