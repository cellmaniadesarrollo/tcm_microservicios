import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginResponseDto, LoginUserDto } from './dto/login-user.dto';
import { instanceToPlain } from 'class-transformer';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
@ApiTags('users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }


    @MessagePattern({ cmd: 'get_all_users' })
    @Get()
    @ApiResponse({ status: 201, description: 'Lista de usuarios obtenida correctamente', type: UserResponseDto })
    @ApiResponse({ status: 500, description: 'Error interno del servidor al procesar la solicitud' })
    findAll() {
        return this.usersService.findAll();
    }
    @MessagePattern({ cmd: 'create_user' })
    @Post()
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({ status: 201, description: 'Usuario creado correctamente', type: UserResponseDto })
    @ApiResponse({ status: 400, description: 'Datos inválidos (validación fallida)' })
    @ApiResponse({ status: 409, description: 'Conflicto - El email o nombre de usuario ya existe' })
    @ApiResponse({ status: 500, description: 'Error interno del servidor al procesar la solicitud' })
    create(@Body() createUserDto: CreateUserDto) {

        return this.usersService.create(createUserDto);
    }


    @MessagePattern({ cmd: 'login_user' })
    @Post('login')
    @ApiBody({ type: LoginUserDto })
    @ApiResponse({ status: 201, description: 'Inicio de sesión exitoso', type: LoginResponseDto })
    @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
    async login(@Body() loginUserDto: LoginUserDto) {
        console.log(loginUserDto)
        const user = await this.usersService.validateUser(loginUserDto);
        return instanceToPlain(user);
    }
    @Post('test')
    test(@Body() body: any) {
        console.log('Body recibido:', body);
        return { received: body };
    }

    @MessagePattern({ cmd: 'async_users_start' })
    async onSyncStart(@Payload() payload: any) {
        console.log('🔄 Solicitud de sincronización recibida', payload);

        const data = await this.usersService.findFullDataByCreatedAfter(payload.fromCache);

        return data;
    }
}
