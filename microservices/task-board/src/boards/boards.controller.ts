// boards/boards.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CreateColumnDto, UpdateColumnDto, MoveTaskDto } from './dto/column.dto';
import { AddMemberDto, UpdateMemberRoleDto, UpdateCustomPermissionsDto } from './dto/member.dto';
import { RolesService } from './roles.service';

@Controller()
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly rolesService: RolesService,
  ) {}

  // ==================== ENDPOINTS DE ROLES ====================

  @MessagePattern({ cmd: 'boards.roles.findAll' })
  async getRoles() {
    return this.rolesService.findAll();
  }

  @MessagePattern({ cmd: 'boards.roles.create' })
  async createRole(@Payload() body: { name: string; permissions: any; description?: string }) {
    return this.rolesService.createRole(body.name, body.permissions, body.description);
  }

  // ==================== ENDPOINTS BÁSICOS DEL BOARD ====================

  @MessagePattern({ cmd: 'boards.create' })
  async create(@Payload() createBoardDto: CreateBoardDto) {
    return this.boardsService.create(createBoardDto);
  }

  @MessagePattern({ cmd: 'boards.findAll' })
  async findAll() {
    return this.boardsService.findAll();
  }

  @MessagePattern({ cmd: 'boards.findByUser' })
  async findByUser(@Payload() userId: string) {
    return this.boardsService.findByUser(userId);
  }

  @MessagePattern({ cmd: 'boards.findOne' })
  async findOne(@Payload() id: string) {
    return this.boardsService.findOne(id);
  }

  @MessagePattern({ cmd: 'boards.update' })
  async update(@Payload() data: { id: string; updateBoardDto: UpdateBoardDto }) {
    return this.boardsService.update(data.id, data.updateBoardDto);
  }

  @MessagePattern({ cmd: 'boards.remove' })
  async remove(@Payload() id: string) {
    return this.boardsService.remove(id);
  }

  // ==================== ENDPOINTS DE MIEMBROS ====================

  @MessagePattern({ cmd: 'boards.getMembers' })
  async getMembers(@Payload() boardId: string) {
    return this.boardsService.getMembers(boardId);
  }

  @MessagePattern({ cmd: 'boards.getMembersWithDetails' })
  async getMembersWithDetails(@Payload() boardId: string) {
    return this.boardsService.getBoardMembersWithDetails(boardId);
  }

  @MessagePattern({ cmd: 'boards.addMember' })
  async addMember(@Payload() data: { boardId: string; addMemberDto: AddMemberDto }) {
    return this.boardsService.addMember(data.boardId, data.addMemberDto.userId, data.addMemberDto.userId);
  }

@MessagePattern({ cmd: 'boards.removeMember' })
async removeMember(@Payload() data: { boardId: string; userId: string }) {
  console.log(`📥 [Controller] removeMember recibido:`, JSON.stringify(data));
  
  if (!data || !data.boardId || !data.userId) {
    throw new Error('boardId y userId son requeridos');
  }
  
  return this.boardsService.removeMember(data.boardId, data.userId);
}

  @MessagePattern({ cmd: 'boards.updateMemberRole' })
  async updateMemberRole(@Payload() data: { boardId: string; userId: string; roleName: string }) {
    return this.boardsService.updateMemberRole(data.boardId, data.userId, data.roleName);
  }

  // ==================== ENDPOINTS DE PERMISOS ====================

  @MessagePattern({ cmd: 'boards.getMemberPermissions' })
  async getMemberPermissions(@Payload() data: { boardId: string; userId: string }) {
    return this.boardsService.getMemberPermissions(data.boardId, data.userId);
  }

  @MessagePattern({ cmd: 'boards.updateCustomPermissions' })
  async updateCustomPermissions(@Payload() data: { boardId: string; userId: string; permissions: UpdateCustomPermissionsDto }) {
    return this.boardsService.updateCustomPermissions(data.boardId, data.userId, data.permissions);
  }

  @MessagePattern({ cmd: 'boards.checkPermission' })
  async checkPermission(@Payload() data: { boardId: string; userId: string; permission: string }) {
    const hasPermission = await this.boardsService.hasPermission(data.boardId, data.userId, data.permission);
    return { permission: data.permission, hasPermission };
  }

  // ==================== ENDPOINTS DE COLUMNAS ====================

  @MessagePattern({ cmd: 'boards.setupDefaultColumns' })
  async setupDefaultColumns(@Payload() boardId: string) {
    return this.boardsService.setupDefaultColumns(boardId);
  }

  @MessagePattern({ cmd: 'boards.getColumns' })
  async getColumns(@Payload() boardId: string) {
    return this.boardsService.getColumns(boardId);
  }

  @MessagePattern({ cmd: 'boards.addColumn' })
  async addColumn(@Payload() data: { boardId: string; createColumnDto: CreateColumnDto }) {
    return this.boardsService.addColumn(data.boardId, data.createColumnDto);
  }

  @MessagePattern({ cmd: 'boards.updateColumn' })
  async updateColumn(@Payload() data: { columnId: string; updateColumnDto: UpdateColumnDto }) {
    return this.boardsService.updateColumn(data.columnId, data.updateColumnDto);
  }

  @MessagePattern({ cmd: 'boards.removeColumn' })
  async removeColumn(@Payload() columnId: string) {
    return this.boardsService.removeColumn(columnId);
  }

  @MessagePattern({ cmd: 'boards.getTasksByColumn' })
  async getTasksByColumn(@Payload() columnId: string) {
    return this.boardsService.getTasksByColumn(columnId);
  }

  @MessagePattern({ cmd: 'boards.moveTask' })
  async moveTask(@Payload() data: { boardId: string; moveTaskDto: MoveTaskDto }) {
    return this.boardsService.moveTask(data.boardId, data.moveTaskDto);
  }

  @MessagePattern({ cmd: 'boards.reorderColumns' })
  async reorderColumns(@Payload() columnIds: string[]) {
    return this.boardsService.reorderColumns(columnIds);
  }

  @MessagePattern({ cmd: 'boards.addTaskToColumn' })
  async addTaskToColumn(@Payload() data: { columnId: string; taskId: string }) {
    return this.boardsService.addTaskToColumn(data.columnId, data.taskId);
  }

  @MessagePattern({ cmd: 'boards.removeTaskFromColumn' })
  async removeTaskFromColumn(@Payload() data: { columnId: string; taskId: string }) {
    return this.boardsService.removeTaskFromColumn(data.columnId, data.taskId);
  }

  // ==================== ENDPOINTS DE INVITACIONES ====================

  @MessagePattern({ cmd: 'boards.inviteMember' })
  async inviteMember(@Payload() data: { boardId: string; userId: string; roleName: string; expiresInDays?: number }) {
    return this.boardsService.inviteMember(data.boardId, data.userId, data.roleName, data.expiresInDays || 7);
  }

  @MessagePattern({ cmd: 'boards.acceptInvitation' })
  async acceptInvitation(@Payload() invitationId: string) {
    return this.boardsService.acceptInvitation(invitationId);
  }

  @MessagePattern({ cmd: 'boards.getPendingInvitations' })
  async getPendingInvitations(@Payload() userId: string) {
    return this.boardsService.getPendingInvitations(userId);
  }

  @MessagePattern({ cmd: 'boards.declineInvitation' })
  async declineInvitation(@Payload() invitationId: string) {
    return this.boardsService.declineInvitation(invitationId);
  }
}