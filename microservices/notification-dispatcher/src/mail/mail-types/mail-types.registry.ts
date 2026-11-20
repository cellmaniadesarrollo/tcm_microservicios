import { MailType } from '../types/mail.types';
import { birthdayMail, BirthdayPayload } from './birthday/birthday.mail';

/** Cada tipo nuevo: su payload aquí + su entrada en MAIL_TYPES. */
export interface MailPayloads {
    BIRTHDAY: BirthdayPayload;
    // INVOICE: InvoicePayload;   ← futuro
}

export type MailTypeKey = keyof MailPayloads;

export const MAIL_TYPES: { [K in MailTypeKey]: MailType<MailPayloads[K]> } = {
    BIRTHDAY: birthdayMail,
};