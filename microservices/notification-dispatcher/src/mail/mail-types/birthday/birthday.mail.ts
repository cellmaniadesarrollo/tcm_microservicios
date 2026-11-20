// mail/mail-types/birthday/birthday.mail.ts
import { CompanyBrand, MailType } from '../../types/mail.types';

export interface BirthdayPayload {
    firstName: string;
    logoUrl?: string;
    bannerUrl?: string;
}

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const birthdayMail: MailType<BirthdayPayload> = {
    key: 'BIRTHDAY',
    purpose: 'NOTIFICATIONS',

    build({ firstName, logoUrl, bannerUrl }: BirthdayPayload, brand: CompanyBrand) {
        const name = esc(firstName);
        const company = esc(brand.name);
        const safeLogo = 'https://teamcellmania-public.s3.us-east-1.amazonaws.com/eventologos/logo-teamcellmania.png';
        const safeBanner = bannerUrl ? esc(bannerUrl) : '';

        return {
            subject: `¡Felicidades, ${firstName}! Mañana es tu cumpleaños 🎂`,
            text: [
                `¡Hola, ${firstName}!`,
                `¡Felicidades! En ${brand.name} queremos adelantarnos a tu día para desearte un feliz cumpleaños. ¡Que tengas un día increíble!`,
                `Como regalo especial, acércate mañana a nuestro local con tu cédula y muestra este correo para reclamar una mica de vidrio GRATIS.`,
                `¡Te esperamos!`,
            ].join('\n\n'),
            html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>¡Feliz Cumpleaños!</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Contenedor principal -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
          
          <!-- Cabecera con fondo sólido de respaldo para evitar texto invisible -->
          <tr>
            <td align="center" bgcolor="#111827" style="background-color:#111827;padding:28px 24px 24px;">
              ${safeLogo
                    ? `<img src="${safeLogo}" alt="${company}" width="140" style="display:block;max-height:52px;width:auto;margin:0 auto 14px;" />`
                    : `<div style="font-size:14px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#93c5fd;margin-bottom:10px;">${company}</div>`
                }
              <div style="font-size:38px;line-height:1;margin-bottom:10px;">🎂🎉🎈</div>
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#fbbf24;">
                ¡Felicidades, ${name}!
              </p>
 
            </td>
          </tr>

          <!-- Banner opcional (URL pública S3) -->
          ${safeBanner
                    ? `
          <tr>
            <td style="padding:0;">
              <img src="${safeBanner}" alt="Feliz Cumpleaños ${name}" width="580" style="display:block;width:100%;max-width:580px;height:auto;border:0;" />
            </td>
          </tr>`
                    : ''
                }

          <!-- Cuerpo del mensaje -->
          <tr>
            <td style="padding:28px 28px 16px;background-color:#ffffff;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
                ¡Hola, <strong>${name}</strong>!
              </p>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#374151;">
                ¡Felicidades por adelantado! En <strong>${company}</strong> queremos celebrar contigo y desearte un <strong>feliz cumpleaños</strong>. ¡Que sea un año lleno de éxitos y buenos momentos!
              </p>

              <!-- Tarjeta Cupón de Regalo -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eff6ff" style="background-color:#eff6ff;border:2px dashed #2563eb;border-radius:12px;margin:0 0 22px;">
                <tr>
                  <td align="center" style="padding:22px 20px;">
                    <span style="display:inline-block;background-color:#2563eb;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:999px;margin-bottom:10px;">
                      🎁 Regalo de Cumpleaños
                    </span>
                    <h2 style="margin:0 0 8px;font-size:22px;color:#1e3a8a;font-weight:800;">
                      ¡Una MICA DE VIDRIO GRATIS para tu celular!
                    </h2>
                    <p style="margin:0;font-size:15px;line-height:1.5;color:#1f2937;">
                      Acércate <strong>mañana</strong> a nuestro local con tu <strong>cédula</strong> y muestra <strong>este correo</strong> para reclamar tu regalo.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Detalles / Recordatorio -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f9fafb" style="background-color:#f9fafb;border-radius:10px;margin-bottom:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;line-height:1.6;color:#4b5563;">
                    <strong style="color:#111827;">📌 Condiciones para el canje:</strong><br />
                    • Válido únicamente el día de tu cumpleaños (mañana).<br />
                    • Presentar tu cédula y mostrar este correo en tienda.<br />
                    • Incluye instalación de la mica de vidrio (sujeto a disponibilidad de modelo).
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pie de página -->
          <tr>
            <td align="center" bgcolor="#fafafa" style="padding:18px 28px 26px;border-top:1px solid #e5e7eb;background-color:#fafafa;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">
                ¡Te esperamos mañana para celebrarlo! 🎂
              </p>
              <p style="margin:0;font-size:12px;color:#6b7280;">
                Enviado con cariño por el equipo de ${company}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        };
    },
};