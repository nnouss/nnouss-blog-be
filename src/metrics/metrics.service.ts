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
    @Cron('0 20 13 * * *')
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

    /**
     * 통계 요약: 오늘 방문자 수, 누적 방문자 수
     */
    async getSummary(): Promise<{ today: number; total: number }> {
        const today = format(new Date(), 'yyyy-MM-dd', { locale: ko });
        const hllKey = `visits:hll:${today}`;

        const todayVisitors = await this.redis.client.pfcount(hllKey);

        const result = await this.prisma.dailyTrafficStat.aggregate({
            _sum: {
                dau: true,
            },
        });

        const totalVisitors = result._sum.dau ?? 0;

        return {
            today: todayVisitors,
            total: totalVisitors,
        };
    }

    /**
     * 통계 그래프: 최근 5일 일별 데이터 (DAU, PV)
     */
    async getChart(): Promise<{
        data: Array<{ date: string; dau: number; pv: number }>;
    }> {
        const stats = await this.prisma.dailyTrafficStat.findMany({
            take: 5,
            orderBy: { date: 'desc' },
            select: {
                date: true,
                dau: true,
                pv: true,
            },
        });

        const data = stats.reverse().map((stat) => ({
            date: stat.date.toISOString().slice(0, 10),
            dau: stat.dau,
            pv: stat.pv,
        }));

        return { data };
    }
}
