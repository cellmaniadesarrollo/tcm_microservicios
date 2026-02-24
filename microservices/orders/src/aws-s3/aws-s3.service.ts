// src/aws-s3/aws-s3.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // ← Importante: esto faltaba
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AwsS3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly publicUrlPrefix: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION')!;
    this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME')!;

    this.publicUrlPrefix = `https://${this.bucketName}.s3.${this.region}.amazonaws.com`;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
  }

  /**
   * Sube un buffer/archivo a S3 y retorna la URL pública (si el bucket lo permite)
   * o la key para luego generar presigned URL.
   *
   * @param buffer Contenido del archivo
   * @param originalName Nombre original del archivo
   * @param mimeType Tipo MIME
   * @param pathPrefix Prefijo opcional (ej: 'findings/123/', 'procedures/456/')
   * @returns URL pública o URL con key (depende de si usas ACL public-read)
   */
  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    pathPrefix: string = '',
  ): Promise<string> {
    const fileKey = `${pathPrefix}${uuidv4()}-${originalName}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
      // ACL: 'public-read',   // ← Descomenta SOLO si quieres acceso público directo
      // Si dejas comentado = privado por defecto (recomendado + presigned)
    };

    try {
      await this.s3Client.send(new PutObjectCommand(params));

      // Opción 1: si usas bucket público o ACL public-read
      // return `${this.publicUrlPrefix}/${fileKey}`;

      // Opción 2: más segura → retornamos la key o la URL base
      // Muchos prefieren guardar solo la key en la DB
      return fileKey;           // ← recomendado
      // o return `${this.publicUrlPrefix}/${fileKey}`; // si luego extraes la key
    } catch (error) {
      console.error('Error subiendo a S3:', error);
      throw new InternalServerErrorException('Error al subir archivo a S3');
    }
  }

  /**
   * Genera una URL temporal (presigned) para acceder a un objeto privado
   *
   * @param fileKey  La key del objeto en S3 (ej: "users/abc123/factura.pdf")
   *                 o la URL completa (se intentará extraer la key)
   * @param expiresIn Tiempo de validez en segundos (default 1 hora = 3600)
   * @returns URL firmada temporal
   */
  async getPresignedUrl(fileUrl: string, expiresIn: number = 1800): Promise<string> {  // 30 min por defecto
    try {
      // Extracción robusta de la key
      let key: string;

      if (fileUrl.startsWith('http')) {
        // Quitamos el protocolo y dominio hasta el bucket
        const urlObj = new URL(fileUrl);
        key = urlObj.pathname.substring(1); // quita el primer "/"
      } else {
        key = fileUrl; // si ya viene solo la key
      }

      // Limpieza extra por si acaso (espacios, etc.)
      key = decodeURIComponent(key);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      console.error(`Error generando presigned URL para ${fileUrl}:`, error);
      // Fallback suave: devolvemos la original (solo para debug, en prod lanzar error o devolver null)
      return fileUrl;
    }
  }
}