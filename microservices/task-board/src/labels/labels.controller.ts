// labels/labels.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Controller()
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @MessagePattern({ cmd: 'labels.create' })
  create(@Payload() createLabelDto: CreateLabelDto) {
    return this.labelsService.create(createLabelDto);
  }

  @MessagePattern({ cmd: 'labels.findAll' })
  findAll() {
    return this.labelsService.findAll();
  }

  @MessagePattern({ cmd: 'labels.findByBoard' })
  findByBoard(@Payload() boardId: string) {
    return this.labelsService.findByBoard(boardId);
  }

  @MessagePattern({ cmd: 'labels.findOne' })
  findOne(@Payload() id: string) {
    return this.labelsService.findOne(id);
  }

  @MessagePattern({ cmd: 'labels.update' })
  update(@Payload() data: { id: string; updateLabelDto: UpdateLabelDto }) {
    return this.labelsService.update(data.id, data.updateLabelDto);
  }

  @MessagePattern({ cmd: 'labels.remove' })
  remove(@Payload() id: string) {
    return this.labelsService.remove(id);
  } 
}