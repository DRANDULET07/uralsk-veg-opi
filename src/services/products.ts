import { supabase } from '../lib/supabase'
import type { Product, ProductUpdate } from '../types/product'

type ProductRow = Record<string, unknown>

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function toUnitMode(unit?: string): Product['unitMode'] {
  const normalized = unit?.toLowerCase() ?? ''
  return normalized.includes('т') || normalized.includes('ton') ? 'tons' : 'kg'
}

function toStatusTone(row: ProductRow, isInTransit: boolean, inStock: boolean): Product['statusTone'] {
  const status = asString(row.status)?.toLowerCase()
  if (isInTransit || status?.includes('пути') || status?.includes('transit')) return 'transit'
  if (inStock) return 'fresh'
  return 'stock'
}

function makeStatusText(row: ProductRow, isInTransit: boolean, inStock: boolean): string {
  const status = asString(row.status)
  const eta = asString(row.delivery_eta)
  if (status) return status
  if (isInTransit) return eta ? `В пути (${eta})` : 'В пути'
  return inStock ? 'В наличии' : 'Ожидается поступление'
}

function makeMinOrder(row: ProductRow, minOrder: number, unit: string): string {
  const explicit = asString(row.minOrder) ?? asString(row.min_order_label)
  if (explicit) return explicit
  return `Минимальный заказ от ${minOrder} ${unit}`
}

function normalizeProduct(row: ProductRow, index: number): Product {
  const unit = asString(row.unit) ?? 'кг'
  const unitMode = toUnitMode(unit)
  const wholesalePrice = asNumber(row.wholesale_price) ?? asNumber(row.basePrice) ?? asNumber(row.price) ?? 0
  const retailPrice = asNumber(row.retail_price) ?? wholesalePrice
  const minOrder = asNumber(row.min_order) ?? 1
  const stockAmount = asNumber(row.stock_amount) ?? asNumber(row.retailStockKg) ?? 0
  const inStock = asBoolean(row.in_stock) ?? stockAmount > 0
  const isInTransit = asBoolean(row.is_in_transit) ?? false
  const statusTone = toStatusTone(row, isInTransit, inStock)
  const availability = isInTransit ? 'transit' : 'warehouse'
  const id = asString(row.id) ?? asString(row.slug) ?? String(index + 1)
  const name = asString(row.name) ?? 'Товар'
  const category = asString(row.category)
  const description = asString(row.description)
  const location = asString(row.location) ?? 'Склад №1 (Уральск)'

  return {
    id,
    name,
    category,
    image: asString(row.image) ?? asString(row.image_url) ?? '',
    wholesale_price: wholesalePrice,
    retail_price: retailPrice,
    unit,
    min_order: minOrder,
    status: asString(row.status) ?? null,
    freshness: asString(row.freshness) ?? null,
    location,
    description: description ?? null,
    origin: asString(row.origin) ?? null,
    in_stock: inStock,
    stock_amount: stockAmount,
    is_in_transit: isInTransit,
    delivery_eta: asString(row.delivery_eta) ?? null,
    created_at: asString(row.created_at) ?? null,
    updated_at: asString(row.updated_at) ?? null,

    subtitle: category ?? asString(row.origin) ?? 'Овощи',
    statusEmoji: '',
    statusText: makeStatusText(row, isInTransit, inStock),
    statusTone,
    availability,
    basePrice: wholesalePrice,
    minOrder: makeMinOrder(row, minOrder, unit),
    bookingNote: isInTransit ? 'Доступно бронирование' : undefined,
    unitMode,
    sliderMin: minOrder,
    sliderMax: Math.max(minOrder, stockAmount || (unitMode === 'tons' ? 20 : 50)),
    sliderStep: unitMode === 'tons' ? 0.5 : 1,
    defaultVolume: minOrder,
    retailStockKg: stockAmount,
    analyticsTitle: asString(row.freshness) ?? 'Актуальная рыночная информация',
    analyticsText: description ?? 'Данные по товару загружены из Supabase.',
    trackStatus: null,
    trackSteps: isInTransit
      ? ['Отгружено', asString(row.delivery_eta) ?? 'В пути', location]
      : undefined,
    trackCurrent: isInTransit ? 1 : undefined,
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }

  try {
    return JSON.stringify(error)
  } catch {
    return 'Неизвестная ошибка'
  }
}

function handleProductsError(message: string, error: unknown): never {
  const detail = getErrorMessage(error)
  throw new Error(`${message}: ${detail}`)
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? [])
    .map((row, index) => normalizeProduct(row, index))
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'ru')
      return byName !== 0 ? byName : a.id.localeCompare(b.id)
    })
}

export async function getProductById(id: string): Promise<Product | null> {
  const query = supabase.from('products').select('*')
  const { data, error } = await (isUuid(id) ? query.eq('id', id) : query.eq('id', id)).maybeSingle()

  if (error) handleProductsError('Не удалось загрузить товар из Supabase', error)
  return data ? normalizeProduct(data, 0) : null
}

export async function updateProduct(id: string, data: ProductUpdate): Promise<Product> {
  const { data: updatedProduct, error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) handleProductsError('Не удалось обновить товар в Supabase', error)
  return normalizeProduct(updatedProduct, 0)
}
