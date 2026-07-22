// ms-task-board/src/calendar/calendar.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
  // ❌ ELIMINAR: UseInterceptors
} from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';
import { GoogleCalendarService } from './google-calendar.service';
import { CreateEmployeeTaskDto } from './dto/create-employee-task.dto';
import { UpdateEmployeeTaskDto } from './dto/update-employee-task.dto';
import { GetMonthTasksDto } from './dto/get-month-tasks.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';
import { ConfigService } from '@nestjs/config';

@Controller('calendar')
// ❌ ELIMINAR: @UseInterceptors(InternalAuthInterceptor)
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly configService: ConfigService,
  ) {
    console.log('✅✅✅ CalendarController INICIALIZADO ✅✅✅');
  }

  // ==================== TEST ====================

  @Get('ping')
  async ping() {
    console.log('🏓🏓🏓 PING RECIBIDO 🏓🏓🏓');
    return { 
      pong: true, 
      timestamp: new Date().toISOString(),
      message: 'CalendarController funciona'
    };
  }

  // ==================== CRUD BÁSICO ====================

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() createDto: CreateEmployeeTaskDto) {
    // ✅ createDto.companyId viene en el body desde el gateway
    const task = await this.calendarService.createTask(createDto);
    
    if (createDto.userId) {
      try {
        const hasToken = await this.googleCalendarService.hasValidToken(createDto.userId);
        if (hasToken) {
          const googleEvent = await this.googleCalendarService.createEvent(createDto.userId, task);
          return {
            ...task,
            googleCalendarLink: googleEvent.htmlLink,
            googleEventId: googleEvent.id,
          };
        }
      } catch (error: any) {
        console.error(`Error al crear evento en Google Calendar: ${error.message}`);
      }
    }
    
    return task;
  }

  @Get('users/:userId/tasks')
  async getUserTasks(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() monthDto: GetMonthTasksDto,
  ) {
    // ✅ Extraer companyId del DTO (viene como query param)
    if (!monthDto.companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getTasksByUser(
      userId, 
      monthDto.companyId, 
      monthDto
    );
  }

  @Get('monthly-tasks')
  async getAllTasksForMonth(@Query() monthDto: GetMonthTasksDto) {
    // ✅ Extraer companyId del DTO (viene como query param)
    if (!monthDto.companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getAllTasksForMonth(
      monthDto.companyId, 
      monthDto
    );
  }

  @Put('tasks/:id')
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateEmployeeTaskDto,
  ) {
    // ✅ Extraer companyId del body (viene del gateway)
    if (!updateDto.companyId) {
      throw new BadRequestException('companyId es requerido en el body');
    }
    
    return await this.calendarService.updateTask(
      id, 
      updateDto.companyId, 
      updateDto
    );
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    await this.calendarService.deleteTask(id, companyId);
    return { message: 'Tarea eliminada correctamente' };
  }

  @Put('tasks/:id/toggle')
  async toggleComplete(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.toggleComplete(id, companyId);
  }

  @Put('tasks/:id/complete')
  async completeTaskWithPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() completeDto: CompleteTaskDto,
  ) {
    // ✅ Extraer companyId del body (viene del gateway)
    if (!completeDto.companyId) {
      throw new BadRequestException('companyId es requerido en el body');
    }
    
    return await this.calendarService.completeTaskWithPhoto(
      id, 
      completeDto.companyId, 
      completeDto
    );
  }

  @Get('users/:userId/tasks/today')
  async getTodayTasks(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getTodayTasks(userId, companyId);
  }

  @Get('users/:userId/tasks/pending')
  async getPendingTasks(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getPendingTasks(userId, companyId);
  }

  @Get('users/:userId/tasks/completed-with-photo')
  async getCompletedTasksWithPhoto(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getCompletedTasksWithPhoto(userId, companyId);
  }

  @Get('users/:userId/report')
  async getUserReport(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getUserReport(
      userId, 
      companyId, 
      year, 
      month
    );
  }

  @Get('users/:userId/cleaning-stats')
  async getCleaningStats(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getCleaningStats(
      userId, 
      companyId, 
      year, 
      month
    );
  }

  @Get('boards/:boardId/tasks')
  async getBoardTasks(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getTasksByBoard(boardId, companyId);
  }

  @Get('tasks/related/:taskId')
  async getTasksByTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getTasksByTask(taskId, companyId);
  }

  @Get('users/:userId/tasks/range')
  async getTasksByDateRange(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    return await this.calendarService.getTasksByDateRange(
      userId,
      companyId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  // ==================== GOOGLE CALENDAR - AUTH ====================
  // ⚠️ ESTOS MÉTODOS NO NECESITAN companyId PORQUE SON DE AUTENTICACIÓN

  @Get('auth/google/:userId')
  async googleAuth(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Res() res: Response,
  ) {
    console.log(`🔍 [AUTH] Google Auth para userId: ${userId}`);
    const authUrl = this.googleCalendarService.getAuthUrl(userId);
    console.log(`🔍 [AUTH] Redirigiendo a: ${authUrl}`);
    return res.redirect(authUrl);
  }

  @Get('oauth-callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    console.log('🔴🔴🔴 [CALLBACK] ¡LLEGÓ PETICIÓN!');
    console.log('🔴🔴🔴 [CALLBACK] code:', code?.substring(0, 20) || 'NO HAY CODE');
    console.log('🔴🔴🔴 [CALLBACK] state:', state || 'NO HAY STATE');
    
    if (!code) {
      console.error('❌ [CALLBACK] No hay código');
      return res.status(400).json({
        success: false,
        error: 'Código de autorización no proporcionado'
      });
    }
    
    if (!state) {
      console.error('❌ [CALLBACK] No hay state');
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó el ID de usuario'
      });
    }

    try {
      console.log('🔍 [CALLBACK] Obteniendo tokens...');
      const tokens = await this.googleCalendarService.getTokensFromCode(code);
      console.log('✅ [CALLBACK] Tokens obtenidos');
      
      console.log('🔍 [CALLBACK] Guardando tokens para usuario:', state);
      await this.googleCalendarService.saveUserTokens(state, tokens);
      console.log('✅ [CALLBACK] Tokens guardados');
      
      return res.status(200).json({
        success: true,
        userId: state,
        message: 'Tokens guardados correctamente'
      });
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ [CALLBACK] Error:', errorMessage);
      
      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  @Get('auth/status/:userId')
  async getAuthStatus(@Param('userId', ParseUUIDPipe) userId: string) {
    console.log(`🔍 [AUTH STATUS] Verificando token para userId: ${userId}`);
    const hasToken = await this.googleCalendarService.hasValidToken(userId);
    return { hasGoogleCalendar: hasToken, userId };
  }

  @Delete('auth/:userId')
  @HttpCode(HttpStatus.OK)
  async disconnectGoogle(@Param('userId', ParseUUIDPipe) userId: string) {
    console.log(`🔍 [DISCONNECT] Desconectando Google para userId: ${userId}`);
    await this.googleCalendarService.revokeTokens(userId);
    return {
      success: true,
      message: 'Google Calendar desconectado correctamente',
    };
  }

  @Post('sync-pending/:userId')
  async syncPendingTasksToGoogle(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    console.log(`🔍 [SYNC PENDING] Sincronizando tareas pendientes para userId: ${userId}`);
    const hasToken = await this.googleCalendarService.hasValidToken(userId);
    if (!hasToken) {
      return { success: false, error: 'Usuario no tiene Google Calendar conectado' };
    }

    const tasks = await this.calendarService.getPendingTasks(userId, companyId);

    if (tasks.length === 0) {
      return { success: true, message: 'No hay tareas pendientes para sincronizar', total: 0 };
    }

    const results = await this.googleCalendarService.syncMultipleTasks(userId, tasks);
    return { success: true, total: tasks.length, results };
  }

  @Post('sync-month/:userId')
  async syncMonthToGoogle(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { year: number; month: number },
    @Query('companyId') companyId: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId es requerido como query param');
    }
    
    console.log(`🔍 [SYNC MONTH] Sincronizando mes ${body.month}/${body.year} para userId: ${userId}`);
    const hasToken = await this.googleCalendarService.hasValidToken(userId);
    if (!hasToken) {
      return { success: false, error: 'Usuario no tiene Google Calendar conectado' };
    }

    const tasks = await this.calendarService.getTasksByUser(
      userId, 
      companyId,
      {
        year: body.year,
        month: body.month,
      }
    );

    if (tasks.length === 0) {
      return { success: true, message: 'No hay tareas para sincronizar', total: 0 };
    }

    const results = await this.googleCalendarService.syncMultipleTasks(userId, tasks);
    return { success: true, total: tasks.length, results };
  }
}