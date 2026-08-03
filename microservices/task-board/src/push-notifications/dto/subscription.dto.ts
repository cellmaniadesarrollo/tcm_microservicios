// src/push-notifications/dto/subscription.dto.ts
export class SubscriptionKeysDto {
  p256dh: string;
  auth: string;
}

export class SubscriptionDto {
  endpoint: string;
  expirationTime: Date | null;  // ✅ Permitir null
  keys: SubscriptionKeysDto;
}

export class SendNotificationDto {
  userId: string;  // ✅ Required
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    taskId?: string;
    boardId?: string;
    taskTitle?: string;
    [key: string]: any;
  };
}

export class SendToMultipleDto {
  userIds: string[];
  notification: SendNotificationDto;
}

export class UnsubscribeDto {
  userId: string;
  endpoint: string;
}

export class SendToBoardDto {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    taskId?: string;
    taskTitle?: string;
    [key: string]: any;
  };
  excludeUserId?: string;
}