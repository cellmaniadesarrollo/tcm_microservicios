export interface RpcError {
  statusCode: number;
  message: string;
  error: string; // CÓDIGO de dominio (PLAN_NOT_FOUND, USER_EXISTS, etc)
}
