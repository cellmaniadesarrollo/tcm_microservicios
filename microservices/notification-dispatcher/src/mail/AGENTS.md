# AGENTS.md — Módulo `mail` (notification-dispatcher)

Guía para agentes y desarrolladores que agreguen o modifiquen correos en este módulo.
**Regla de oro: agregar un correo o un propósito nuevo se hace SOLO en este microservicio.** El gateway y el frontend no se tocan, porque leen el catálogo desde `GET /mail-config/purposes`.

## Estructura

```
src/mail/
├── mail.module.ts
├── controllers/mail-config.controller.ts   # MessagePatterns: list, upsert, delete, purposes
├── entities/company-mail-config.entity.ts  # company_mail_config (purpose = varchar(20), NO enum)
├── mail-types/
│   ├── mail-types.registry.ts              # MAIL_TYPES + MailPayloads (registro de correos)
│   ├── birthday/birthday.mail.ts
│   └── customer-authorization/customer-authorization.mail.ts
├── services/
│   ├── mail.service.ts                     # send(): resuelve config, arma contenido, envía
│   ├── mail-config.service.ts              # getResolved (propósito exacto → ALL), upsert verificado
│   ├── mail-config-admin.service.ts        # listPurposes() catálogo para el frontend
│   └── mail-transport.factory.ts           # transporte nodemailer cacheado
├── types/mail.types.ts                     # MAIL_PURPOSE_META, MailType, tipos y errores
└── utils/crypto.util.ts                    # AES-256-GCM de contraseñas
```

## Conceptos clave

- **Mail type**: un correo de negocio (cumpleaños, autorización de cliente, factura). Vive en `mail-types/<nombre>/<nombre>.mail.ts`. Define `key`, `label`, `purpose` y `build()`.
- **Propósito (`MailPurpose`)**: la *conexión SMTP/SES* desde la que se envía (remitente, credenciales). Varios mail types pueden compartir un propósito.
- **Fuente única de verdad**: `MAIL_PURPOSE_META` en `types/mail.types.ts`. De ahí salen `MailPurpose`, `MAIL_PURPOSES` y el catálogo del frontend.
- **Resolución de conexión** (`MailConfigService.getResolved`): primero la config activa del propósito exacto; si no existe o está inactiva, cae a `ALL`; si tampoco, lanza `MailConfigMissingError`. **No cae a `NOTIFICATIONS` ni a otro propósito.**

## Cómo agregar un correo nuevo

### Paso 1. Decidir el propósito

- ¿Debe salir por una conexión/remitente existente? Reutiliza ese `purpose`.
- ¿Audiencia o remitente distinto (por ejemplo facturación)? Crea un propósito nuevo (ver sección siguiente).

### Paso 2. Crear `mail-types/<nombre>/<nombre>.mail.ts`

```typescript
import { CompanyBrand, MailType } from '../../types/mail.types';

export interface InvoiceSentPayload {
    recipientName: string;
    invoiceNumber: string;
    total: string;
    downloadUrl: string;
}

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const invoiceSentMail: MailType<InvoiceSentPayload> = {
    key: 'INVOICE_SENT',            // MAYÚSCULAS_CON_GUION_BAJO, igual a la clave del registro
    label: 'Envío de factura',      // lo ve el usuario en los chips de la pantalla
    purpose: 'BILLING',

    build({ recipientName, invoiceNumber, total, downloadUrl }, brand: CompanyBrand) {
        return {
            subject: `Factura ${invoiceNumber} de ${brand.name}`.replace(/[\r\n]+/g, ' '),
            text: `Hola, ${recipientName}.\n\nAdjuntamos la factura ${invoiceNumber} por ${total}.\n${downloadUrl}`,
            html: `<!DOCTYPE html><html lang="es">...${esc(recipientName)}...</html>`,
            // attachments: [{ filename: 'factura.pdf', content: buffer, contentType: 'application/pdf' }],
        };
    },
};
```

### Paso 3. Registrarlo en `mail-types.registry.ts` (los DOS lugares)

```typescript
export interface MailPayloads {
    BIRTHDAY: BirthdayPayload;
    CUSTOMER_AUTHORIZATION: CustomerAuthorizationPayload;
    INVOICE_SENT: InvoiceSentPayload;               // 1. payload
}

export const MAIL_TYPES = {
    BIRTHDAY: birthdayMail,
    CUSTOMER_AUTHORIZATION: customerAuthorizationMail,
    INVOICE_SENT: invoiceSentMail,                  // 2. instancia
};
```

