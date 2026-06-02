// boards/boards.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board, BoardStatus } from './entities/board.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { BoardMembersService } from './board-members.service';
import { BoardColumnsService } from './board-columns.service';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private boardRepository: Repository<Board>,
    private membersService: BoardMembersService,
    private columnsService: BoardColumnsService,
  ) {}

  async create(createBoardDto: CreateBoardDto): Promise<Board> {
    const boardData = {
      name: createBoardDto.name,
      description: createBoardDto.description,
      visibility: createBoardDto.visibility,
      ownerId: createBoardDto.ownerId,
      companyId: createBoardDto.companyId,
      settings: createBoardDto.settings,
    };
    
    const board = this.boardRepository.create(boardData);
    const savedBoard = await this.boardRepository.save(board);
    
    await this.membersService.addMember(
      savedBoard.id,
      {
        userId: createBoardDto.ownerId,
        roleName: 'Admin',
      },
      createBoardDto.ownerId
    );
    
    if (createBoardDto.members && createBoardDto.members.length > 0) {
      for (const userId of createBoardDto.members) {
        if (userId !== createBoardDto.ownerId) {
          await this.membersService.addMember(
            savedBoard.id,
            { userId, roleName: 'Member' },
            createBoardDto.ownerId
          );
        }
      }
    }
    
    if (createBoardDto.admins && createBoardDto.admins.length > 0) {
      for (const userId of createBoardDto.admins) {
        if (userId !== createBoardDto.ownerId) {
          await this.membersService.addMember(
            savedBoard.id,
            { userId, roleName: 'Admin' },
            createBoardDto.ownerId
          );
        }
      }
    }
    
    return savedBoard;
  }

  async findAll(): Promise<Board[]> {
    return this.boardRepository.find();
  }

  async findByUser(userId: string): Promise<Board[]> {
    const boards = await this.boardRepository
      .createQueryBuilder('board')
      .leftJoin('board.members', 'member')
      .where('board.ownerId = :userId', { userId })
      .orWhere('member.userId = :userId', { userId })
      .getMany();
    
    return boards;
  }

  async findOne(id: string): Promise<Board> {
    const board = await this.boardRepository.findOne({ 
      where: { id }
    });
    
    if (!board) {
      throw new NotFoundException(`Board with ID ${id} not found`);
    }
    return board;
  }

  async update(id: string, updateBoardDto: UpdateBoardDto): Promise<Board> {
    const board = await this.findOne(id);
    
    if (updateBoardDto.status === BoardStatus.ARCHIVED && board.status !== BoardStatus.ARCHIVED) {
      (updateBoardDto as any).archivedAt = new Date();
    }
    
    Object.assign(board, updateBoardDto);
    return this.boardRepository.save(board);
  }

  async remove(id: string): Promise<void> {
    const board = await this.findOne(id);
    
    await this.membersService.removeAllMembersFromBoard(id);
    await this.columnsService.removeAllColumns(id);
    
    await this.boardRepository.remove(board);
  }

  // ==================== MÉTODOS DELEGADOS PARA MIEMBROS ====================

  async getMembers(boardId: string) {
    return this.membersService.getBoardMembers(boardId);
  }

  async getBoardMembersWithDetails(boardId: string) {
    return this.membersService.getBoardMembersWithUserDetails(boardId);
  }

  async addMember(boardId: string, userId: string, invitedBy: string) {
    return this.membersService.addMember(
      boardId, 
      { userId, roleName: 'Member' }, 
      invitedBy
    );
  }

  async removeMember(boardId: string, userId: string) {
    return this.membersService.removeMember(boardId, userId);
  }

  async updateMemberRole(boardId: string, userId: string, roleName: string) {
    return this.membersService.updateMemberRole(boardId, userId, { roleName });
  }

  // ==================== MÉTODOS DELEGADOS PARA PERMISOS ====================

  async getMemberPermissions(boardId: string, userId: string) {
    return this.membersService.getUserPermissions(boardId, userId);
  }

  async updateCustomPermissions(boardId: string, userId: string, permissions: any) {
    return this.membersService.updateCustomPermissions(boardId, userId, permissions);
  }

  async hasPermission(boardId: string, userId: string, permission: string) {
    return this.membersService.hasPermission(boardId, userId, permission);
  }

  async hasPermissions(boardId: string, userId: string, permissions: string[]) {
    return this.membersService.hasPermissions(boardId, userId, permissions);
  }

  // ==================== MÉTODOS DELEGADOS PARA COLUMNAS (ACTUALIZADOS) ====================

  async setupDefaultColumns(boardId: string) {
    return this.columnsService.setupDefaultColumns(boardId);
  }

  async getColumns(boardId: string) {
    return this.columnsService.getColumns(boardId);
  }

  async addColumn(boardId: string, createColumnDto: any) {
    return this.columnsService.addColumn(boardId, createColumnDto);
  }

  async updateColumn(columnId: string, updateColumnDto: any) {
    return this.columnsService.updateColumn(columnId, updateColumnDto);
  }

  async removeColumn(columnId: string) {
    return this.columnsService.removeColumn(columnId);
  }

  async moveTask(boardId: string, moveTaskDto: any) {
    return this.columnsService.moveTask(boardId, moveTaskDto);
  }

  async reorderColumns(columnIds: string[]) {
    return this.columnsService.reorderColumns(columnIds);
  }

  async addTaskToColumn(columnId: string, taskId: string) {
    return this.columnsService.addTaskToColumn(columnId, taskId);
  }

  async removeTaskFromColumn(columnId: string, taskId: string) {
    return this.columnsService.removeTaskFromColumn(columnId, taskId);
  }

  async getTasksByColumn(columnId: string) {
    return this.columnsService.getTasksByColumn(columnId);
  }

  // ==================== MÉTODOS DELEGADOS PARA INVITACIONES ====================

  async inviteMember(boardId: string, userId: string, roleName: string, expiresInDays: number = 7) {
    return this.membersService.inviteMember(boardId, { userId, roleName, expiresInDays }, userId);
  }

  async acceptInvitation(invitationId: string) {
    return this.membersService.acceptInvitation(invitationId);
  }

  async getPendingInvitations(userId: string) {
    return this.membersService.getPendingInvitations(userId);
  }

  async declineInvitation(invitationId: string) {
    return this.membersService.declineInvitation(invitationId);
  }
}