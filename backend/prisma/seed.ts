import { PrismaClient } from '@prisma/client'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadLocalEnv(): void {
  const envPath = join(__dirname, '..', '.env')

  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) continue

    const separatorIndex = trimmedLine.indexOf('=')

    if (separatorIndex === -1) continue

    const key = trimmedLine.slice(0, separatorIndex).trim()
    const value = trimmedLine.slice(separatorIndex + 1).trim()

    if (key.length > 0 && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadLocalEnv()

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const products = [
    {
      id: 'potato',
      name: 'Картофель',
      subtitle: 'Местный, КХ',
      imageUrl: '/products/potato.jpg',
      statusEmoji: '🟢',
      statusText: 'Свежий привоз сегодня в 08:00',
      statusTone: 'fresh',
      availability: 'warehouse',
      basePrice: 150,
      minOrder: 'Минимальный опт от 1 тонны',
      location: 'Склад №1, Уральск',
      warehouseId: 'warehouse-1',
      bookingNote: null,
      unitMode: 'tons',
      sliderMin: 1,
      sliderMax: 20,
      sliderStep: 0.5,
      defaultVolume: 5,
    },
    {
      id: 'onion',
      name: 'Лук репчатый',
      subtitle: 'Оптовая партия',
      imageUrl: '/products/onion.jpg',
      statusEmoji: '🟡',
      statusText: 'В наличии, на складе 3 дня',
      statusTone: 'stock',
      availability: 'warehouse',
      basePrice: 110,
      minOrder: 'Минимальный опт от 1 тонны',
      location: 'Склад №1, Уральск',
      warehouseId: 'warehouse-1',
      bookingNote: null,
      unitMode: 'tons',
      sliderMin: 1,
      sliderMax: 20,
      sliderStep: 0.5,
      defaultVolume: 3,
    },
    {
      id: 'carrot',
      name: 'Морковь',
      subtitle: 'Мытая',
      imageUrl: '/products/carrot.jpg',
      statusEmoji: '🚚',
      statusText: 'В пути, ожидается завтра',
      statusTone: 'transit',
      availability: 'transit',
      basePrice: 130,
      minOrder: 'Минимальный опт от 1 тонны',
      location: 'Таможенный пост «Маштаково» / Самарская трасса',
      warehouseId: null,
      bookingNote: 'Доступно бронирование',
      unitMode: 'tons',
      sliderMin: 1,
      sliderMax: 20,
      sliderStep: 0.5,
      defaultVolume: 4,
    },
    {
      id: 'tomato',
      name: 'Томаты',
      subtitle: 'Тепличные',
      imageUrl: '/products/tomato.jpg',
      statusEmoji: '🟢',
      statusText: 'Свежий привоз сегодня',
      statusTone: 'fresh',
      availability: 'warehouse',
      basePrice: 650,
      minOrder: 'Опт от 500 кг',
      location: 'Склад №2, охлаждаемый',
      warehouseId: 'warehouse-2',
      bookingNote: null,
      unitMode: 'kg',
      sliderMin: 500,
      sliderMax: 5000,
      sliderStep: 100,
      defaultVolume: 1500,
    },
    {
      id: 'cabbage',
      name: 'Капуста',
      subtitle: 'Белокочанная',
      imageUrl: '/products/cabbage.jpg',
      statusEmoji: '🟢',
      statusText: 'Свежий привоз сегодня в 10:30',
      statusTone: 'fresh',
      availability: 'warehouse',
      basePrice: 95,
      minOrder: 'Минимальный опт от 1 тонны',
      location: 'Склад №1, Уральск',
      warehouseId: 'warehouse-1',
      bookingNote: null,
      unitMode: 'tons',
      sliderMin: 1,
      sliderMax: 20,
      sliderStep: 0.5,
      defaultVolume: 2,
    },
  ] as const

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    })
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
