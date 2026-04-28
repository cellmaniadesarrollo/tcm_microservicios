export class UpdateDeviceDto {
  models_id: number;
  device_type_id: number;
  color?: string;
  storage?: string;

  imeis: {
    imei_id?: number;
    imei_number: string;
  }[];

  accounts: {
    account_id?: number;
    username: string;
    password?: string;
    account_type: string;
  }[];
}
