import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import 'dotenv/config';

// 타임존 설정 (크론 작업을 위해 프로세스 레벨에서 설정)
if (!process.env.TZ) {
    process.env.TZ = 'Asia/Seoul';
}

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // 타임존 설정 확인 로그
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const processTimezone = process.env.TZ || 'not set';
    console.log('=== 애플리케이션 시작 ===');
    console.log(`시스템 타임존: ${timezone}`);
    console.log(`프로세스 TZ 환경 변수: ${processTimezone}`);
    console.log(`현재 시간 (UTC): ${new Date().toISOString()}`);
    console.log(`현재 시간 (로컬): ${new Date().toString()}`);

    app.set('trust proxy', 1);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // CORS
    app.enableCors({
        origin: [
            'http://localhost:3000',
            'https://slas-log-fe.vercel.app',
            'https://www.slas.kr',
            'https://www.slas.kr/',
        ],
        credentials: true,
    });

    await app.listen(8000);
}
bootstrap();
