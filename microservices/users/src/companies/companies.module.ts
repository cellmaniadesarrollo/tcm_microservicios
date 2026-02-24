import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { CompaniesEventsListener } from './companies-events.listener';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyReplica } from './entities/company-replica.entity';
import { BranchReplica } from './entities/branch-replica.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { User } from '../users/entities/user.entity';
import { UserGroup } from '../users/entities/user_group.entity';
import { Group } from '../users/entities/group.entity';
import { UsersModule } from '../users/users.module';

@Module({  imports: [UsersModule,
    TypeOrmModule.forFeature([
      CompanyReplica,
      BranchReplica,User,UserGroup,Group
    ]),
     ClientsModule.register([
        {
          name: 'COMPANIES_ASYNC',
          transport: Transport.RMQ,
          options: {
            urls: [process.env.RABBIT_URL||'amqp://rabbitmq:5672'],
            queue: 'companies_queue_sync',  
            queueOptions: { durable: true },
            persistent:true 
          }, 
        },
      ]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService,CompaniesEventsListener],
})
export class CompaniesModule {}
