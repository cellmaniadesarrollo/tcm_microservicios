import { Injectable } from '@nestjs/common';
import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

@Injectable()
export class AppService {
  private config: any;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      this.config = JSON.parse(data);
      console.log('Config cargada:', this.config);
    } catch (error) {
      console.error('Error cargando config.json:', error.message);
      this.config = {
        connection: 'network',
        network: { ip: '192.168.10.161', port: 9100 },
      };
    }
  }

  async printReceipt(orderData: any) {
    const orderNumber = orderData.order_number ?? 'NA';
    const entryDateRaw = new Date(orderData.entry_date ?? Date.now());
    const entryDate = entryDateRaw.toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const companyName = orderData.company?.name?.toUpperCase() ?? 'TEAMCELLMANIA';
    const branchName = orderData.branch?.name ?? 'Matriz';

    const customerName = `${orderData.customer?.firstName ?? ''} ${orderData.customer?.lastName ?? ''}`.trim().toUpperCase() ?? 'N/A';
    const customerCI = orderData.customer?.idNumber ?? 'NA';
    const primaryPhone = orderData.customer?.contacts?.find(c => c.isPrimary)?.value ?? 'NA';

    const deviceModel = orderData.device?.model?.models_name ?? orderData.device?.model ?? 'N/A';
    const imei = orderData.device?.imeis?.[0]?.imei_number ?? 'N/A';
    const motivo = (orderData.detalleIngreso ?? 'NO ENCIENDE, SE QUEDA EN LOGO DE INICIO Y SE APAGA. POSIBLE FALLO DE SOFTWARE O BATERÍA').toUpperCase();

    const patron = orderData.patron ?? '';
    const password = orderData.password ?? '';

    const receivedByFull = orderData.createdBy?.first_name
      ? `${orderData.createdBy.first_name} ${orderData.createdBy.last_name ?? ''}`
      : 'NA';
    const receivedBy = receivedByFull.split(' ')[0] || 'NA'; // solo primer nombre

    const qrUrl = `https://tuweb.com/orden/${orderNumber}`; // ← cámbialo

    const printerIp = this.config.network?.ip ?? '192.168.10.161';
    const printerPort = this.config.network?.port ?? 9100;

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${printerIp}:${printerPort}`,
      options: { timeout: 5000 },
      characterSet: 'PC850_MULTILINGUAL' as any, // buen soporte para ñ y acentos
      removeSpecialCharacters: false,
      // width: 56,               // ← prueba con 56 primero (muy seguro)
      // width: 58,            // si tu impresora es de las que caben 58–60 en Font B
      width: 60,            // máximo típico en 80 mm con Font B
    });

    try {
      // ---------------- TICKET PRINCIPAL (el grande / cliente) ----------------
      printer.alignCenter();
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.setTextDoubleWidth();
      printer.println(companyName);
      printer.setTextNormal();

      // Mensaje especial (ejemplo miércoles)
      if (entryDateRaw.getDay() === 3) {
        printer.println('*** HOY MICA GRATIS ***');
      }

      printer.setTypeFontB();           // letra más pequeña → más contenido por línea
      printer.alignRight();
      printer.println(`No. ${orderNumber}`);

      printer.alignLeft();
      printer.tableCustom([
        { text: 'Cliente:', cols: 12, bold: true },
        { text: customerName, cols: 30 },
      ]);

      printer.tableCustom([
        { text: 'C.I.:', cols: 12, bold: true },
        { text: customerCI, cols: 30 },
      ]);

      printer.tableCustom([
        { text: 'Teléfono:', cols: 12, bold: true },
        { text: primaryPhone, cols: 30 },
      ]);

      printer.tableCustom([
        { text: 'Dispositivo:', cols: 12, bold: true },
        { text: deviceModel, cols: 30 },
      ]);

      printer.tableCustom([
        { text: 'IMEI:', cols: 12, bold: true },
        { text: imei, cols: 30 },
      ]);

      printer.tableCustom([
        { text: 'Fecha:', cols: 12, bold: true },
        { text: entryDate, cols: 30 },
      ]);

      printer.bold(false);
      printer.println('');
      printer.println('Motivo de ingreso:');
      printer.println(motivo);           // ← se envuelve automáticamente

      printer.newLine();
      printer.alignCenter();
      printer.bold(true);
      printer.println('ANÁLISIS VISUAL');
      printer.setTextNormal();

      // Imagen (si existe)
      const imagePath = path.join(process.cwd(), 'images/out.png');
      if (fs.existsSync(imagePath)) {
        await printer.printImage(imagePath);
        printer.newLine();
      }

      printer.alignLeft();
      printer.tableCustom([
        { text: 'Recibido por:', cols: 14, bold: true },
        { text: `${receivedBy} - ${orderData.createdBy?.phone ?? 'NA'}`, cols: 28 },
      ]);

      printer.alignCenter();
      printer.println('\nEscanee el código QR para ver el estado de su orden.');
      printer.drawLine();

      await printer.printQR(qrUrl, { cellSize: 3 }); // tamaño moderado del QR

      printer.drawLine();
      printer.setTypeFontB();
      printer.bold(true);
      printer.alignLeft();
      printer.println('- Costo mínimo de revisión: $4 (puede aumentar según modelo)');
      printer.println('- En la reparación se utilizan materiales, herramientas y tiempo.');
      printer.println('- Tiempo máximo para retirar el dispositivo: 3 meses.');

      printer.cut();
      //printer.lineFeed(3) // ← pequeño avance para que corte limpio y no desperdicie mucho

      // ---------------- TICKET PEQUEÑO (copia interna / mostrador) ----------------
      printer.alignCenter();
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.setTextDoubleWidth();
      printer.println(companyName);
      printer.setTextNormal();

      printer.setTypeFontB();
      printer.tableCustom([
        { text: entryDate, cols: 21, align: 'LEFT' },
        { text: `No.${orderNumber}`, cols: 21, align: 'RIGHT' },
      ]);

      printer.alignLeft();

      printer.tableCustom([
        { text: 'Cliente:', cols: 13, bold: true },
        { text: customerName, cols: 29 },
      ]);

      printer.tableCustom([
        { text: 'C.I.:', cols: 13, bold: true },
        { text: customerCI, cols: 29 },
      ]);

      printer.tableCustom([
        { text: 'Dispositivo:', cols: 13, bold: true },
        { text: deviceModel, cols: 29 },
      ]);

      printer.tableCustom([
        { text: 'IMEI:', cols: 13, bold: true },
        { text: imei, cols: 29 },
      ]);

      if (patron) {
        printer.tableCustom([
          { text: 'Patrón:', cols: 13, bold: true },
          { text: patron, cols: 29 },
        ]);
      }

      if (password) {
        printer.tableCustom([
          { text: 'Pin/Password:', cols: 13, bold: true },
          { text: password, cols: 29 },
        ]);
      }

      printer.println('');
      printer.println(`Motivo: ${motivo}`);

      printer.tableCustom([
        { text: 'Sucursal:', cols: 13, bold: true },
        { text: branchName, cols: 16 },
        { text: 'Recibe:', cols: 8, bold: true },
        { text: `${receivedBy}1234`, cols: 25 },
      ]);

      printer.cut();
      // printer.feed(4); // avance final para separar bien los tickets

      await printer.execute();
      console.log('Impresión completada OK');

    } catch (error) {
      console.error('Error al imprimir recibo:', error);
      throw error;
    }
  }
}