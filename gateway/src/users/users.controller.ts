import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateUserDto } from './dto/create-user.dto';
import { firstValueFrom } from 'rxjs';
import { LoginUserDto } from '../auth/dto/login-user.dto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '../common/jwt/jwt.service';
import { Auth } from '../common/auth/decorators/auth.decorator';
import { User } from '../common/auth/decorators/user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
 constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers() {
    return this.usersService.getAllUsers();
  }

  @Post()
  @Auth()
  createUser(@Body() dto: CreateUserDto, @User() user: any) {
    return this.usersService.createUser(dto, user);
  }

}
