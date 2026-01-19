import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class MetricsService {
    constructor(private readonly redis: RedisService) {}

    /**
     * 페이지뷰 트래킹: HLL에 방문자 추가(DAU), 카운터 증가(PV)
     * @param visitorId 로그인: userId, 비로그인: X-Visitor-Id 헤더 또는 IP 기반
     */
    async track(visitorId: string): Promise<void> {
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const hllKey = `visits:hll:${dateStr}`;
        const countKey = `visits:count:${dateStr}`;

        await this.redis.client.pfadd(hllKey, visitorId);
        await this.redis.client.incr(countKey);
    }
}
