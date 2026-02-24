import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module'; 
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { User } from './users/entities/user.entity';
import { Employee } from './users/entities/employee.entity';
import { UserGroup } from './users/entities/user_group.entity';
import { Gender } from './users/entities/gender.entity';
import { Group } from './users/entities/group.entity';  
import { BroadcastModule } from './broadcast/broadcast.module';
import { CompaniesModule } from './companies/companies.module';
@Module({
  imports: [UsersModule, 
     TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      entities: [User, Employee, UserGroup, Gender,Group], 
      synchronize: true, // Solo para desarrollo
    }),
     UsersModule,
     BroadcastModule,
     CompaniesModule,
  ], 
  controllers: [AppController],
  providers: [AppService ],
}) 
export class AppModule {}
