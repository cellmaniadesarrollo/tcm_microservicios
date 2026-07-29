import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { WhatsappService } from './whatsapp.service';

const logger = new Logger('WhatsappController');

@Controller()
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    // ─── Sesiones CRUD ────────────────────────────────────────────────────────

    @MessagePattern({ cmd: 'whatsapp_list_sessions' })
    async listSessions(data: { user: { companyId: string } }) {
        try {
            return await this.whatsappService.listSessions(data.user.companyId);
        } catch (e: any) {
            throw new RpcException(e.message);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_list_routing_types' })
    async listRoutingTypes() {
        try {
            return await this.whatsappService.listRoutingTypes();
        } catch (e: any) {
            throw new RpcException(e.message);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_create_session' })
    async createSession(data: { user: { companyId: string }; routingId: string }) {
        try {
            return await this.whatsappService.createSession(data.user.companyId, data.routingId);
        } catch (e: any) {
            throw new RpcException(e.message);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_update_session' })
    async updateSession(data: { user: { companyId: string }; sessionId: string; routingId: string }) {
        try {
            return await this.whatsappService.updateSessionRouting(data.user.companyId, data.sessionId, data.routingId);
        } catch (e: any) {
            throw new RpcException(e.message);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_delete_session' })
    async deleteSession(data: { user: { companyId: string }; sessionId: string }) {
        try {
            return await this.whatsappService.deleteSession(data.user.companyId, data.sessionId);
        } catch (e: any) {
            throw new RpcException(e.message);
        }
    }

    // ─── Vinculación ──────────────────────────────────────────────────────────

    /**
     * Paso 1: Arranca el socket y empieza a generar QR.
     * Llamar UNA vez, luego ir polling a whatsapp_get_qr.
     */
    @MessagePattern({ cmd: 'whatsapp_link_session' })
    async linkSession(data: { user: { companyId: string }; sessionId: string }) {
        try {
            return await this.whatsappService.linkSession(data.user.companyId, data.sessionId);
        } catch (e: any) {
            throw new RpcException(e.message);
        }
    }

    /**
     * Paso 2: Polling — devuelve { qr, status }
     *   status: 'waiting_qr' | 'connected' | 'disconnected'
     *   qr: string (data:image/png;base64) | null
     */
    @MessagePattern({ cmd: 'whatsapp_get_qr' })
    async getQr(data: { user: { companyId: string }; sessionId: string }) {
        try {
            const datass = this.whatsappService.getQrStatus(data.sessionId);
            return datass
        } catch (e: any) {
            throw new RpcException(e.message);
        }
    }
}