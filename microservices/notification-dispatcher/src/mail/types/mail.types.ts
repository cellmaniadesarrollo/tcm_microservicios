export type MailProviderKind = 'GMAIL' | 'SES' | 'SMTP';

/** Fuente única de verdad. Agregar un propósito = una entrada aquí. El orden es el de la pantalla. */
export const MAIL_PURPOSE_META = {
    NOTIFICATIONS: {
        label: 'Notificaciones',
        description: 'Avisos al cliente, como el saludo de cumpleaños',
        emptyHint: 'Sin conexión propia. Se usará la conexión General si existe.',
        enabled: true,
    },
    AUTHORIZATIONS: {
        label: 'Autorizaciones',
        description: 'Solicitudes de aprobación, como la creación de clientes',
        emptyHint: 'Sin conexión propia. Se usará la conexión General si existe.',
        enabled: true,
    },
    ALL: {
        label: 'General',
        description: 'Se usa para cualquier propósito que no tenga conexión propia',
        emptyHint: 'Aún no configuraste una conexión general.',
        enabled: true,
    },
    BILLING: {
        label: 'Facturación',
        description: 'Emails de facturación (reservado)',
        emptyHint: 'Sin conexión propia. Se usará la conexión General si existe.',
        enabled: false, // ponlo en true cuando se implemente
    },
} as const;

export type MailPurpose = keyof typeof MAIL_PURPOSE_META;
export const MAIL_PURPOSES = Object.keys(MAIL_PURPOSE_META) as MailPurpose[];

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
    readonly label: string;
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