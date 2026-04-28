export class CreateAuditDto {
  userId: string;
  userName: string;
  userEmail: string;
  userRole?: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  action: string;
  actionDetail?: string;
  message: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    deviceType?: string;
    location?: string;
    timeSpent?: number;
  };
}