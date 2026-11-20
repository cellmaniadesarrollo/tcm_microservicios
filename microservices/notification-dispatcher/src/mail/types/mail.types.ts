export type MailProviderKind = 'GMAIL' | 'SES' | 'SMTP';

export type MailPurpose = 'ALL' | 'NOTIFICATIONS' | 'BILLING';
export const MAIL_PURPOSES: MailPurpose[] = ['ALL', 'NOTIFICATIONS', 'BILLING'];

export interface MailAttachment {
    filename: string;
    content?: Buffer | string;
    path?: string;
    contentType?: string;
}

export interface MailContent {
    subject: string;
    html: string;
    text: string;
    attachments?: MailAttachment[];
}

/** Datos de marca disponibles hoy (CompanyReplica solo trae name). */
export interface CompanyBrand {
    companyId: string;
    name: string;
}

/** Cada tipo de email de negocio implementa esto, en código. */
export interface MailType<TPayload> {
    readonly key: string;
    readonly purpose: MailPurpose;
    build(payload: TPayload, brand: CompanyBrand): MailContent | Promise<MailContent>;
}

export interface ResolvedMailConfig {
    id: string;
    purpose: MailPurpose;
    companyId: string;
    provider: MailProviderKind;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    replyTo: string | null;
}

export interface SendMailResult {
    messageId: string;
    accepted: string[];
    rejected: string[];
}

export class MailConfigMissingError extends Error {
    constructor(companyId: string, purpose?: string) {
        super(`La empresa ${companyId} no tiene configuración de email activa${purpose ? ` para ${purpose}` : ''}`);
        this.name = 'MailConfigMissingError';
    }
}

export class MailSendError extends Error {
    /** true = no tiene sentido reintentar (credenciales inválidas, buzón inexistente) */
    readonly permanent: boolean;

    constructor(cause: any) {
        super(cause?.message ?? 'Error enviando email');
        this.name = 'MailSendError';
        const code = Number(cause?.responseCode);
        this.permanent = cause?.code === 'EAUTH' || (code >= 500 && code < 600);
    }
}