### Paso 4. Enviarlo desde quien lo necesite

```typescript
await this.mailService.send({
    companyId,
    type: 'INVOICE_SENT',
    to: customer.email,
    payload: { recipientName, invoiceNumber, total, downloadUrl },
});
```

`MailService` ya expone `MailConfigMissingError` y `MailSendError`. **Quien llama maneja y registra los errores**; `send()` solo los lanza.

## Cómo agregar un propósito nuevo

1. Agrega una entrada en `MAIL_PURPOSE_META` (`types/mail.types.ts`). El orden de las entradas es el orden de las tarjetas en pantalla.

```typescript
BILLING: {
    label: 'Facturación',
    description: 'Envío de facturas a clientes',
    emptyHint: 'Sin conexión propia. Se usará la conexión General si existe.',
    enabled: true,     // false = reservado, no aparece en pantalla y save() lo rechaza
},
```

2. Cuida que el nombre tenga **máximo 20 caracteres** (`varchar(20)`). No hay enum en BD, así que **no hace falta migración**.
3. Usa el nuevo `purpose` en el `.mail.ts` correspondiente.

El estado actual: `BILLING` existe con `enabled: false`. Cuando se implemente el correo de facturas, ponerlo en `true`.

## Checklist antes de hacer commit

- [ ] El `.mail.ts` tiene `key`, `label` y `purpose`.
- [ ] La clave está en `MailPayloads` **y** en `MAIL_TYPES`.
- [ ] Si hay propósito nuevo: entrada en `MAIL_PURPOSE_META`, nombre ≤ 20 caracteres, `enabled: true`.
- [ ] Todo dato dinámico en el HTML pasa por `esc()`.
- [ ] El asunto no contiene saltos de línea (`\r\n`) si incluye datos de usuario.
- [ ] Hay versión `text` además de `html`.
- [ ] Si lleva un enlace de acción, lo construye el backend (nunca el cliente), con token de un solo uso y expiración.
- [ ] No se modificó el gateway ni el frontend.

## Qué NO hacer

- No fijar propósitos en el gateway (`PURPOSES`) ni en el frontend (`MAIL_PURPOSE_LABELS`); ya no existen.
- No devolver nunca `passwordEncrypted` ni la contraseña descifrada. El frontend recibe `hasPassword` (ver `toPublic`).
- No loguear contraseñas ni credenciales. Solo el propósito, el proveedor y la empresa.
- No asumir que un propósito sin configurar cae a otro que no sea `ALL`.
- No enviar correos directo con nodemailer; siempre por `MailService.send()` para respetar la resolución de config y el registro de errores.
- No crear propósitos para cada correo. Un propósito representa un **remitente/conexión distinto**, no un tipo de correo.

## Gateway y frontend (referencia, no se tocan al agregar correos)

- Gateway: `GET /mail-config/purposes` debe declararse **antes** de cualquier ruta `:purpose`, o Nest tomará "purposes" como un propósito. La validación de propósito la hace el MS en `MailConfigAdminService.save()`.
- Frontend: pinta lo que devuelve `getMailPurposes()` (tarjeta por propósito, con chips de los correos que lo usan). Requiere `MatChipsModule`.

## Remitentes en producción (`teamcellmania.com`)

| Propósito | fromEmail | fromName |
|---|---|---|
| NOTIFICATIONS | notificaciones@teamcellmania.com | Teamcellmania |
| AUTHORIZATIONS | autorizaciones@teamcellmania.com | Teamcellmania Autorizaciones |

Cada remitente nuevo debe salir con SPF y DKIM válidos del dominio. Mantener el `fromName` distinto entre propósitos para que se distingan en la bandeja.

## Pruebas rápidas tras agregar un correo

1. `GET /mail-config/purposes` muestra el propósito y el correo en `mailTypes`.
2. Configurar la tarjeta en pantalla: "Guardar y verificar" debe pasar.
3. Disparar el envío y confirmar recepción, asunto, remitente y que el HTML se ve bien en móvil.
4. Eliminar la config del propósito y confirmar que cae a `ALL`; eliminar `ALL` y confirmar que falla con `MailConfigMissingError`.
