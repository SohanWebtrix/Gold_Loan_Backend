/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as Sentry from "@sentry/node";


Sentry.init({
  dsn: "https://7ad3c4242f4b3df473309856a9d8549b@o4511274842652672.ingest.de.sentry.io/4511274844291152",
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
