export class DeviceResponseDto {
  device_id!: number;
  models_id!: number;
  device_type_id!: number;
  serial_number?: string;
  color?: string;
  storage?: string;
  observations?: string;
  imeis?: { imei_id: number; imei_number: string }[];
  accounts?: { account_id: number; username: string; account_type: string }[];

  // ── Confirmación de vinculación ──────────────────────────────────────────
  requiresConfirmation?: boolean;
  confirmationData?: {
    conflictingImeis: {
      imei_number: string;
      currentDeviceId: number | null; // null = huérfano
    }[];
    message: string;
  };
}