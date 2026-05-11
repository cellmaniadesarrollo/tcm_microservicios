import { Test, TestingModule } from '@nestjs/testing';
import { CustomersEventsService } from './customers-events.service';

describe('CustomersEventsService', () => {
  let service: CustomersEventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersEventsService],
    }).compile();

    service = module.get<CustomersEventsService>(CustomersEventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
