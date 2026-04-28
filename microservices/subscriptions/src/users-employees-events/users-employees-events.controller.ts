// microservices\companies\src\users-employees-events\users-employees-events.controller.ts
import { Controller, Inject, OnModuleInit } from '@nestjs/common';
import { UsersEmployeesEventsService } from './users-employees-events.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('users-employees-events')
export class UsersEmployeesEventsController implements OnModuleInit {

    constructor(
        private readonly cacheService: UsersEmployeesEventsService,
        @Inject('USER_ASYNC') private readonly customerClient: ClientProxy,
    ) { }

    onModuleInit() {
        // 🔥 Síncrono + background → el microservicio siempre se levanta
        this.performInitialSync().catch(err => {
            console.error('❌ Error solicitando sincronización inicial :', err);
        });
    }

    private async performInitialSync() {
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
            await this.cacheService.syncUsersEmployeesBulk(response);

            console.log('✅ Sincronización inicial de users-employees completada');
        } catch (err) {
            // Re-lanzamos el error para que el .catch() de onModuleInit lo capture
            throw err;
        }
    }
}