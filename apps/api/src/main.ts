import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis-io.adapter';
import { ZodError } from 'zod';
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch(ZodError)
class ValidationFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    host.switchToHttp().getResponse().status(400).send({
      statusCode: 400,
      message: exception.issues.map((issue) => issue.path.join('.') + ': ' + issue.message).join('; '),
    });
  }
}

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('Set JWT_SECRET to a securely generated secret of at least 32 characters');
  }
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: false }));
  await app.register(fastifyCookie);
  app.enableCors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true });
  app.useGlobalFilters(new ValidationFilter());
  const adapter = new RedisIoAdapter(app);
  await adapter.connectToRedis();
  app.useWebSocketAdapter(adapter);
  app.getHttpAdapter().getInstance().get('/health', async () => ({ ok: true }));
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
  console.log('Crown API listening on port ' + (process.env.PORT || '4000'));
}
bootstrap().catch((error) => { console.error(error); process.exit(1); });
