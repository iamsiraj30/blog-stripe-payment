import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('/api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Rom Auth & Payments API')
    .setDescription(
      `## Overview
This is the full REST API for the **Rom Auth & Payments** platform.

      `,
    )
    .setVersion('1.0.0')
    .setContact('Sirajul Islam', '', 'iamsiraj13sirajul@gmail.com')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Enter the JWT access token obtained from POST /auth/login',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Rom Auth API Docs',
  });

  console.log(`http://localhost:${process.env.PORT}`);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error: any) => {
  console.log(error);
  process.exit(1);
});
