import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DatabaseModule } from './database/database.module'
import { HealthController } from './health.controller'
import { ProductsModule } from './modules/products/products.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    DatabaseModule,
    ProductsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
