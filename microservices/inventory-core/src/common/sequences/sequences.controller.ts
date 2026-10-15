import { Controller } from '@nestjs/common';
import { SequencesService } from './sequences.service';

@Controller('sequences')
export class SequencesController {
  constructor(private readonly sequencesService: SequencesService) {}
}
