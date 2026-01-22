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

    async track(visitorId: string): Promise<void> {
        const dateStr = format(new Date(), 'yyyy-MM-dd', { locale: ko });
        const hllKey = `visits:hll:${dateStr}`;
        const countKey = `visits:count:${dateStr}`;

        await this.redis.client.pfadd(hllKey, visitorId);
        await this.redis.client.incr(countKey);
    }

    /**
     * Redis 일별 집계(DAU, PV)를 DB DailyTrafficStat에 동기화
     */
    @Cron('5 0 * * *')
    async syncDailyTrafficToDb(): Promise<void> {
        const today = format(new Date(), 'yyyy-MM-dd', { locale: ko });
        const yesterday = subDays(today, 1);

        const dateOnly = startOfDay(yesterday);
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
