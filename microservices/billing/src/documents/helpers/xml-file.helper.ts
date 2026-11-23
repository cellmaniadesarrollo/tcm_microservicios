import { promises as fs } from 'fs';
import { join } from 'path';

/** Carpeta dentro del proyecto de billing: microservices/billing/xml-debug */
const DEBUG_DIR = join(process.cwd(), 'xml-debug');

/**
 * Guarda el XML en disco solo para depuración.
 * Se desactiva en producción.
 */
export async function saveDebugXml(fileName: string, xml: string): Promise<string | null> {
  if (process.env.NODE_ENV === 'production') return null;

  await fs.mkdir(DEBUG_DIR, { recursive: true });
  const path = join(DEBUG_DIR, fileName);
  await fs.writeFile(path, xml, 'utf8');
  return path;
}