// microservices\companies\src\users\users.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Inject, OnModuleInit } from '@nestjs/common';
import { UsersService } from './users.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('users')
export class UsersController implements OnModuleInit {

    constructor(
        private readonly usersService: UsersService,
        @Inject('USER_ASYNC') private readonly customerClient: ClientProxy,
    ) { }

    onModuleInit() {
        // 🔥 Síncrono + background → nunca bloquea el startup
        this.performInitialSync().catch(err => {
            console.error('❌ Error solicitando sincronización inicial :', err);
        });
    }

    private async performInitialSync() {
        try {
            const timestamps = await this.usersService.getLastUpdatedAt();

            const response = await firstValueFrom(
                this.customerClient.send(
                    { cmd: 'async_users_start' },
                    {
                        internalToken: process.env.INTERNAL_SECRET,
                        fromCache: timestamps,
                    }
                )
            );

            await this.usersService.syncUsersEmployeesBulk(response);
            console.log('✅ Sincronización inicial de usuarios completada');
        } catch (err) {
            // Re-lanzamos para que el .catch del onModuleInit lo capture
            throw err;
        }
    }
}