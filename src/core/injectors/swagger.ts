import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export default function InjectSwagger(app: INestApplication) {
    const v1Options = new DocumentBuilder()
        .setTitle('API')
        .setVersion('1.0')
        .setDescription(
            'OpenAPI UI path: **/v1/api** (not /api-docs). After code changes, restart the server so routes and descriptions refresh.',
        )
        .addTag(
            'Preferences',
            'Saved recommendation fields from the client modal: `GET/PUT /api/v1/preferences/recommendation`. Consumed by `POST /api/v1/ai/recommender/recommend` when the body is `{}` or omitted.',
        )
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