import { Controller } from '@nestjs/common';
import { LotsReplicaService } from './lots-replica.service';

@Controller('lots-replica')
export class LotsReplicaController {
  constructor(private readonly lotsReplicaService: LotsReplicaService) {}
}
