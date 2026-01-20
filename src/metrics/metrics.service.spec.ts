import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: RedisService,
          useValue: {
            client: {
              pfadd: jest.fn().mockResolvedValue(1),
              incr: jest.fn().mockResolvedValue(1),
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
