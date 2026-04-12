import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import AppConfig from './configs/app.config';
import { InjectSwagger, InjectPipes, InjectInterceptors } from './core/injectors';
import { AppModule } from './app.module';

async function bootstrap() {
    /* Bootstrap express application */
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        rawBody: true,
        cors: true,
    });

    /* Enable API versioning */
    app.enableVersioning({ type: VersioningType.URI });

    /* Set proxy as trustful to forward IP address */
    app.set('trust proxy', 1);

    const uploadDir = join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

    /* Add custom Injectors here */
    InjectPipes(app);
    InjectInterceptors(app);
    InjectSwagger(app);

    /* Start the application on a specified port */
    await app.listen(AppConfig.APP.PORT || 3000);
}
bootstrap();
