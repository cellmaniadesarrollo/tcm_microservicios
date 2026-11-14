import { Controller, Inject } from '@nestjs/common';
import { SpareAssignmentsService } from './spare-assignments.service';
import { ClientProxy } from '@nestjs/microservices';

@Controller('spare-assignments')
export class SpareAssignmentsController {
  constructor(
    private readonly spareAssignmentsService: SpareAssignmentsService,

  ) { }
}