import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GroupsGuard } from './guards/groups.guard';
import { JwtModule } from '../jwt/jwt.module';

@Module({
    imports:[JwtModule],
    providers:[JwtAuthGuard,GroupsGuard],
    exports:[JwtAuthGuard,GroupsGuard,JwtModule]
})
export class AuthModule {
   
}
