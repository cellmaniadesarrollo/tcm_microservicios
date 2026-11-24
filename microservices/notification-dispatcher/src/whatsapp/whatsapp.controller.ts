import { Controller, HttpException, Logger } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { WhatsappService } from './whatsapp.service';
import { WhatsappOfficialService } from './whatsapp-official.service';
import { WhatsappTemplateService } from './whatsapp-template.service';

const logger = new Logger('WhatsappController');

/**
 * Convierte cualquier error en un RpcException con { statusCode, message, error }
 * para que el gateway pueda mapearlo al código HTTP correcto.
 */
function toRpc(e: any): RpcException {
    if (e instanceof RpcException) return e;

    if (e instanceof HttpException) {
        const status = e.getStatus();
        const res = e.getResponse() as any;
        return new RpcException({
            statusCode: status,
            message: typeof res === 'string' ? res : res?.message ?? e.message,
            error: typeof res === 'string' ? e.name : res?.error ?? e.name,
        });
    }

    logger.error(e?.message ?? e, e?.stack);
    return new RpcException({
        statusCode: 500,
        message: e?.message ?? 'Error interno',
        error: 'Internal Server Error',
    });
}

@Controller()
export class WhatsappController {
    constructor(
        private readonly whatsappService: WhatsappService,
        private readonly whatsappOfficialService: WhatsappOfficialService,
        private readonly whatsappTemplateService: WhatsappTemplateService,
    ) { }

    // ─── Sesiones CRUD ────────────────────────────────────────────────────────

    @MessagePattern({ cmd: 'whatsapp_list_sessions' })
    async listSessions(data: { user: { companyId: string } }) {
        try {
            return await this.whatsappService.listSessions(data.user.companyId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_list_routing_types' })
    async listRoutingTypes() {
        try {
            return await this.whatsappService.listRoutingTypes();
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_create_session' })
    async createSession(data: { user: { companyId: string }; routingId: string }) {
        try {
            return await this.whatsappService.createSession(data.user.companyId, data.routingId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_update_session' })
    async updateSession(data: { user: { companyId: string }; sessionId: string; routingId: string }) {
        try {
            return await this.whatsappService.updateSessionRouting(data.user.companyId, data.sessionId, data.routingId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_delete_session' })
    async deleteSession(data: { user: { companyId: string }; sessionId: string }) {
        try {
            return await this.whatsappService.deleteSession(data.user.companyId, data.sessionId);
        } catch (e: any) {
            throw toRpc(e);
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
            throw toRpc(e);
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
            return this.whatsappService.getQrStatus(data.sessionId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    // ─── Sesión oficial ───────────────────────────────────────────────────────

    @MessagePattern({ cmd: 'whatsapp_configure_official' })
    async configureOfficial(data: {
        user: { companyId: string };
        sessionId?: string;
        phoneNumberId: string;
        accessToken: string;
        wabaId: string;
        apiVersion?: string;
        routingId?: string | null;
    }) {
        try {
            return await this.whatsappOfficialService.configureSession(
                data.user.companyId,
                {
                    phoneNumberId: data.phoneNumberId,
                    accessToken: data.accessToken,
                    wabaId: data.wabaId,
                    apiVersion: data.apiVersion,
                    routingId: data.routingId,
                },
                data.sessionId,
            );
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_test_official_connection' })
    async testOfficialConnection(data: { user: { companyId: string }; sessionId: string }) {
        try {
            return await this.whatsappOfficialService.testConnection(data.sessionId, data.user.companyId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    // ─── Plantillas ───────────────────────────────────────────────────────────

    @MessagePattern({ cmd: 'whatsapp_sync_templates' })
    async syncTemplates(data: { user: { companyId: string }; sessionId: string }) {
        try {
            return await this.whatsappTemplateService.syncFromMeta(data.user.companyId, data.sessionId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_list_templates' })
    async listTemplates(data: { user: { companyId: string }; sessionId: string }) {
        try {
            return await this.whatsappTemplateService.listBySession(data.user.companyId, data.sessionId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_link_template' })
    async linkTemplate(data: { user: { companyId: string }; templateId: string; event: string }) {
        try {
            return await this.whatsappTemplateService.linkToEvent(
                data.user.companyId,
                data.templateId,
                data.event as any,
            );
        } catch (e: any) {
            throw toRpc(e);
        }
    }

    @MessagePattern({ cmd: 'whatsapp_get_session' })
    async getSession(data: { user: { companyId: string }; sessionId: string }) {
        try {
            return await this.whatsappService.getSession(data.user.companyId, data.sessionId);
        } catch (e: any) {
            throw toRpc(e);
        }
    }
}