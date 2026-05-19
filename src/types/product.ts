export type ProductStatusTone = 'fresh' | 'stock' | 'transit'
export type ProductAvailability = 'warehouse' | 'transit'
export type ProductUnitMode = 'tons' | 'kg'

export interface Product {
  id: string
  name: string
  category?: string | null
  image: string
  wholesale_price?: number | null
  retail_price?: number | null
  unit?: string | null
  min_order?: number | null
  status?: string | null
  freshness?: string | null
  location: string
  description?: string | null
  origin?: string | null
  in_stock?: boolean | null
  stock_amount?: number | null
  is_in_transit?: boolean | null
  delivery_eta?: string | null
  created_at?: string | null
  updated_at?: string | null

  subtitle: string
  statusEmoji: string
  statusText: string
  statusTone: ProductStatusTone
  availability: ProductAvailability
  basePrice: number
  minOrder?: string
  bookingNote?: string
  unitMode: ProductUnitMode
  sliderMin: number
  sliderMax: number
  sliderStep: number
  defaultVolume: number
  retailStockKg?: number
  analyticsTitle: string
  analyticsText: string
  trackStatus?: null
  trackSteps?: string[]
  trackCurrent?: number
}

export type ProductUpdate = Partial<
  Pick<
    Product,
    | 'name'
    | 'category'
    | 'image'
    | 'wholesale_price'
    | 'retail_price'
    | 'unit'
    | 'min_order'
    | 'status'
    | 'freshness'
    | 'location'
    | 'description'
    | 'origin'
    | 'in_stock'
    | 'stock_amount'
    | 'is_in_transit'
    | 'delivery_eta'
  >
>
