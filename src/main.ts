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
      'The API documentation for authentication, post management, plans, and Stripe payments',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  console.log(`http://localhost:${process.env.PORT}`);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((error: any) => {
  console.log(error);
  process.exit(1);
});
