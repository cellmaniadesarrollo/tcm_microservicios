import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { FastifyReply } from 'fastify';
import { join } from 'path';
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
getHtml(@Res() res: FastifyReply) {
    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>TeanCellmania</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              height: 100%;
              width: 100%;
              overflow: hidden;
            }
            img {
              width: 100%;
              height: 100%;
              object-fit: cover; /* mantiene la proporción sin deformar */
            }
          </style>
        </head>
        <body>
          <img src="/public/logo.jpeg" alt="Logo" />
        </body>
      </html>
    `;
    res.type('text/html').send(html);
    }

}
