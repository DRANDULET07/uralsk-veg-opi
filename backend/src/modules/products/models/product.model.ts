export const ProductAvailability = {
  Warehouse: 'warehouse',
  Transit: 'transit',
} as const

export type ProductAvailability =
  (typeof ProductAvailability)[keyof typeof ProductAvailability]

export const ProductStatusTone = {
  Fresh: 'fresh',
  Stock: 'stock',
  Transit: 'transit',
} as const

export type ProductStatusTone =
  (typeof ProductStatusTone)[keyof typeof ProductStatusTone]

export const ProductUnitMode = {
  Tons: 'tons',
  Kg: 'kg',
} as const

export type ProductUnitMode =
  (typeof ProductUnitMode)[keyof typeof ProductUnitMode]

export const ProductSortOption = {
  PriceAsc: 'price_asc',
  PriceDesc: 'price_desc',
} as const

export type ProductSortOption =
  (typeof ProductSortOption)[keyof typeof ProductSortOption]

export interface Product {
  id: string
  name: string
  subtitle: string
  imageUrl: string
  statusEmoji: string
  statusText: string
  statusTone: ProductStatusTone
  availability: ProductAvailability
  basePrice: number
  minOrder: string | null
  location: string
  warehouseId: string | null
  bookingNote: string | null
  unitMode: ProductUnitMode
  sliderMin: number
  sliderMax: number
  sliderStep: number
  defaultVolume: number
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
}
