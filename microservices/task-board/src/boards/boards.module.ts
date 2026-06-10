// boards/boards.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BoardsService } from './boards.service';
import { BoardMembersService } from './board-members.service';
import { BoardColumnsService } from './board-columns.service';
import { RolesService } from './roles.service';
import { CustomPermissionsService } from './custom-permissions.service';
import { BoardsController } from './boards.controller';
import { Board } from './entities/board.entity';
import { BoardMember } from './entities/board-member.entity';
import { BoardInvitation } from './entities/board-invitation.entity';
import { Role } from './entities/role.entity';
import { CustomPermission } from './entities/custom-permission.entity';
import { BoardColumn } from './entities/board-column.entity';
import { Task } from '../tasks/entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Board, BoardMember, BoardInvitation, Role, CustomPermission, BoardColumn, Task]),
    ClientsModule.register([
      {
        name: 'USERS_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'ms-users',
          port: 3001,
        },
      },
      {
        name: 'NOTIFICATIONS_CLIENT',
        transport: Transport.TCP,
        options: {
          host: 'ms-notifications',
          port: 3003,
        },
      },
    ]),
  ],
  controllers: [BoardsController],
  providers: [
    BoardsService,
    BoardMembersService,
    BoardColumnsService,
    RolesService,
    CustomPermissionsService,
  ],
  exports: [BoardsService, BoardMembersService, BoardColumnsService],
})
export class BoardsModule {}