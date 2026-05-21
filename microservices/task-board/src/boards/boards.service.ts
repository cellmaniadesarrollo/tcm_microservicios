import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board, BoardStatus } from './entities/board.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private boardRepository: Repository<Board>,
  ) {}

  async create(createBoardDto: CreateBoardDto): Promise<Board> {
    const board = this.boardRepository.create({
      ...createBoardDto,
      members: createBoardDto.members || [createBoardDto.ownerId],
      admins: createBoardDto.admins || [createBoardDto.ownerId],
    });
    return this.boardRepository.save(board);
  }

  async findAll(): Promise<Board[]> {
    return this.boardRepository.find();
  }

  async findByUser(userId: string): Promise<Board[]> {
    return this.boardRepository
      .createQueryBuilder('board')
      .where('board.ownerId = :userId', { userId })
      .orWhere('board.members @> ARRAY[:userId]', { userId })
      .getMany();
  } 

  async findOne(id: string): Promise<Board> {
    const board = await this.boardRepository.findOne({ where: { id } });
    if (!board) {
      throw new NotFoundException(`Board with ID ${id} not found`);
    }
    return board;
  }

  async update(id: string, updateBoardDto: UpdateBoardDto): Promise<Board> {
    const board = await this.findOne(id);
    
    if (updateBoardDto.status === BoardStatus.ARCHIVED && board.status !== BoardStatus.ARCHIVED) {
      updateBoardDto['archivedAt'] = new Date();
    }
    
    Object.assign(board, updateBoardDto);
    return this.boardRepository.save(board);
  }

  async remove(id: string): Promise<void> {
    const board = await this.findOne(id);
    await this.boardRepository.remove(board);
  }

  async addMember(id: string, userId: string): Promise<Board> {
    const board = await this.findOne(id);
    
    if (!board.members) {
      board.members = [];
    }
    
    if (board.members.includes(userId)) {
      throw new BadRequestException(`User ${userId} is already a member`);
    }
    
    board.members.push(userId);
    return this.boardRepository.save(board);
  }

  async removeMember(id: string, userId: string): Promise<Board> {
    const board = await this.findOne(id);
    
    if (!board.members || !board.members.includes(userId)) {
      throw new BadRequestException(`User ${userId} is not a member`);
    }
    
    board.members = board.members.filter(member => member !== userId);
    return this.boardRepository.save(board);
  }
}