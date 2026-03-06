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
@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,

    @InjectRepository(DeviceIMEI)
    private readonly imeiRepo: Repository<DeviceIMEI>,

    @InjectRepository(DeviceAccount)
    private readonly accountRepo: Repository<DeviceAccount>,
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

}
