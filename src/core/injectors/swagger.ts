import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export default function InjectSwagger(app: INestApplication) {
    const v1Options = new DocumentBuilder()
        .setTitle('API')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT token',
            },
            'bearer',  // This name must match @ApiBearerAuth('bearer')
        )
        .build();

    const v1Document = SwaggerModule.createDocument(app, v1Options);
    SwaggerModule.setup('/v1/api', app, v1Document);
}