import {
    Controller, Post, Delete, Get, Param,
    Res, Sse, MessageEvent, NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject } from 'rxjs';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {

}