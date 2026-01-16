import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
    constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

    getClient(): Redis {
        return this.client;
    }
}
