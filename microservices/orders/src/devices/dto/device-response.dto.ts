export class DeviceResponseDto {
  device_id: number;

  // 🔑 necesarios para edición
  models_id: number;
  device_type_id: number;

  serial_number: string;
  color: string;
  storage: string;

  imeis: {
    imei_id: number;
    imei_number: string;
  }[];

  accounts: {
    account_id: number;
    username: string;
    account_type: string;
  }[];
}
