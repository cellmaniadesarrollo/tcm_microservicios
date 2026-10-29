import { BadRequestException, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProcessedFile } from './process-file.helper';

const logger = new Logger('ProcessPdf');
const GS_TIMEOUT_MS = 30_000;
const MIN_SIZE_TO_COMPRESS = 300 * 1024; // por debajo de esto no vale la pena
const MIN_SAVING = 0.9;                  // solo se usa el comprimido si pesa < 90% del original

const isPdf = (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-';

/** Valida el PDF y, si se puede, lo comprime. Nunca falla por culpa de la compresión. */
export async function processPdfForUpload(file: ProcessedFile): Promise<ProcessedFile> {
    if (!isPdf(file.buffer)) {
        throw new BadRequestException(`El archivo ${file.originalname} no es un PDF válido`);
    }
    if (file.size < MIN_SIZE_TO_COMPRESS) return file;

    const compressed = await compressWithGhostscript(file.buffer);
    if (!compressed || compressed.length >= file.size * MIN_SAVING) return file;

    logger.log(`${file.originalname}: ${file.size} -> ${compressed.length} bytes`);
    return { ...file, buffer: compressed, size: compressed.length };
}

async function compressWithGhostscript(input: Buffer): Promise<Buffer | null> {
    const dir = await mkdtemp(join(tmpdir(), 'pdf-'));
    const inPath = join(dir, 'in.pdf');
    const outPath = join(dir, 'out.pdf');

    try {
        await writeFile(inPath, input);

        const ok = await new Promise<boolean>((resolve) => {
            // Sin shell y con -dSAFER: el PDF viene del usuario
            const gs = spawn('gs', [
                '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER',
                '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5',
                '-dPDFSETTINGS=/ebook', // 150 dpi: legible para facturas con letra pequeña
                `-sOutputFile=${outPath}`, inPath,
            ], { stdio: 'ignore' });

            const timer = setTimeout(() => { gs.kill('SIGKILL'); resolve(false); }, GS_TIMEOUT_MS);
            gs.on('error', (err) => {          // ENOENT = Ghostscript no instalado
                clearTimeout(timer);
                logger.warn(`Ghostscript no disponible: ${err.message}`);
                resolve(false);
            });
            gs.on('close', (code) => { clearTimeout(timer); resolve(code === 0); });
        });
        if (!ok) return null;

        const out = await readFile(outPath);
        return isPdf(out) ? out : null;
    } catch (error: any) {
        logger.warn(`Fallo al comprimir PDF: ${error?.message}`);
        return null;
    } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
}