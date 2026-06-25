import { Controller } from '@nestjs/common';
import { SpareAssignmentsService } from './spare-assignments.service';

@Controller('spare-assignments')
export class SpareAssignmentsController {
  constructor(private readonly spareAssignmentsService: SpareAssignmentsService) {}
}
