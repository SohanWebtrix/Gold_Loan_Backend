/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as Sentry from "@sentry/node";


Sentry.init({
  dsn: "https://c44430e6475b8b79fa4c4862f087c093@o4511044105273344.ingest.de.sentry.io/4511044110450768",
});


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // remove extra fields
      forbidNonWhitelisted: true, // throw error on extra fields
      transform: true,        // auto transform types
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
