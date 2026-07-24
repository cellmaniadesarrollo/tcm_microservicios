import { Module } from '@nestjs/common';
import { FinesService } from './fines.service';
import { FinesController } from './fines.controller';
import { Fine, FineSchema } from './schemas/fine.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersEmployeesEventsModule } from '../users-employees-events/users-employees-events.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Fine.name, schema: FineSchema }]), UsersEmployeesEventsModule
  ],
  controllers: [FinesController],
  providers: [FinesService],
  exports: [MongooseModule.forFeature([{ name: Fine.name, schema: FineSchema }]), FinesService],
})
export class FinesModule { }
