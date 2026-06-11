import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { User } from '../common/auth/decorators/user.decorator';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { Logger } from '@nestjs/common';
import { Groups } from '../common/auth/decorators/groups.decorator';

const logger = new Logger('NotificationsDispatcher');

@Controller('notifications-dispatcher')
@Auth()
@Groups()
export class NotificationsDispatcherController {
  constructor(
    @Inject('NOTIFICATIONS_DISPATCHER_SERVICE') private readonly client: ClientProxy,
  ) { }

  // ─── Sesiones CRUD ────────────────────────────────────────────────────────

  @Get('sessions')
  async listSessions(@User() user: any) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'whatsapp_list_sessions' },
        { internalToken: process.env.INTERNAL_SECRET, user: { companyId: user.companyId } },
      ),
    );
  }
  //pan
  @Get('routing-types')
  async listRoutingTypes() {
    return firstValueFrom(
      this.client.send(
        { cmd: 'whatsapp_list_routing_types' },
        { internalToken: process.env.INTERNAL_SECRET },
      ),
    );
  }

  @Post('sessions')
  async createSession(@Body() body: { routingId: string }, @User() user: any) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'whatsapp_create_session' },
        { internalToken: process.env.INTERNAL_SECRET, routingId: body.routingId, user: { companyId: user.companyId } },
      ),
    );
  }

  @Patch('sessions/:sessionId')
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { routingId: string },
    @User() user: any,
  ) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'whatsapp_update_session' },
        { internalToken: process.env.INTERNAL_SECRET, sessionId, routingId: body.routingId, user: { companyId: user.companyId } },
      ),
    );
  }

  @Delete('sessions/:sessionId')
  async deleteSession(@Param('sessionId') sessionId: string, @User() user: any) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'whatsapp_delete_session' },
        { internalToken: process.env.INTERNAL_SECRET, sessionId, user: { companyId: user.companyId } },
      ),
    );
  }

  // ─── Vinculación (QR) ─────────────────────────────────────────────────────

  /**
   * POST sessions/:sessionId/link
   * Paso 1 — arranca el socket y empieza a generar QR para esa sesión.
   */
  @Post('sessions/:sessionId/link')
  async linkSession(@Param('sessionId') sessionId: string, @User() user: any) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'whatsapp_link_session' },
        { internalToken: process.env.INTERNAL_SECRET, sessionId, user: { companyId: user.companyId } },
      ),
    );
  }

  /**
   * GET sessions/:sessionId/qr
   * Paso 2 — polling cada ~3s hasta que status === 'connected'.
   * Respuesta: { status: 'waiting_qr' | 'connected' | 'disconnected', qr: string | null }
   */
  @Get('sessions/:sessionId/qr')
  async getQr(@Param('sessionId') sessionId: string, @User() user: any) {
    return firstValueFrom(
      this.client.send(
        { cmd: 'whatsapp_get_qr' },
        { internalToken: process.env.INTERNAL_SECRET, sessionId, user: { companyId: user.companyId } },
      ),
    );
  }
}