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

    app.set('trust proxy', 1);
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // CORS
    app.enableCors({
        origin: [
            'http://localhost:3000',
            'https://nnouss-blog-fe.vercel.app/',
            'https://nnouss.xyz',
            'https://nnouss.xyz/',
        ],
        credentials: true,
    });

    await app.listen(8000);
}
bootstrap();
