import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { UsersEmployeesEventsService } from '../services/users-employees-events.service';

@Controller()
export class UsersEmployeesEventsController implements OnModuleInit {
    constructor(
        private readonly cacheService: UsersEmployeesEventsService,
        @Inject('USER_ASYNC') private readonly usersClient: ClientProxy,
    ) { }

    async onModuleInit() {
        try {
            const timestamps = await this.cacheService.getLastUpdatedAt();
            const response = await firstValueFrom(
                this.usersClient.send(
                    { cmd: 'async_users_start' },
                    { internalToken: process.env.INTERNAL_SECRET, fromCache: timestamps },
                ),
            );
            await this.cacheService.syncUsersEmployeesBulk(response);
        } catch (err) {
            console.error('❌ Error en sincronización inicial de usuarios:', err);
        }
    }
}