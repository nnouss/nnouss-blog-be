import { Injectable } from '@nestjs/common';
import { format, subDays, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MetricsService {
    constructor(
        private readonly redis: RedisService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * 페이지뷰 트래킹: HLL에 방문자 추가(DAU), 카운터 증가(PV)
     * @param visitorId 로그인: userId, 비로그인: X-Visitor-Id 헤더 또는 IP 기반
     */
    async track(visitorId: string): Promise<void> {
        const dateStr = format(new Date(), 'yyyy-MM-dd', { locale: ko });
        const hllKey = `visits:hll:${dateStr}`;
        const countKey = `visits:count:${dateStr}`;

        await this.redis.client.pfadd(hllKey, visitorId);
        await this.redis.client.incr(countKey);
    }

    /**
     * Redis 일별 집계(DAU, PV)를 DB DailyTrafficStat에 동기화
     * @param targetDate 없으면 전날, 있으면 해당 날짜
     */
    @Cron('5 0 * * *')
    async syncDailyTrafficToDb(targetDate?: Date): Promise<void> {
        const date = targetDate ?? subDays(new Date(), 1);
        const dateOnly = startOfDay(date);
        const dateStr = format(dateOnly, 'yyyy-MM-dd', { locale: ko });

        const hllKey = `visits:hll:${dateStr}`;
        const countKey = `visits:count:${dateStr}`;

        const dau = await this.redis.client.pfcount(hllKey);
        const pvRaw = await this.redis.client.get(countKey);
        const pv = pvRaw ? parseInt(pvRaw, 10) : 0;

        await this.prisma.dailyTrafficStat.upsert({
            where: { date: dateOnly },
            update: { dau, pv },
            create: { date: dateOnly, dau, pv },
        });
    }
}
