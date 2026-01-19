import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import 'dotenv/config';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
