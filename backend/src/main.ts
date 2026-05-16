import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const DEFAULT_PORT = 3001
const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_GLOBAL_PREFIX = 'api'

function parseCorsOrigins(rawOrigins?: string): string[] | boolean {
  if (rawOrigins === undefined || rawOrigins.trim().length === 0) {
    return true
  }

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  const frontendOrigins = parseCorsOrigins(
    configService.get<string>('FRONTEND_ORIGINS') ??
      configService.get<string>('FRONTEND_ORIGIN'),
  )
  const globalPrefix =
    configService.get<string>('APP_GLOBAL_PREFIX') ?? DEFAULT_GLOBAL_PREFIX
  const port = Number(configService.get<string>('APP_PORT') ?? DEFAULT_PORT)
  const host = configService.get<string>('APP_HOST') ?? DEFAULT_HOST

  app.setGlobalPrefix(globalPrefix)
  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      // Валидируем query/body и удаляем лишние поля из входящих данных.
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  await app.listen(port, host)
}

void bootstrap()
