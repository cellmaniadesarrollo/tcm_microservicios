import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { BoardMember } from './entities/board-member.entity';
import { BoardInvitation, InvitationStatus } from './entities/board-invitation.entity';
import { Board } from './entities/board.entity';
import { Role } from './entities/role.entity';
import { AddMemberDto, UpdateMemberRoleDto, InviteMemberDto } from './dto/member.dto';
import { RolesService } from './roles.service';
import { CustomPermissionsService } from './custom-permissions.service';

@Injectable()
export class BoardMembersService {
  constructor(
    @InjectRepository(BoardMember)
    private memberRepository: Repository<BoardMember>,
    @InjectRepository(BoardInvitation)
    private invitationRepository: Repository<BoardInvitation>,
    @InjectRepository(Board)
    private boardRepository: Repository<Board>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private rolesService: RolesService,
    private customPermissionsService: CustomPermissionsService,
    @Inject('USERS_CLIENT')
    private readonly usersClient: ClientProxy,
    @Inject('NOTIFICATIONS_CLIENT')
    private readonly notificationsClient: ClientProxy,
  ) {
    this.rolesService.createDefaultRoles();
  }

  // ==================== AGREGAR MIEMBRO ====================

  async addMember(boardId: string, addMemberDto: AddMemberDto, invitedBy: string): Promise<BoardMember> {
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found`);
    }

    const existingMember = await this.memberRepository.findOne({
      where: { boardId, userId: addMemberDto.userId }
    });

    if (existingMember) {
      throw new BadRequestException(`User is already a member of this board`);
    }

    let role: Role | null = null;
    if (addMemberDto.roleName) {
      role = await this.rolesService.findByName(addMemberDto.roleName);
    } else {
      role = await this.rolesService.findByName('Member');
    }

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    const member = this.memberRepository.create({
      boardId,
      userId: addMemberDto.userId,
      roleId: role.id,
      invitedBy,
    });

    const savedMember = await this.memberRepository.save(member);

    if (addMemberDto.customPermissions && Object.keys(addMemberDto.customPermissions).length > 0) {
      await this.customPermissionsService.setMultiplePermissions(
        savedMember.id,
        addMemberDto.customPermissions
      );
    }

    return savedMember;
  }

  // ==================== OBTENER MIEMBROS ====================
  async getBoardMembers(boardId: string): Promise<any[]> {
    // ✅ Consulta directa a la base de datos - SIN microservicios
    const members = await this.memberRepository.find({
      where: { boardId, active: true },
      relations: { role: true },
      order: { joinedAt: 'DESC' }
    });

    // Retornar solo los datos que tenemos en la base de datos
    return members.map(member => ({
      id: member.id,
      userId: member.userId,
      roleId: member.roleId,
      role: member.role ? {
        id: member.role.id,
        name: member.role.name,
        permissions: member.role.permissions
      } : null,
      joinedAt: member.joinedAt,
      invitedBy: member.invitedBy,
      active: member.active,
    }));
  }

  async getBoardMembersWithUserDetails(boardId: string): Promise<any[]> {
    const members = await this.memberRepository.find({
      where: { boardId, active: true },
      relations: { role: true },
      order: { joinedAt: 'DESC' }
    });

    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        try {
          // Intentar obtener usuario del microservicio
          const user = await lastValueFrom(
            this.usersClient.send({ cmd: 'get_user_by_id' }, member.userId)
          );
          return {
            ...member,
            user: user ? {
              id: user.id,
              name: user.name_user || user.name,
              email: user.email_user || user.email,
            } : null
          };
        } catch (error) {
          // ✅ Si falla, devolver el miembro sin datos de usuario
          console.warn(`⚠️ No se pudo obtener usuario ${member.userId}, usando datos básicos`);
          return {
            ...member,
            user: {
              id: member.userId,
              name: 'Usuario',
              email: null
            }
          };
        }
      })
    );

    return membersWithDetails;
  }

  async getMember(boardId: string, userId: string): Promise<BoardMember> {
    const member = await this.memberRepository.findOne({
      where: { boardId, userId, active: true },
      relations: { role: true }
    });

    if (!member) {
      throw new NotFoundException(`User ${userId} is not a member of board ${boardId}`);
    }

    return member;
  }

  // ==================== ACTUALIZAR ROL ====================

  async updateMemberRole(boardId: string, userId: string, updateRoleDto: UpdateMemberRoleDto): Promise<BoardMember> {
    const member = await this.getMember(boardId, userId);
    
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (board?.ownerId === userId) {
      throw new BadRequestException('Cannot change role of board owner');
    }

    const role = await this.rolesService.findByName(updateRoleDto.roleName);
    if (!role) {
      throw new NotFoundException(`Role ${updateRoleDto.roleName} not found`);
    }

    member.roleId = role.id;
    return this.memberRepository.save(member);
  }

  // ==================== PERMISOS PERSONALIZADOS ====================

  async updateCustomPermissions(
    boardId: string,
    userId: string,
    permissions: Record<string, boolean>
  ): Promise<Record<string, boolean>> {
    const member = await this.getMember(boardId, userId);
    
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (board?.ownerId === userId) {
      throw new BadRequestException('Cannot change permissions of board owner');
    }

    await this.customPermissionsService.setMultiplePermissions(member.id, permissions);
    return this.customPermissionsService.getPermissions(member.id);
  }

  async getUserPermissions(boardId: string, userId: string): Promise<any> {
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (board?.ownerId === userId) {
      return {
        canCreateTasks: true,
        canEditTasks: true,
        canDeleteTasks: true,
        canManageMembers: true,
        canEditBoard: true,
      };
    }

    const member = await this.memberRepository.findOne({
      where: { boardId, userId, active: true },
      relations: { role: true }
    });

    if (!member) {
      return {
        canCreateTasks: false,
        canEditTasks: false,
        canDeleteTasks: false,
        canManageMembers: false,
        canEditBoard: false,
      };
    }

    const rolePermissions = member.role?.permissions || {};
    const customPermissions = await this.customPermissionsService.getPermissions(member.id);

    return {
      ...rolePermissions,
      ...customPermissions,
    };
  }

  async hasPermission(boardId: string, userId: string, permission: string): Promise<boolean> {
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (board?.ownerId === userId) return true;

    const permissions = await this.getUserPermissions(boardId, userId);
    return permissions[permission] || false;
  }

  async hasPermissions(boardId: string, userId: string, permissions: string[]): Promise<boolean> {
    const results = await Promise.all(
      permissions.map(p => this.hasPermission(boardId, userId, p))
    );
    return results.every(r => r === true);
  }

  // ==================== ELIMINAR MIEMBRO ====================

  async removeMember(boardId: string, userId: string): Promise<{ success: boolean; message: string }> {
    console.log(`🔍 [removeMember] Iniciando - boardId: ${boardId}, userId: ${userId}`);
    
    if (!boardId || !userId) {
      throw new BadRequestException('boardId y userId son requeridos');
    }
    
    try {
      // 1. Verificar que el board existe
      const board = await this.boardRepository.findOne({ where: { id: boardId } });
      if (!board) {
        throw new NotFoundException(`Board con ID ${boardId} no encontrado`);
      }
      
      // 2. Verificar que no es el owner
      if (board.ownerId === userId) {
        throw new BadRequestException('No se puede eliminar al propietario del board');
      }
      
      // 3. Buscar el miembro (incluyendo inactivos)
      const member = await this.memberRepository.findOne({
        where: { boardId, userId },
        relations: { role: true }
      });
      
      // Si no existe el miembro, devolver éxito (ya no está)
      if (!member) {
        console.log(`⚠️ Usuario ${userId} no es miembro del board (quizás ya fue eliminado)`);
        return {
          success: true,
          message: 'El miembro ya no existe en el board'
        };
      }
      
      // Si ya está inactivo, también considerar éxito
      if (!member.active) {
        console.log(`⚠️ Usuario ${userId} ya estaba inactivo`);
        return {
          success: true,
          message: 'El miembro ya había sido eliminado'
        };
      }
      
      console.log(`✅ Miembro encontrado:`, { id: member.id, active: member.active });
      
      // 4. Eliminar permisos personalizados
      try {
        await this.customPermissionsService.removeAllPermissions(member.id);
        console.log(`✅ Permisos eliminados`);
      } catch (permError) {
        console.warn('Error eliminando permisos:', permError);
      }
      
      // 5. Desactivar el miembro (soft delete)
      member.active = false;
      await this.memberRepository.save(member);
      console.log(`✅ Miembro desactivado`);
      
      // 6. Eliminar invitaciones pendientes
      await this.invitationRepository.delete({
        boardId,
        invitedUserId: userId,
        status: InvitationStatus.PENDING
      });
      
      return {
        success: true,
        message: 'Miembro eliminado correctamente'
      };
      
    } catch (error) {
      console.error(`❌ [removeMember] Error:`, error);
      throw error;
    }
  }

  async removeAllMembersFromBoard(boardId: string): Promise<void> {
    const members = await this.memberRepository.find({ where: { boardId } });
    for (const member of members) {
      await this.customPermissionsService.removeAllPermissions(member.id);
    }
    await this.memberRepository.update(
      { boardId },
      { active: false }
    );
  }

  // ==================== INVITACIONES ====================

  async inviteMember(boardId: string, inviteDto: InviteMemberDto, invitedBy: string): Promise<BoardInvitation> {
    const board = await this.boardRepository.findOne({ where: { id: boardId } });
    if (!board) {
      throw new NotFoundException(`Board with ID ${boardId} not found`);
    }

    const existingMember = await this.memberRepository.findOne({
      where: { boardId, userId: inviteDto.userId, active: true }
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this board');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (inviteDto.expiresInDays || 7));

    const invitation = this.invitationRepository.create({
      boardId,
      invitedUserId: inviteDto.userId,
      invitedBy,
      roleName: inviteDto.roleName || 'Member',
      expiresAt,
    });

    const savedInvitation = await this.invitationRepository.save(invitation);

    try {
      const inviterUser = await lastValueFrom(
        this.usersClient.send({ cmd: 'get_user_by_id' }, invitedBy)
      );
      
      const inviterName = inviterUser?.name_user || inviterUser?.name || invitedBy;
      
      this.notificationsClient.emit('notification.created', {
        userId: inviteDto.userId,
        title: 'Invitación a Tablero',
        message: `${inviterName} te ha invitado al tablero "${board.name}"`,
        type: 'board_invitation',
        entityType: 'board_invitation',
        entityId: savedInvitation.id,
        actionUrl: `/taskboard/invitations/${savedInvitation.id}`,
        metadata: {
          boardId,
          boardName: board.name,
          invitationId: savedInvitation.id,
          invitedBy,
          roleName: inviteDto.roleName,
          expiresAt: expiresAt.toISOString()
        }
      });
      
      console.log(`📧 Notificación enviada a ${inviteDto.userId}`);
    } catch (error) {
      console.error('Error sending notification:', error);
    }

    return savedInvitation;
  }

  async acceptInvitation(invitationId: string): Promise<BoardMember> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId }
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException('Invitation has expired');
    }

    const role = await this.rolesService.findByName(invitation.roleName || 'Member');
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const member = this.memberRepository.create({
      boardId: invitation.boardId,
      userId: invitation.invitedUserId,
      roleId: role.id,
      invitedBy: invitation.invitedBy,
    });

    await this.memberRepository.save(member);

    invitation.status = InvitationStatus.ACCEPTED;
    await this.invitationRepository.save(invitation);

    return member;
  }

  async declineInvitation(invitationId: string): Promise<BoardInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId }
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }

    invitation.status = InvitationStatus.DECLINED;
    return this.invitationRepository.save(invitation);
  }

  async getPendingInvitations(userId: string): Promise<any[]> {
    const invitations = await this.invitationRepository.find({
      where: { 
        invitedUserId: userId, 
        status: InvitationStatus.PENDING 
      },
      order: { createdAt: 'DESC' }
    });
    
    // Enriquecer con datos del board
    const invitationsWithBoard = await Promise.all(
      invitations.map(async (invitation) => {
        const board = await this.boardRepository.findOne({
          where: { id: invitation.boardId }
        });
        return {
          id: invitation.id,
          boardId: invitation.boardId,
          invitedUserId: invitation.invitedUserId,
          invitedBy: invitation.invitedBy,
          roleName: invitation.roleName,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
          updatedAt: invitation.updatedAt,
          boardName: board?.name || 'Tablero desconocido',
          board: board ? { id: board.id, name: board.name } : null
        };
      })
    );
    
    return invitationsWithBoard;
  }
}