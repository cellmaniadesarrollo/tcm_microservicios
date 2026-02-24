import { Test, TestingModule } from '@nestjs/testing';
import { UsersEmployeesEventsService } from './users-employees-events.service';

describe('UsersEmployeesEventsService', () => {
  let service: UsersEmployeesEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersEmployeesEventsService],
    }).compile();

    service = module.get<UsersEmployeesEventsService>(UsersEmployeesEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
