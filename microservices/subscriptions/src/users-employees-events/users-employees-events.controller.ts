import { Controller, Inject } from '@nestjs/common';
import { UsersEmployeesEventsService } from './users-employees-events.service';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('users-employees-events')
export class UsersEmployeesEventsController {
    constructor(
        private readonly cacheService: UsersEmployeesEventsService,
        @Inject('USER_ASYNC') private readonly customerClient: ClientProxy,
    ) { }
    async onModuleInit() {
        try {
            const timestamps = await this.cacheService.getLastUpdatedAt(); 
            const response = await firstValueFrom(
                this.customerClient.send(
                    { cmd: 'async_users_start' }, 
                    {
                        internalToken: process.env.INTERNAL_SECRET,
                        fromCache: timestamps,
                    }
                )
            );  
           // console.log(JSON.stringify(response , null, 2));
            await this.cacheService.syncUsersEmployeesBulk(response)
        } catch (err) {
            console.error('❌ Error solicitando sincronización inicial :', err);
        }
    } 
 
}
