import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DeviceAccount } from './entities/device_account.entity';
import { In, Like, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { DeviceIMEI } from './entities/device_imei.entity';
import { Device } from './entities/device.entity';
import { randomUUID } from 'crypto';
import { DeviceResponseDto } from './dto/device-response.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { RpcException } from '@nestjs/microservices';
import { CheckWarrantyDto } from './dto/check-warranty.dto';
import { FindingProcedure } from '../order-findings/entities/finding-procedure.entity';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
@Injectable()
export class DevicesService {
  constructor(
    private readonly awsS3Service: AwsS3Service,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,

    @InjectRepository(DeviceIMEI)
    private readonly imeiRepo: Repository<DeviceIMEI>,

    @InjectRepository(DeviceAccount)
    private readonly accountRepo: Repository<DeviceAccount>,
    @InjectRepository(FindingProcedure)
    private readonly findingProcedureRepository: Repository<FindingProcedure>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
  ) { }

  async createDevice(data: any) {
    // 🔐 Validaciones iniciales obligatorias
    if (!data?.user?.companyId) {
      throw new RpcException(
        new BadRequestException('companyId es requerido (debe venir en data.user.companyId)'),
      );
    }

    const companyId = data.user.companyId;

    if (!data.models_id) {
      throw new RpcException(
        new BadRequestException('models_id es requerido'),
      );
    }

    if (!data.device_type_id) {
      throw new RpcException(
        new BadRequestException('device_type_id es requerido'),
      );
    }

    // 🧠 Serial autogenerado si viene vacío
    const serialNumber =
      data.serial_number && data.serial_number.trim() !== ''
        ? data.serial_number
        : `AUTO-${randomUUID()}`;

    // 🔥 NUEVA VALIDACIÓN: Comprobar IMEIs ANTES de crear nada
    if (data.imeis?.length > 0) {
      if (!Array.isArray(data.imeis)) {
        throw new RpcException(
          new BadRequestException('imeis debe ser un array'),
        );
      }

      // Extraer y limpiar números IMEI
      const imeiNumbers = data.imeis
        .map((i: any) => i?.imei_number?.toString().trim())
        .filter(Boolean);

      if (imeiNumbers.length !== data.imeis.length) {
        throw new RpcException(
          new BadRequestException('Todos los IMEIs deben tener un imei_number válido'),
        );
      }

      // Evitar duplicados dentro de la misma petición
      const uniqueImeis = new Set(imeiNumbers);
      if (uniqueImeis.size !== imeiNumbers.length) {
        throw new RpcException(
          new BadRequestException('No se permiten IMEIs duplicados en la misma solicitud'),
        );
      }

      // 🔍 CONSULTA REAL: ¿Ya existen en la empresa?
      const existingImeis = await this.imeiRepo.find({
        where: {
          company_id: companyId,
          imei_number: In(imeiNumbers),
        },
        select: ['imei_number'], // solo traemos lo necesario
      });

      if (existingImeis.length > 0) {
        const duplicados = existingImeis.map((e) => e.imei_number).join(', ');
        throw new RpcException(
          new ConflictException(
            `Los siguientes IMEIs ya existen para esta empresa: ${duplicados}`,
          ),
        );
      }
    }

    // Validación de accounts (opcional)
    if (data.accounts?.length > 0) {
      if (!Array.isArray(data.accounts)) {
        throw new RpcException(
          new BadRequestException('accounts debe ser un array'),
        );
      }
    }

    try {
      // 1️⃣ Crear entidad base del dispositivo
      const device = this.deviceRepo.create({
        company_id: companyId,
        serial_number: serialNumber,
        color: data.color,
        storage: data.storage,
        models_id: data.models_id,
        device_type_id: data.device_type_id,
      });

      // 2️⃣ Guardar dispositivo
      const savedDevice = await this.deviceRepo.save(device);

      // 3️⃣ Guardar IMEIs (ahora 100% seguro que no existen)
      if (data.imeis?.length > 0) {
        const imeis = data.imeis.map((i: any) =>
          this.imeiRepo.create({
            imei_number: i.imei_number,
            company_id: companyId,
            device: savedDevice,
          }),
        );

        await this.imeiRepo.save(imeis);
      }

      // 4️⃣ Guardar cuentas (si aplica)
      if (data.accounts?.length > 0) {
        const accounts = data.accounts.map((a: any) =>
          this.accountRepo.create({
            username: a.username,
            password: a.password,
            account_type: a.account_type,
            device: savedDevice,
          }),
        );

        await this.accountRepo.save(accounts);
      }

      // 5️⃣ Retornar dispositivo completo
      return this.deviceRepo.findOne({
        where: {
          device_id: savedDevice.device_id,
          company_id: companyId,
        },
        relations: ['imeis', 'accounts'],
      });
    } catch (error) {
      // (Mismo manejo de errores de TypeORM que antes - se mantiene por seguridad)
      if (error instanceof QueryFailedError) {
        const driverError = (error as QueryFailedError).driverError as any;

        if (driverError?.code === '23505') {
          const constraint = driverError?.constraint || '';

          if (constraint.includes('serial_number')) {
            throw new RpcException(
              new ConflictException('El serial_number ya existe para esta empresa'),
            );
          }

          if (constraint.includes('imei_number')) {
            throw new RpcException(
              new ConflictException('Uno o más IMEIs ya existen para esta empresa'),
            );
          }

          throw new RpcException(
            new ConflictException('Ya existe un registro con los mismos datos únicos'),
          );
        }

        if (driverError?.code === '23503') {
          throw new RpcException(
            new BadRequestException('El modelo o tipo de dispositivo no existe'),
          );
        }
      }

      throw new RpcException(
        new InternalServerErrorException('Error inesperado al crear el dispositivo'),
      );
    }
  }

  async searchByIMEIOrSerial(search: string, user: any) {
    const companyId = user.companyId;

    return this.deviceRepo
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.imeis', 'imei')
      .leftJoinAndSelect('device.model', 'model')
      .leftJoinAndSelect('device.accounts', 'accounts')
      .where('device.company_id = :companyId', { companyId })
      .andWhere(
        `
      (
        imei.imei_number ILIKE :search
        OR device.serial_number ILIKE :search
      )
      `,
        { search: `%${search}%` },
      )
      .getMany();
  }
  async findOneById(deviceId: number, user: any): Promise<DeviceResponseDto | null> {
    const companyId = user.companyId;
    const device = await this.deviceRepo.findOne({
      where: {
        device_id: deviceId,
        company_id: companyId,
      },
      relations: ['imeis', 'accounts'],
    });

    if (!device) return null;

    return {
      device_id: device.device_id,
      serial_number: device.serial_number,
      models_id: device.models_id,
      device_type_id: device.device_type_id,
      color: device.color,
      storage: device.storage,
      imeis: device.imeis.map(i => ({
        imei_id: i.imei_id,
        imei_number: i.imei_number,
      })),
      accounts: device.accounts.map(a => ({
        account_id: a.account_id,
        username: a.username,
        account_type: a.account_type,
      })),
    };
  }
  async updateDevice(
    deviceId: number,
    user: { companyId: string },
    dto: UpdateDeviceDto,
  ): Promise<DeviceResponseDto> {

    const device = await this.deviceRepo.findOne({
      where: {
        device_id: deviceId,
        company_id: user.companyId,
      },
      relations: ['imeis', 'accounts'],
    });

    if (!device) {
      throw new Error('Device not found');
    }

    // 1️⃣ Campos simples
    device.models_id = dto.models_id;
    device.device_type_id = dto.device_type_id;
    if (dto.color !== undefined) {
      device.color = dto.color;
    }

    if (dto.storage !== undefined) {
      device.storage = dto.storage;
    }
    // 2️⃣ IMEIs → sincronización
    device.imeis = this.syncImeis(device, dto.imeis, user.companyId);

    // 3️⃣ Accounts → sincronización
    device.accounts = this.syncAccounts(device, dto.accounts);

    await this.deviceRepo.save(device);

    return this.mapToResponse(device);
  }

  private syncImeis(
    device: Device,
    incoming: { imei_id?: number; imei_number: string }[],
    companyId: string,
  ): DeviceIMEI[] {

    const existingMap = new Map(
      device.imeis.map(i => [i.imei_id, i]),
    );

    const result: DeviceIMEI[] = [];

    for (const item of incoming) {
      if (item.imei_id && existingMap.has(item.imei_id)) {
        // 🔄 update
        const imei = existingMap.get(item.imei_id);
        if (!imei) continue;
        imei.imei_number = item.imei_number;
        result.push(imei);
        existingMap.delete(item.imei_id);
      } else {
        // ➕ create
        const imei = this.imeiRepo.create({
          imei_number: item.imei_number,
          company_id: companyId,
          device,
        });
        result.push(imei);
      }
    }

    // ❌ los que quedaron → se eliminan
    existingMap.forEach(i => this.imeiRepo.remove(i));

    return result;
  }
  private syncAccounts(
    device: Device,
    incoming: {
      account_id?: number;
      username: string;
      password?: string;
      account_type: string;
    }[],
  ): DeviceAccount[] {

    const existingMap = new Map(
      device.accounts.map(a => [a.account_id, a]),
    );

    const result: DeviceAccount[] = [];

    for (const item of incoming) {
      if (item.account_id && existingMap.has(item.account_id)) {
        // 🔄 update
        const acc = existingMap.get(item.account_id);
        if (!acc) continue;
        acc.username = item.username;
        acc.password = item.password ?? acc.password;
        acc.account_type = item.account_type;
        result.push(acc);
        existingMap.delete(item.account_id);
      } else {
        // ➕ create
        const acc = this.accountRepo.create({
          username: item.username,
          password: item.password ?? undefined,
          account_type: item.account_type,
          device,
        });
        result.push(acc);
      }
    }

    // ❌ eliminar los que ya no vienen
    existingMap.forEach(a => this.accountRepo.remove(a));

    return result;
  }
  private mapToResponse(device: Device): DeviceResponseDto {
    return {
      device_id: device.device_id,
      models_id: device.models_id,
      device_type_id: device.device_type_id,
      serial_number: device.serial_number,
      color: device.color,
      storage: device.storage,
      imeis: device.imeis.map(i => ({
        imei_id: i.imei_id,
        imei_number: i.imei_number,
      })),
      accounts: device.accounts.map(a => ({
        account_id: a.account_id,
        username: a.username,
        account_type: a.account_type,
      })),
    };
  }


  async checkWarrantyByImei(dto: CheckWarrantyDto) {
    // 1️⃣ Buscar el IMEI
    const imeiRecords = await this.imeiRepo.find({
      where: { imei_number: dto.imei },
      relations: {
        device: {
          model: true,
          type: true,
          imeis: true,
        },
      },
    });

    if (!imeiRecords.length) {
      throw new RpcException({
        statusCode: 404,
        message: `No se encontró un dispositivo con IMEI ${dto.imei}`,
      });
    }

    // 2️⃣ Device IDs para este IMEI
    const deviceIds = imeiRecords.map((r) => r.device.device_id);

    // 3️⃣ Procedimientos con garantía (sin join de attachments)
    const procedures = await this.findingProcedureRepository
      .createQueryBuilder('fp')
      .innerJoinAndSelect('fp.finding', 'finding')
      .innerJoinAndSelect('finding.order', 'order')
      .leftJoinAndSelect('order.currentStatus', 'status')
      .leftJoinAndSelect('order.company', 'company')
      .leftJoinAndSelect('fp.performedBy', 'tech')
      // ❌ Ya no hay leftJoinAndSelect de attachments aquí
      .where('order.device_id IN (:...deviceIds)', { deviceIds })
      .andWhere('fp.warranty_days IS NOT NULL')
      .andWhere('fp.warranty_days > 0')
      //.andWhere('fp.was_solved = true')
      .andWhere('fp.is_active = true')
      .andWhere('finding.is_active = true')
      .orderBy('fp.createdAt', 'DESC')
      .getMany();
    console.log(procedures)
    // 4️⃣ Carga manual de attachments (igual que getOrderFullData)
    const procedureIds = procedures.map((fp) => fp.id);

    const allAttachments = procedureIds.length
      ? await this.attachmentRepository.find({
        where: {
          entity_type: AttachmentEntityType.PROCEDURE,
          entity_id: In(procedureIds),
          is_active: true,
        },
        order: { createdAt: 'ASC' },
      })
      : [];

    // 5️⃣ Firmar URLs de los attachments
    if (allAttachments.length) {
      await Promise.all(
        allAttachments.map((att) =>
          this.awsS3Service
            .getPresignedUrl(att.file_url, 3600)
            .then((signed) => { att.file_url = signed; })
            .catch((err) =>
              console.error(`[ERROR] Presigned PROCEDURE att ${att.id}:`, err.message),
            ),
        ),
      );
    }

    // 6️⃣ Mapa entity_type_id → Attachment[]
    const attachmentsMap = new Map<string, Attachment[]>();
    allAttachments.forEach((att) => {
      const key = `${att.entity_type}_${att.entity_id}`;
      if (!attachmentsMap.has(key)) attachmentsMap.set(key, []);
      attachmentsMap.get(key)!.push(att);
    });

    // 7️⃣ Calcular vigencia + asignar attachments firmados
    const now = new Date();

    const warranties = procedures.map((fp) => {
      const expiresAt = new Date(fp.createdAt);
      expiresAt.setDate(expiresAt.getDate() + fp.warranty_days);

      const isActive = expiresAt > now;
      const daysRemaining = isActive
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const procKey = `${AttachmentEntityType.PROCEDURE}_${fp.id}`;
      const attachments = attachmentsMap.get(procKey) ?? [];

      return {
        // ❌ procedure_id removido
        description: fp.description,
        warranty_days: fp.warranty_days,
        issued_at: fp.createdAt,
        expires_at: expiresAt,
        is_active: isActive,
        days_remaining: daysRemaining,
        performed_by: fp.performedBy
          ? { name: fp.performedBy.username }  // ❌ id removido
          : null,
        attachments: attachments.map((a) => ({
          file_name: a.file_name,
          file_url: a.file_url,
          file_type: a.file_type,
        })),
        order: {
          // ❌ id removido
          order_number: fp.finding.order.order_number,
          // ❌ public_id removido
          status: fp.finding.order.currentStatus?.name ?? null,
          company: fp.finding.order.company
            ? { name: fp.finding.order.company.name }  // ❌ id removido
            : null,
        },
      };
    });

    const device = imeiRecords[0].device;
    // 🚨 VALIDACIÓN NUEVA: Si no hay garantías en la lista, lanzamos error
    if (warranties.length === 0) {
      throw new RpcException({
        statusCode: 404,
        message: `No se encontraron registros de garantía para el IMEI ${dto.imei}`,
      });
    }
    return {
      imei: dto.imei,
      device: {
        // ❌ device_id removido
        model: device.model?.models_name ?? null,
        type: device.type?.name ?? null,
        color: device.color ?? null,
        storage: device.storage ?? null,
        all_imeis: device.imeis.map((i) => i.imei_number),
      },
      has_active_warranty: warranties.some((w) => w.is_active),
      warranties,
    };
  }
}
