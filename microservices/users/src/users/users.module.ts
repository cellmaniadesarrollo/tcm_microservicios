import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserQueryService } from './repositories/user-query.service';
import { Gender } from './entities/gender.entity';  
import { DataSource } from 'typeorm';
import { seedDefaultData } from './seeds/data.seed';
import { Employee } from './entities/employee.entity';
import { Group } from './entities/group.entity';
import { UserGroup } from './entities/user_group.entity';
import { ClientsModule, Transport } from '@nestjs/microservices'; 
import { BroadcastModule } from '../broadcast/broadcast.module';
import { BranchReplica } from '../companies/entities/branch-replica.entity';
@Module({
  imports: [TypeOrmModule.forFeature([User, Gender,Employee,Group,UserGroup,BranchReplica]),
  ClientsModule.register([
      {
        name: 'USERS_PUBLISHER',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'usuarios_events',
          queueOptions: { durable: true },
        },
      },
    ]),
    BroadcastModule
],
  providers: [UsersService,UserQueryService ],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {
   constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    // if (process.env.NODE_ENV !== 'production') {
      await seedDefaultData(this.dataSource);
    // }
  }
}
