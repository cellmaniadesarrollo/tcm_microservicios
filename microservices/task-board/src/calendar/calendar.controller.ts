// src/calendar/calendar.controller.ts
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
  HttpStatus
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateEmployeeTaskDto } from './dto/create-employee-task.dto';
import { UpdateEmployeeTaskDto } from './dto/update-employee-task.dto';
import { GetMonthTasksDto } from './dto/get-month-tasks.dto';
import { CompleteTaskDto } from './dto/complete-task.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // ==================== CRUD BÁSICO ====================

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  async createTask(@Body() createDto: CreateEmployeeTaskDto) {
    return await this.calendarService.createTask(createDto);
  }

  @Get('users/:userId/tasks')
  async getUserTasks(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() monthDto: GetMonthTasksDto,
  ) {
    return await this.calendarService.getTasksByUser(userId, monthDto);
  }

  @Get('monthly-tasks')
  async getAllTasksForMonth(@Query() monthDto: GetMonthTasksDto) {
    return await this.calendarService.getAllTasksForMonth(monthDto);
  }

  @Put('tasks/:id')
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateEmployeeTaskDto,
  ) {
    return await this.calendarService.updateTask(id, updateDto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(@Param('id', ParseUUIDPipe) id: string) {
    await this.calendarService.deleteTask(id);
    return { message: 'Tarea eliminada correctamente' };
  }

  @Put('tasks/:id/toggle')
  async toggleComplete(@Param('id', ParseUUIDPipe) id: string) {
    return await this.calendarService.toggleComplete(id);
  }

  // ==================== TAREAS CON FOTO ====================

  @Put('tasks/:id/complete')
  async completeTaskWithPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() completeDto: CompleteTaskDto,
  ) {
    return await this.calendarService.completeTaskWithPhoto(id, completeDto);
  }

  @Get('users/:userId/tasks/today')
  async getTodayTasks(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.calendarService.getTodayTasks(userId);
  }

  @Get('users/:userId/tasks/pending')
  async getPendingTasks(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.calendarService.getPendingTasks(userId);
  }

  @Get('users/:userId/tasks/completed-with-photo')
  async getCompletedTasksWithPhoto(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.calendarService.getCompletedTasksWithPhoto(userId);
  }

  // ==================== REPORTES Y ESTADÍSTICAS ====================

  @Get('users/:userId/report')
  async getUserReport(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    return await this.calendarService.getUserReport(userId, year, month);
  }

  @Get('users/:userId/cleaning-stats')
  async getCleaningStats(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    return await this.calendarService.getCleaningStats(userId, year, month);
  }

  // ==================== TAREAS RELACIONADAS ====================

  @Get('boards/:boardId/tasks')
  async getBoardTasks(@Param('boardId', ParseUUIDPipe) boardId: string) {
    return await this.calendarService.getTasksByBoard(boardId);
  }

  @Get('tasks/related/:taskId')
  async getTasksByTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return await this.calendarService.getTasksByTask(taskId);
  }

  @Get('users/:userId/tasks/range')
  async getTasksByDateRange(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.calendarService.getTasksByDateRange(
      userId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}