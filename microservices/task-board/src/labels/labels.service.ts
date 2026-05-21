import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Label } from './entities/label.entity';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Label)
    private labelRepository: Repository<Label>,
  ) {}

  async create(createLabelDto: CreateLabelDto): Promise<Label> {
    const label = this.labelRepository.create(createLabelDto);
    return this.labelRepository.save(label);
  }

  async findAll(): Promise<Label[]> {
    return this.labelRepository.find();
  }

  async findByBoard(boardId: string): Promise<Label[]> {
    return this.labelRepository.find({
      where: { boardId },
      order: { name: 'ASC' }
    });
  }

  async findOne(id: string): Promise<Label> {
    const label = await this.labelRepository.findOne({ where: { id } });
    if (!label) {
      throw new NotFoundException(`Label with ID ${id} not found`);
    }
    return label;
  }

  async update(id: string, updateLabelDto: UpdateLabelDto): Promise<Label> {
    const label = await this.findOne(id);
    Object.assign(label, updateLabelDto);
    return this.labelRepository.save(label);
  }

  async remove(id: string): Promise<void> {
    const label = await this.findOne(id);
    await this.labelRepository.remove(label);
  }
}