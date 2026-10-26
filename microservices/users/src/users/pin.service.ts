import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { UserPin } from './entities/user-pin.entity';

const MAX_ATTEMPTS = 5; // intentos fallidos antes de bloquear
const LOCK_MINUTES = 10; // minutos de bloqueo
const REUSE_CHECK = 5; // no reutilizar los últimos 5 PINs
const HISTORY_MAX = 20; // tope del historial guardado

export interface PinSigner {
  id: string;
  username: string;
  groups: string[];
}

@Injectable()
export class PinService {
  // Límite de intentos por cuenta de sesión (en memoria: una sola instancia).
  // Si corres varias instancias de este MS, muévelo a Redis.
  private readonly failedBySession = new Map<
    string,
    { count: number; lockedUntil: number | null }
  >();

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserPin) private readonly pinRepo: Repository<UserPin>,
  ) {}

  // ---------- Errores (mismo formato RpcException que usa UsersService) ----------
  private fail(error: any, defaultMessage: string): never {
    if (error instanceof RpcException) throw error;
    if (error instanceof HttpException) throw new RpcException(error.getResponse());
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    throw new RpcException({ statusCode: 500, message: `${defaultMessage}: ${msg}` });
  }

  // ---------- Intentos por sesión ----------
  private checkSessionLock(sessionUserId: string) {
    const rec = this.failedBySession.get(String(sessionUserId));
    if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
      // Objeto (no string) para que el gateway conserve el código 423
      throw new HttpException(
        { statusCode: 423, message: 'Demasiados intentos. Intenta más tarde.' },
        423,
      );
    }
  }

  private registerSessionFailure(sessionUserId: string) {
    const key = String(sessionUserId);
    const rec = this.failedBySession.get(key) ?? { count: 0, lockedUntil: null };
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = Date.now() + LOCK_MINUTES * 60000;
      rec.count = 0;
    }
    this.failedBySession.set(key, rec);
  }

  private clearSessionFailures(sessionUserId: string) {
    this.failedBySession.delete(String(sessionUserId));
  }

  // ---------- Formato del PIN ----------
  private validatePinFormat(pin: string) {
    if (!/^\d{6}$/.test(pin || '')) {
      throw new BadRequestException('El PIN debe tener exactamente 6 dígitos.');
    }
    if (/^(\d)\1{5}$/.test(pin)) {
      throw new BadRequestException('El PIN es muy fácil de adivinar. Elige otro.');
    }
    const asc = '01234567890123456789';
    const desc = '98765432109876543210';
    if (asc.includes(pin) || desc.includes(pin)) {
      throw new BadRequestException('El PIN es muy fácil de adivinar. Elige otro.');
    }
  }

  // ¿Ese PIN ya lo usa otra persona de la compañía?
  private async isPinTaken(companyId: string, pin: string, excludeUserId?: string) {
    const docs = await this.pinRepo.find({
      where: { companyId: String(companyId), active: true },
      select: ['userId', 'pinHash'],
    });
    const others = docs.filter((d) => d.userId !== excludeUserId);
    const results = await Promise.all(others.map((d) => bcrypt.compare(pin, d.pinHash)));
    return results.some(Boolean);
  }

  // ---------- ¿La sesión debe pedir PIN? ----------
  async isPinRequired(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'pinRequired'],
      });
      return !!user?.pinRequired;
    } catch (e) {
      this.fail(e, 'Error consultando si el PIN es obligatorio');
    }
  }

  // ---------- Validar PIN: el PIN identifica a quien firma ----------
  async validatePin(params: {
    pin: string;
    sessionUserId: string;
    sessionCompanyId: string;
  }): Promise<PinSigner> {
    try {
      const { pin, sessionUserId, sessionCompanyId } = params;

      if (!/^\d{6}$/.test(pin || '')) {
        throw new BadRequestException('El PIN de 6 dígitos es requerido.');
      }
      if (!sessionCompanyId) {
        throw new UnauthorizedException('Sesión sin compañía');
      }

      this.checkSessionLock(sessionUserId);

      // Solo PINs de la misma compañía que la sesión
      const pinDocs = await this.pinRepo.find({
        where: { companyId: String(sessionCompanyId), active: true },
        select: ['userId', 'pinHash'],
      });

      const checks = await Promise.all(
        pinDocs.map(async (d) => ((await bcrypt.compare(pin, d.pinHash)) ? d : null)),
      );
      const matches = checks.filter((d): d is UserPin => !!d);

      // 0 = PIN incorrecto; >1 = PIN duplicado (no debería pasar)
      if (matches.length !== 1) {
        this.registerSessionFailure(sessionUserId);
        throw new UnauthorizedException('PIN incorrecto');
      }

      const signer = await this.userRepo.findOne({
        where: { id: matches[0].userId },
        relations: { userGroups: { group: true }, company: true },
      });

      if (
        !signer ||
        !signer.state_user ||
        String(signer.company?.id) !== String(sessionCompanyId)
      ) {
        this.registerSessionFailure(sessionUserId);
        throw new UnauthorizedException('PIN incorrecto');
      }

      this.clearSessionFailures(sessionUserId);

      return {
        id: signer.id,
        username: signer.name_user,
        groups: (signer.userGroups ?? []).map((ug) => ug.group.name),
      };
    } catch (e) {
      this.fail(e, 'Error validando el PIN');
    }
  }

  // ---------- Crear o cambiar MI PIN ----------
  async setMyPin(params: {
    userId: string;
    currentPassword: string;
    newPin: string;
    ip?: string;
  }) {
    try {
      const { userId, currentPassword, newPin, ip } = params;
      this.validatePinFormat(newPin);

      // password_user tiene select:false, hay que pedirlo explícitamente
      const user = await this.userRepo
        .createQueryBuilder('u')
        .addSelect('u.password_user')
        .leftJoinAndSelect('u.company', 'company')
        .where('u.id = :userId', { userId })
        .getOne();
      if (!user) throw new NotFoundException('Usuario no encontrado');

      const passOk = await bcrypt.compare(currentPassword || '', user.password_user || '');
      if (!passOk) throw new UnauthorizedException('Contraseña incorrecta');

      const companyId = user.company.id;
      if (await this.isPinTaken(companyId, newPin, userId)) {
        throw new ConflictException('Ese PIN no está disponible. Elige otro.');
      }

      const newHash = await bcrypt.hash(newPin, 10);
      const pinDoc = await this.pinRepo.findOne({ where: { userId } });

      if (!pinDoc) {
        await this.pinRepo.save(
          this.pinRepo.create({ userId, companyId, pinHash: newHash, history: [] }),
        );
        return { created: true };
      }

      const recientes = [pinDoc.pinHash, ...pinDoc.history.map((h) => h.pinHash)].slice(
        0,
        REUSE_CHECK,
      );
      for (const hash of recientes) {
        if (await bcrypt.compare(newPin, hash)) {
          throw new BadRequestException('No puedes reutilizar un PIN reciente.');
        }
      }

      pinDoc.history.unshift({
        pinHash: pinDoc.pinHash,
        changedAt: new Date().toISOString(),
        changedBy: userId,
        reason: 'cambio_usuario',
        ip: ip ?? null,
      });
      if (pinDoc.history.length > HISTORY_MAX) pinDoc.history.pop();

      pinDoc.pinHash = newHash;
      pinDoc.lastChangedAt = new Date();
      pinDoc.active = true;
      await this.pinRepo.save(pinDoc);

      return { created: false };
    } catch (e) {
      this.fail(e, 'Error guardando el PIN');
    }
  }

  // ---------- Reset por administrador ----------
  async resetPinByAdmin(params: {
    adminId: string;
    adminCompanyId: string;
    adminGroups: string[];
    userId: string;
    newPin: string;
    ip?: string;
  }) {
    try {
      const { adminId, adminCompanyId, adminGroups, userId, newPin, ip } = params;

      // Ajusta los nombres de grupo a los que uses para administrar
      const ADMIN_GROUPS = ['ADMINS', 'COMPANY_ADMIN', 'ADMIN'];
      if (!adminGroups?.some((g) => ADMIN_GROUPS.includes(g))) {
        throw new ForbiddenException('No autorizado');
      }

      this.validatePinFormat(newPin);

      const target = await this.userRepo.findOne({
        where: { id: userId },
        relations: { company: true },
      });
      if (!target) throw new NotFoundException('Usuario no encontrado');

      if (String(target.company.id) !== String(adminCompanyId)) {
        throw new ForbiddenException('No autorizado');
      }

      if (await this.isPinTaken(target.company.id, newPin, target.id)) {
        throw new ConflictException('Ese PIN no está disponible. Elige otro.');
      }

      const newHash = await bcrypt.hash(newPin, 10);
      const pinDoc = await this.pinRepo.findOne({ where: { userId: target.id } });

      if (!pinDoc) {
        await this.pinRepo.save(
          this.pinRepo.create({
            userId: target.id,
            companyId: target.company.id,
            pinHash: newHash,
            history: [],
          }),
        );
        return { created: true, userId: target.id };
      }

      pinDoc.history.unshift({
        pinHash: pinDoc.pinHash,
        changedAt: new Date().toISOString(),
        changedBy: adminId,
        reason: 'reset_admin',
        ip: ip ?? null,
      });
      if (pinDoc.history.length > HISTORY_MAX) pinDoc.history.pop();

      pinDoc.pinHash = newHash;
      pinDoc.lastChangedAt = new Date();
      pinDoc.active = true;
      await this.pinRepo.save(pinDoc);

      return { created: false, userId: target.id };
    } catch (e) {
      this.fail(e, 'Error restableciendo el PIN');
    }
  }

  // ---------- ADMIN: activar/desactivar PIN obligatorio ----------
  async setPinRequired(params: {
    adminCompanyId: string;
    adminGroups: string[];
    userId: string;
    required: boolean;
  }) {
    try {
      const { adminCompanyId, adminGroups, userId, required } = params;

      const ADMIN_GROUPS = ['ADMINS', 'COMPANY_ADMIN', 'ADMIN'];
      if (!adminGroups?.some((g) => ADMIN_GROUPS.includes(g))) {
        throw new ForbiddenException('No autorizado');
      }
      if (typeof required !== 'boolean') {
        throw new BadRequestException('El valor "required" debe ser true o false.');
      }

      const target = await this.userRepo.findOne({
        where: { id: userId },
        relations: { company: true },
      });
      if (!target) throw new NotFoundException('Usuario no encontrado');
      if (String(target.company.id) !== String(adminCompanyId)) {
        throw new ForbiddenException('No autorizado');
      }

      await this.userRepo.update({ id: userId }, { pinRequired: required });
      return { userId, pinRequired: required };
    } catch (e) {
      this.fail(e, 'Error actualizando el PIN obligatorio');
    }
  }

  // ---------- ADMIN: listar usuarios de la compañía con su estado de PIN ----------
  async listUsersPinStatus(params: { adminCompanyId: string; adminGroups: string[] }) {
    try {
      const { adminCompanyId, adminGroups } = params;

      const ADMIN_GROUPS = ['ADMINS', 'COMPANY_ADMIN', 'ADMIN'];
      if (!adminGroups?.some((g) => ADMIN_GROUPS.includes(g))) {
        throw new ForbiddenException('No autorizado');
      }

      const users = await this.userRepo.find({
        where: { company: { id: String(adminCompanyId) } },
        relations: { employee: true, userGroups: { group: true } },
        order: { name_user: 'ASC' },
      });

      const pins = users.length
        ? await this.pinRepo.find({
            where: { userId: In(users.map((u) => u.id)) },
            select: ['userId', 'active', 'lastChangedAt'],
          })
        : [];
      const pinMap = new Map(pins.map((p) => [p.userId, p]));

      return users.map((u) => {
        const pin = pinMap.get(u.id);
        const fullName = [u.employee?.first_name1, u.employee?.last_name1]
          .filter(Boolean)
          .join(' ');
        return {
          id: u.id,
          username: u.name_user,
          email: u.email_user,
          fullName,
          active: u.state_user,
          groups: (u.userGroups ?? []).map((ug) => ug.group.name),
          pinRequired: !!u.pinRequired,
          hasPin: !!pin,
          pinActive: pin?.active ?? false,
          lastChangedAt: pin?.lastChangedAt ?? null,
        };
      });
    } catch (e) {
      this.fail(e, 'Error listando usuarios y PIN');
    }
  }

  // ---------- Estado de mi PIN ----------
  async getPinStatus(userId: string) {
    try {
      const pinDoc = await this.pinRepo.findOne({ where: { userId } });
      if (!pinDoc) return { hasPin: false };
      return {
        hasPin: true,
        active: pinDoc.active,
        lastChangedAt: pinDoc.lastChangedAt,
      };
    } catch (e) {
      this.fail(e, 'Error consultando el estado del PIN');
    }
  }
}