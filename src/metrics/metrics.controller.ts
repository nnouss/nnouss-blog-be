import { Controller, Post, Req, HttpCode, HttpStatus } from '@nestjs/common';
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
}
