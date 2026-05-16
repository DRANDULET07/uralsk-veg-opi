import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Открывает соединение Prisma при старте приложения.
   *
   * @returns Promise без значения после подключения к БД.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  /**
   * Закрывает соединение Prisma при остановке приложения.
   *
   * @returns Promise без значения после отключения от БД.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
