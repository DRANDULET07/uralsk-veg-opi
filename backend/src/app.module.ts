import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClientsModule } from './clients/clients.module';
import { DatabaseModule } from './database/database.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [DatabaseModule, ClientsModule, OrdersModule, ProductsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
