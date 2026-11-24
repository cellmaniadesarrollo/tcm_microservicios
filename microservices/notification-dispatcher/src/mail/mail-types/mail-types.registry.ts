import { MailType } from '../types/mail.types';
import { birthdayMail, BirthdayPayload } from './birthday/birthday.mail';
import { customerAuthorizationMail, CustomerAuthorizationPayload } from './customer-authorization/customer-authorization.mail';

export interface MailPayloads {
    BIRTHDAY: BirthdayPayload;
    CUSTOMER_AUTHORIZATION: CustomerAuthorizationPayload;
}

export type MailTypeKey = keyof MailPayloads;

export const MAIL_TYPES: { [K in MailTypeKey]: MailType<MailPayloads[K]> } = {
    BIRTHDAY: birthdayMail,
    CUSTOMER_AUTHORIZATION: customerAuthorizationMail,
};