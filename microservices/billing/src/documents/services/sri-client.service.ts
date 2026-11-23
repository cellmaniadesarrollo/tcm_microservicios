import { Injectable, Logger } from '@nestjs/common';

export interface SriMessage {
  id?: string;
  message?: string;
  extra?: string;
  type?: string;
}

export interface SriReception {
  state: string; // RECIBIDA | DEVUELTA
  messages: SriMessage[];
}

export interface SriAuthorization {
  state: string | null; // AUTORIZADO | NO AUTORIZADO | null (aún sin respuesta)
  number?: string;
  date?: string;
  xml?: string;
  messages: SriMessage[];
}

/** La URL del catálogo trae ?wsdl; el POST SOAP va a la misma URL sin eso. */
const endpoint = (url: string) => url.replace(/\?wsdl$/i, '');

const tag = (src: string, name: string) =>
  src.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.trim();

const unCdata = (s?: string) => s?.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1');

function readMessages(src: string): SriMessage[] {
  const block = tag(src, 'mensajes');
  if (!block) return [];
  return [
    ...block.matchAll(
      /<identificador>([\s\S]*?)<\/identificador>\s*<mensaje>([\s\S]*?)<\/mensaje>(?:\s*<informacionAdicional>([\s\S]*?)<\/informacionAdicional>)?\s*<tipo>([\s\S]*?)<\/tipo>/g,
    ),
  ].map((m) => ({ id: m[1], message: m[2], extra: m[3], type: m[4] }));
}

@Injectable()
export class SriClientService {
  private readonly logger = new Logger(SriClientService.name);

  private async soap(url: string, body: string): Promise<string> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (!res.ok && !text.includes('Body>')) {
      throw new Error(`SRI respondió HTTP ${res.status}`);
    }
    return text;
  }

  /** validarComprobante: envía el XML firmado en base64. */
  async receive(receptionUrl: string, signedXml: string): Promise<SriReception> {
    const b64 = Buffer.from(signedXml, 'utf8').toString('base64');
    const envelope =
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">` +
      `<soapenv:Header/><soapenv:Body><ec:validarComprobante><xml>${b64}</xml></ec:validarComprobante></soapenv:Body></soapenv:Envelope>`;
    const raw = await this.soap(endpoint(receptionUrl), envelope);
    this.logger.debug(`Recepción SRI: ${raw.slice(0, 1500)}`);
    return { state: tag(raw, 'estado') ?? 'SIN_ESTADO', messages: readMessages(raw) };
  }

  /** autorizacionComprobante: consulta por clave de acceso. */
  async authorize(authorizationUrl: string, accessKey: string): Promise<SriAuthorization> {
    const envelope =
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">` +
      `<soapenv:Header/><soapenv:Body><ec:autorizacionComprobante><claveAccesoComprobante>${accessKey}</claveAccesoComprobante></ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>`;
    const raw = await this.soap(endpoint(authorizationUrl), envelope);
    this.logger.debug(`Autorización SRI: ${raw.slice(0, 1500)}`);

    const auth = tag(raw, 'autorizacion');
    if (!auth) return { state: null, messages: [] };
    return {
      state: tag(auth, 'estado') ?? null,
      number: tag(auth, 'numeroAutorizacion'),
      date: tag(auth, 'fechaAutorizacion'),
      xml: unCdata(tag(auth, 'comprobante')),
      messages: readMessages(auth),
    };
  }
}