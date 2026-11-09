export enum PrinterType {
    DYMO = 'DYMO',
    ZEBRA = 'ZEBRA',
}

/** Contrato con los servidores de impresión (/api/printtikets). */
export interface LabelPayload {
    topText1: string;
    topText2: string;
    bottomText1: string;
    cant: number;
    qrText: string;
    price: number;
    iva: boolean;
    f: 'C' | 'T';
}