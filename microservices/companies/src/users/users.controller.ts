import { Controller, Get, Post, Body, Patch, Param, Delete, Inject } from '@nestjs/common';
import { UsersService } from './users.service'; 
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('users')
export class UsersController { 

       constructor(
        private readonly usersService: UsersService,
        @Inject('USER_ASYNC') private readonly customerClient: ClientProxy,
    ) { }
    async onModuleInit() {
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
           // console.log(JSON.stringify(response , null, 2));
            await this.usersService.syncUsersEmployeesBulk(response)
        } catch (err) {
            console.error('❌ Error solicitando sincronización inicial :', err);
        }
    }  
}
