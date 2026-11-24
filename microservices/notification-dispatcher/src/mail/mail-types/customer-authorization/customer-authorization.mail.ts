import { CompanyBrand, MailType } from '../../types/mail.types';

export interface CustomerAuthorizationPayload {
    recipientName: string;
    requesterName: string;
    approveUrl: string;
    expiresInMinutes: number;
}

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const customerAuthorizationMail: MailType<CustomerAuthorizationPayload> = {
    key: 'CUSTOMER_AUTHORIZATION',
    label: 'Autorización de cliente',
    purpose: 'AUTHORIZATIONS',
    build({ recipientName, requesterName, approveUrl, expiresInMinutes }, brand: CompanyBrand) {
        const name = esc(recipientName);
        const requester = esc(requesterName);
        const company = esc(brand.name);
        const url = esc(approveUrl);

        return {
            subject: `Autorización requerida: ${requesterName} quiere crear un cliente`,
            text: [
                `Hola, ${recipientName}.`,
                `${requesterName} solicita autorización para crear un cliente en ${brand.name}.`,
                `Revisa y aprueba la solicitud aquí (vence en ${expiresInMinutes} minutos): ${approveUrl}`,
                `Si no reconoces esta solicitud, ignora este correo.`,
            ].join('\n\n'),
            html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td bgcolor="#111827" align="center" style="background-color:#111827;padding:22px 24px;">
          <div style="font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#93c5fd;">${company}</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hola, <strong>${name}</strong>.</p>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">
            <strong>${requester}</strong> solicita autorización para <strong>crear un cliente</strong>.
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 22px;">
            <tr><td bgcolor="#2563eb" style="background-color:#2563eb;border-radius:8px;">
              <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Revisar solicitud</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">La solicitud vence en <strong>${expiresInMinutes} minutos</strong>. La aprobación se confirma en la página que se abre.</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">Si no reconoces esta solicitud, ignora este correo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        };
    },
};