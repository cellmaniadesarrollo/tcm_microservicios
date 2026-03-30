// src/sync/sync.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '../common/jwt/jwt.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) { }

  async handleConnection(client: Socket) {
    let token: string | undefined;

    // Extraer token de diferentes posibles ubicaciones
    const authHeader = client.handshake.headers.authorization as string;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (authHeader) {
      token = authHeader;
    }

    if (!token) token = client.handshake.headers.token as string;
    if (!token) token = client.handshake.query.token as string;
    if (!token) token = client.handshake.auth?.token as string;

    if (!token) {
      client.emit('error', { message: 'Token requerido' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verifyToken(token);
      client.data.user = payload;

      // === MULTITENANT: Obtener company_id del token ===
      const companyId = payload.company_id || payload.companyId;

      if (!companyId) {
        client.emit('error', { message: 'company_id no encontrado en el token' });
        client.disconnect(true);
        return;
      }

      // Unir al usuario SOLO a la room de su empresa
      const companyRoom = `company:${companyId}`;
      client.join(companyRoom);

      // Confirmación de conexión exitosa
      client.emit('connection_success', {
        message: '✅ Conexión WebSocket establecida correctamente',
        userId: payload.sub || payload.id,
        companyId: companyId,
        room: companyRoom,
        timestamp: new Date().toISOString(),
      });

      client.emit('welcome', {
        message: `Bienvenido al servicio Sync - Empresa ${companyId}`,
        status: 'connected',
        companyId: companyId,
      });

    } catch (error) {
      client.emit('error', { message: 'Token inválido o expirado' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // No se hace nada (puedes agregar logging si lo deseas)
  }


}