import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
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
    console.log('🔌 Nueva conexión intentada. Handshake:', {
      query: client.handshake.query,
      auth: client.handshake.auth,
      headers: client.handshake.headers,
    });

    // Intentar obtener el token de varias formas (la más completa)
    let token: string | undefined;

    // 1. Desde Authorization header (la más común en Postman)
    const authHeader = client.handshake.headers.authorization as string;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7); // quita "Bearer "
    } else if (authHeader) {
      token = authHeader;
    }

    // 2. Desde header "token" (Postman a veces lo envía así)
    if (!token) {
      token = client.handshake.headers.token as string;
    }

    // 3. Desde query parameter (?token=xxx)
    if (!token) {
      token = client.handshake.query.token as string;
    }

    // 4. Desde handshake.auth.token (para clientes reales)
    if (!token) {
      token = client.handshake.auth?.token as string;
    }

    if (!token) {
      console.log('❌ No se recibió ningún token');
      client.emit('error', { message: 'Token requerido' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verifyToken(token);
      client.data.user = payload;
      console.log(`✅ Cliente conectado correctamente → User ID: ${payload.sub || payload.id}`);
      client.emit('connection_success', { message: 'Conectado', user: payload });
    } catch (error) {
      console.log('❌ Token inválido o expirado:', error.message);
      client.emit('error', { message: 'Token inválido' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Cliente desconectado → User ID: ${client.data.user?.sub || 'unknown'}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, channel: string) {
    client.join(channel);
    client.emit('subscribed', { channel });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, channel: string) {
    client.leave(channel);
  }
}