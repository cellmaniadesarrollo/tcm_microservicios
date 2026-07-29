import { Test, TestingModule } from '@nestjs/testing';
import { UsersEmployeesEventsController } from './users-employees-events.controller';

describe('UsersEmployeesEventsController', () => {
  let controller: UsersEmployeesEventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersEmployeesEventsController],
    }).compile();

    controller = module.get<UsersEmployeesEventsController>(UsersEmployeesEventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
