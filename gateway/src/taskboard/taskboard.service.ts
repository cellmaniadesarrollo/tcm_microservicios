import { Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, Transport, ClientProxyFactory } from '@nestjs/microservices';

@Injectable()
export class TaskboardService implements OnModuleInit {
  private client: ClientKafka;

  constructor() {
    this.client = ClientProxyFactory.create({
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'kafka:9092'],
          clientId: 'gateway-taskboard',
        },
        consumer: {
          groupId: 'gateway-taskboard-consumer',
        },
      },
    }) as ClientKafka;
  }

  async onModuleInit() {
    await this.client.connect();
    console.log('✅ Taskboard Kafka client connected');
  }

  // ========== BOARDS ==========
  async createBoard(data: any) {
    return this.client.send('boards.create', data).toPromise();
  }

  async findAllBoards() {
    return this.client.send('boards.findAll', {}).toPromise();
  }

  async findBoardsByUser(userId: string) {
    return this.client.send('boards.findByUser', userId).toPromise();
  }

  async findOneBoard(id: string) {
    return this.client.send('boards.findOne', id).toPromise();
  }

  async updateBoard(id: string, data: any) {
    return this.client.send('boards.update', { id, ...data }).toPromise();
  }

  async removeBoard(id: string) {
    return this.client.send('boards.remove', id).toPromise();
  }

  async addMember(id: string, userId: string) {
    return this.client.send('boards.addMember', { id, userId }).toPromise();
  }

  async removeMember(id: string, userId: string) {
    return this.client.send('boards.removeMember', { id, userId }).toPromise();
  }

  // ========== TASKS ==========
  async createTask(data: any) {
    return this.client.send('tasks.create', data).toPromise();
  }

  async findAllTasks() {
    return this.client.send('tasks.findAll', {}).toPromise();
  }

  async findTasksByBoard(boardId: string) {
    return this.client.send('tasks.findByBoard', boardId).toPromise();
  }

  async findTasksByUser(userId: string) {
    return this.client.send('tasks.findByUser', userId).toPromise();
  }

  async findOneTask(id: string) {
    return this.client.send('tasks.findOne', id).toPromise();
  }

  async updateTask(id: string, data: any) {
    return this.client.send('tasks.update', { id, ...data }).toPromise();
  }

  async removeTask(id: string) {
    return this.client.send('tasks.remove', id).toPromise();
  }

  // ========== LABELS ==========
  async createLabel(data: any) {
    return this.client.send('labels.create', data).toPromise();
  }

  async findAllLabels() {
    return this.client.send('labels.findAll', {}).toPromise();
  }

  async findLabelsByBoard(boardId: string) {
    return this.client.send('labels.findByBoard', boardId).toPromise();
  }

  async findOneLabel(id: string) {
    return this.client.send('labels.findOne', id).toPromise();
  }

  async updateLabel(id: string, data: any) {
    return this.client.send('labels.update', { id, ...data }).toPromise();
  }

  async removeLabel(id: string) {
    return this.client.send('labels.remove', id).toPromise();
  }
}