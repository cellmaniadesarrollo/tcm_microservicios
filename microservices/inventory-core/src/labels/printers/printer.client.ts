import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LabelPayload, PrinterType } from '../types/labels.types';

/** Error con mensaje ya apto para el usuario (en español). */
class PrinterError extends Error { }

/** El resultado se decide solo por el código HTTP; el cuerpo de la respuesta se ignora. */
function messageForStatus(status: number): string {
    if (status === 401 || status === 403) return 'Acceso denegado a la impresora.';
    if (status === 502 || status === 503 || status === 504) return 'El servidor de impresión no responde.';
    if (status === 404) return 'El servicio de impresión no está disponible.';
    if (status >= 500) return 'La impresora no pudo imprimir la etiqueta.';
    return 'No se pudo realizar la impresión.';
}

@Injectable()
export class PrinterClient {
    private readonly logger = new Logger(PrinterClient.name);

    constructor(private readonly config: ConfigService) { }

    private required(name: string): string {
        const v = this.config.get<string>(name);
        if (!v) {
            this.logger.error(`Falta la variable de entorno ${name}`);
            throw new PrinterError('La impresora no está configurada.');
        }
        return v.replace(/\/+$/, '');
    }

    /** Envía una etiqueta. Resuelve si el servidor respondió 2xx; si no, lanza PrinterError. */
    async send(printer: PrinterType, label: LabelPayload): Promise<void> {
        const timeoutMs = Number(this.config.get('LABEL_PRINT_TIMEOUT_MS') ?? 20000);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);

        try {
            let res: Response;
            if (printer === PrinterType.DYMO) {
                res = await fetch(`${this.required('LABEL_DYMO_URL')}/api/printtikets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(label),
                    signal: ctrl.signal,
                });
            } else {
                // La Zebra solo acepta GET con token
                const params = new URLSearchParams({
                    ...Object.fromEntries(Object.entries(label).map(([k, v]) => [k, String(v)])),
                    key: this.required('LABEL_ZEBRA_KEY'),
                });
                res = await fetch(`${this.required('LABEL_ZEBRA_URL')}/api/printtikets?${params}`, {
                    signal: ctrl.signal,
                });
            }

            // No se lee el cuerpo: se descarta para liberar la conexión
            await res.body?.cancel().catch(() => undefined);

            if (!res.ok) {
                // Solo el código: la URL de la Zebra lleva el token
                this.logger.warn(`Impresión rechazada (${printer}): HTTP ${res.status}`);
                throw new PrinterError(messageForStatus(res.status));
            }
        } catch (e: any) {
            if (e instanceof PrinterError) throw e;
            if (e?.name === 'AbortError') throw new PrinterError('Tiempo de espera agotado.');
            this.logger.warn(`Fallo de red al imprimir (${printer}): ${e?.cause?.code ?? e?.name ?? 'desconocido'}`);
            throw new PrinterError('No se pudo conectar con la impresora.');
        } finally {
            clearTimeout(timer);
        }
    }
}