import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

const HOSTS = {
    PRODUCTION: 'https://cel.sri.gob.ec',
    TEST: 'https://celcer.sri.gob.ec',
} as const;
const PATH = '/comprobantes-electronicos-ws/AutorizacionComprobantesOffline';
const TIMEOUT_MS = 7_000;
const ATTEMPTS = 2;

export class SriUnavailableError extends Error { }

export type SriState = 'AUTHORIZED' | 'NOT_AUTHORIZED' | 'NOT_FOUND';

export interface SriAuthorization {
    state: SriState;
    authorizationNumber: string | null;
    authorizationDate: string | null;
    /** XML de la factura (solo si el SRI lo devolvió). */
    xml: string | null;
    messages: string[];
}

const asArray = <T>(v: T | T[] | undefined | null | ''): T[] => (v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v]);

@Injectable()
export class SriClientService {
    private readonly logger = new Logger(SriClientService.name);

    // Sin entidades externas: fast-xml-parser no resuelve DTD, así que no hay XXE.
    // parseTagValue=false: todo queda como texto (los códigos con ceros no se vuelven números).
    readonly parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true,
        parseTagValue: false,
        parseAttributeValue: false,
        trimValues: true,
        isArray: (name) => ['autorizacion', 'mensaje', 'detalle', 'campoAdicional', 'impuesto'].includes(name),
    });

    async fetchAuthorization(accessKey: string, environment: 'PRODUCTION' | 'TEST'): Promise<SriAuthorization> {
        const body =
            `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">` +
            `<soapenv:Header/><soapenv:Body><ec:autorizacionComprobante>` +
            `<claveAccesoComprobante>${accessKey}</claveAccesoComprobante>` +
            `</ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>`;

        let lastError: unknown;
        for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
            try {
                const res = await fetch(`${HOSTS[environment]}${PATH}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
                    body,
                    signal: AbortSignal.timeout(TIMEOUT_MS),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return this.parseResponse(await res.text());
            } catch (error: any) {
                lastError = error;
                this.logger.warn(`SRI intento ${attempt}/${ATTEMPTS} falló: ${error?.message}`);
            }
        }
        throw new SriUnavailableError(String((lastError as any)?.message ?? lastError));
    }

    private parseResponse(xml: string): SriAuthorization {
        let root: any;
        try {
            root = this.parser.parse(xml)?.Envelope?.Body?.autorizacionComprobanteResponse?.RespuestaAutorizacionComprobante;
        } catch {
            throw new SriUnavailableError('Respuesta del SRI ilegible');
        }
        if (!root) throw new SriUnavailableError('Respuesta del SRI sin el formato esperado');

        const list = asArray<any>(root.autorizaciones?.autorizacion);
        if (!list.length) {
            return { state: 'NOT_FOUND', authorizationNumber: null, authorizationDate: null, xml: null, messages: [] };
        }

        const picked = list.find((a) => a.estado === 'AUTORIZADO') ?? list[0];
        const messages = asArray<any>(picked.mensajes?.mensaje).map((m) =>
            [m.mensaje, m.informacionAdicional].filter(Boolean).join(': '),
        );

        return {
            state: picked.estado === 'AUTORIZADO' ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
            authorizationNumber: picked.numeroAutorizacion ?? null,
            authorizationDate: picked.fechaAutorizacion ?? null,
            xml: typeof picked.comprobante === 'string' ? picked.comprobante : null,
            messages,
        };
    }
}