import { Test, TestingModule } from '@nestjs/testing';
import { CustomersEventsController } from './customers-events.controller';

describe('CustomersEventsController', () => {
  let controller: CustomersEventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersEventsController],
    }).compile();

    controller = module.get<CustomersEventsController>(CustomersEventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
