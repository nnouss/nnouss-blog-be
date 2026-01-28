import {
    Controller,
    Post,
    Req,
    HttpCode,
    HttpStatus,
    Get,
} from '@nestjs/common';
import { Request } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
    constructor(private readonly metricsService: MetricsService) {}

    /**
     * 페이지 뷰 트래킹 (프론트: 페이지 이동/로드 시 1회 호출)
     * - DAU: HLL에 visitorId 추가
     * - PV: 일별 카운터 +1
     *
     * visitorId: X-Visitor-Id(헤더) > clientIp > 'anon:unknown'
     * clientIp: x-forwarded-for > x-real-ip > req.socket.remoteAddress
     */
    @Post('track')
    @HttpCode(HttpStatus.NO_CONTENT)
    async track(@Req() req: Request): Promise<void> {
        const forwarded = req.headers['x-forwarded-for'];
        const realIp = req.headers['x-real-ip'];
        const clientIp =
            typeof forwarded === 'string'
                ? forwarded.split(',')[0].trim()
                : typeof realIp === 'string'
                  ? realIp.trim()
                  : req.socket?.remoteAddress;

        const visitorId =
            (req.headers['x-visitor-id'] as string) ??
            clientIp ??
            'anon:unknown';

        await this.metricsService.track(visitorId);
    }

    /**
     * 통계 요약 조회
     * - today: 오늘 방문자 수 (Redis 실시간)
     * - total: 누적 방문자 수 (DB 합계)
     */
    @Get('summary')
    async getSummary() {
        return await this.metricsService.getSummary();
    }

    /**
     * 통계 그래프: 최근 5일 일별 데이터 (DAU, PV)
     */
    @Get('chart')
    async getChart() {
        return await this.metricsService.getChart();
    }
}
