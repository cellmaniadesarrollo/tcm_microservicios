import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { SetPinRequiredDto } from './dto/set-pin-required.dto';
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

  // ===============================================
  // 🔐 PIN (mis propias rutas)
  // ===============================================

  /** ¿Mi cuenta exige PIN? El frontend lo usa para mostrar u ocultar el campo */
  @Get('pin/required')
  @Auth()
  isPinRequired(@User() user: any) {
    return this.usersService.isPinRequired(user);
  }

  /** Estado de mi PIN (si tengo uno, cuándo lo cambié) */
  @Get('pin/status')
  @Auth()
  getPinStatus(@User() user: any) {
    return this.usersService.getPinStatus(user);
  }

  /** Crear o cambiar mi PIN (pide la contraseña de la cuenta) */
  @Post('pin')
  @Auth()
  setMyPin(@Body() dto: SetPinDto, @User() user: any, @Req() req: any) {
    return this.usersService.setMyPin(user, dto, req.ip);
  }

  // ===============================================
  // 🔐 PIN (administración)
  // ===============================================

  /** Lista los usuarios de la compañía con su estado de PIN */
  @Get('pin/admin/users')
  @Auth()
  // El control de grupos admin lo hace el MS users (ADMIN_GROUPS en pin.service.ts)
  listUsersPinStatus(@User() user: any) {
    return this.usersService.listUsersPinStatus(user);
  }

  /** Un administrador restablece el PIN de otro usuario de su compañía */
  @Post(':id/pin/reset')
  @Auth()
  resetPin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPinDto,
    @User() user: any,
    @Req() req: any,
  ) {
    return this.usersService.resetPinByAdmin(user, id, dto.newPin, req.ip);
  }

  /** Un administrador activa o desactiva el PIN obligatorio de una cuenta */
  @Patch(':id/pin/required')
  @Auth()
  setPinRequired(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPinRequiredDto,
    @User() user: any,
  ) {
    return this.usersService.setPinRequired(user, id, dto.required);
  }
}