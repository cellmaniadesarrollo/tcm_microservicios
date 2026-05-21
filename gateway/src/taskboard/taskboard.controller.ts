import { Controller, Post, Body, Get, Param, Patch, Delete } from '@nestjs/common';
import { TaskboardService } from './taskboard.service';

@Controller('taskboard')
export class TaskboardController {
  constructor(private readonly taskboardService: TaskboardService) {}

  // ========== BOARDS ==========
  @Post('boards')
  createBoard(@Body() data: any) {
    return this.taskboardService.createBoard(data);
  }

  @Get('boards')
  findAllBoards() {
    return this.taskboardService.findAllBoards();
  }

  @Get('boards/user/:userId')
  findBoardsByUser(@Param('userId') userId: string) {
    return this.taskboardService.findBoardsByUser(userId);
  }

  @Get('boards/:id')
  findOneBoard(@Param('id') id: string) {
    return this.taskboardService.findOneBoard(id);
  }

  @Patch('boards/:id')
  updateBoard(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.updateBoard(id, data);
  }

  @Delete('boards/:id')
  removeBoard(@Param('id') id: string) {
    return this.taskboardService.removeBoard(id);
  }

  @Post('boards/:id/members/:userId')
  addMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.taskboardService.addMember(id, userId);
  }

  @Delete('boards/:id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.taskboardService.removeMember(id, userId);
  }

  // ========== TASKS ==========
  @Post('tasks')
  createTask(@Body() data: any) {
    return this.taskboardService.createTask(data);
  }

  @Get('tasks')
  findAllTasks() {
    return this.taskboardService.findAllTasks();
  }

  @Get('tasks/board/:boardId')
  findTasksByBoard(@Param('boardId') boardId: string) {
    return this.taskboardService.findTasksByBoard(boardId);
  }

  @Get('tasks/user/:userId')
  findTasksByUser(@Param('userId') userId: string) {
    return this.taskboardService.findTasksByUser(userId);
  }

  @Get('tasks/:id')
  findOneTask(@Param('id') id: string) {
    return this.taskboardService.findOneTask(id);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.updateTask(id, data);
  }

  @Delete('tasks/:id')
  removeTask(@Param('id') id: string) {
    return this.taskboardService.removeTask(id);
  }

  // ========== LABELS ==========
  @Post('labels')
  createLabel(@Body() data: any) {
    return this.taskboardService.createLabel(data);
  }

  @Get('labels')
  findAllLabels() {
    return this.taskboardService.findAllLabels();
  }

  @Get('labels/board/:boardId')
  findLabelsByBoard(@Param('boardId') boardId: string) {
    return this.taskboardService.findLabelsByBoard(boardId);
  }

  @Get('labels/:id')
  findOneLabel(@Param('id') id: string) {
    return this.taskboardService.findOneLabel(id);
  }

  @Patch('labels/:id')
  updateLabel(@Param('id') id: string, @Body() data: any) {
    return this.taskboardService.updateLabel(id, data);
  }

  @Delete('labels/:id')
  removeLabel(@Param('id') id: string) {
    return this.taskboardService.removeLabel(id);
  }
}