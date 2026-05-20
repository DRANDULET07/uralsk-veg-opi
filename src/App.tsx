import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  CalendarCheck,
  CheckCircle2,
  Leaf,
  Lock,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { getErrorMessage, getProducts } from './services/products'
import type { Product } from './types/product'

const WHATSAPP_PHONE = '77774681889'
const PROFILE_PHONE = '+7 (707) XXX-XX-XX'

type TabId = 'all' | 'warehouse' | 'transit'
type WarehouseFilterId = 'all' | 'warehouse1' | 'warehouse2'
type SortOption = 'default' | 'price-asc' | 'price-desc'
type CustomerType = 'retail' | 'wholesale' | 'shop' | 'cafe'
type OrderType = 'retail' | 'wholesale'
type FulfillmentType = 'pickup' | 'delivery'
type AdminOrderStatus = 'new' | 'processing' | 'completed' | 'cancelled'
type AdminStatusFilter = AdminOrderStatus | 'all'
type Cart = Record<string, number>

interface CartLine {
  product: Product
  volume: number
  total: number
  volumeLabel: string
}

interface SavedOrderItem {
  productId: string
  productName: string
  volume: number
  volumeLabel: string
  total: number
}

interface SavedOrder {
  userName?: string
  createdAt: string
  items: SavedOrderItem[]
  total: number
  status: string
}

interface MockOrder {
  id: string
  date: string
  productName: string
  productId: string
  volume: number
  status: string
  statusTone: 'delivered' | 'transit'
}

interface CheckoutForm {
  name: string
  phone: string
  customerType: CustomerType | ''
  orderType: OrderType | ''
  fulfillment: FulfillmentType | ''
  address: string
  comment: string
}

interface AdminOrderItem {
  id: string
  order_id: string
  product_id: number | null
  product_name: string
  quantity_kg: number
  price_per_kg: number
  total_amount: number
  created_at?: string | null
}

interface AdminOrder {
  id: string
  client_id?: string | null
  customer_name: string
  customer_phone: string
  client_type: string
  order_type: string
  receiving_type: string
  delivery_address?: string | null
  comment?: string | null
  total_weight_kg: number
  total_amount: number
  status: AdminOrderStatus
  created_at: string
  items: AdminOrderItem[]
}

const LOCAL_STORAGE_LAST_ORDER = 'last_vegetable_order'
const LOCAL_STORAGE_HISTORY = 'order_history'
const ADMIN_PASSWORD = 'admin123'
const RETAIL_MARKUP = 90
const RETAIL_MIN_ORDER_KG = 1
const WHOLESALE_MIN_ORDER_KG = 25

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  retail: 'Розница',
  wholesale: 'Оптовик',
  shop: 'Магазин',
  cafe: 'Кафе',
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  retail: 'Розничный',
  wholesale: 'Оптовый',
}

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  pickup: 'Самовывоз',
  delivery: 'Доставка',
}

const ADMIN_STATUS_LABELS: Record<AdminOrderStatus, string> = {
  new: 'Новый',
  processing: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

const ADMIN_STATUS_OPTIONS: { id: AdminStatusFilter; label: string }[] = [
  { id: 'all', label: 'Все статусы' },
  { id: 'new', label: ADMIN_STATUS_LABELS.new },
  { id: 'processing', label: ADMIN_STATUS_LABELS.processing },
  { id: 'completed', label: ADMIN_STATUS_LABELS.completed },
  { id: 'cancelled', label: ADMIN_STATUS_LABELS.cancelled },
]

const RETAIL_QUICK_QUANTITIES = [1, 3, 5, 10, 25]
const WHOLESALE_QUICK_QUANTITIES = [25, 50, 100, 500, 1000]

const fallbackProducts: Product[] = [
  {
    id: 'potato',
    name: 'Картофель',
    subtitle: 'Местный, КХ',
    image: '/products/potato.jpg',
    statusEmoji: '',
    statusText: 'Свежий привоз (Сегодня 08:00)',
    statusTone: 'fresh',
    availability: 'warehouse',
    basePrice: 150,
    minOrder: 'Минимальный опт от 1 тонны',
    location: 'Склад №1 (Уральск)',
    unitMode: 'tons',
    sliderMin: 1,
    sliderMax: 20,
    sliderStep: 0.5,
    defaultVolume: 5,
    retailStockKg: 42,
    analyticsTitle: '📊 Аналитика рынка: цена стабильна',
    analyticsText: 'На рынке Уральска стабильный объем местного картофеля. В ближайшие 2 недели ценовых скачков не ожидается, запасы на складе в избытке.',
    trackStatus: null,
  },
  {
    id: 'onion',
    name: 'Лук репчатый',
    subtitle: 'Оптовая партия',
    image: '/products/onion.jpg',
    statusEmoji: '',
    statusText: 'В наличии (На складе 3 дня)',
    statusTone: 'stock',
    availability: 'warehouse',
    basePrice: 110,
    minOrder: 'Минимальный опт от 1 тонны',
    location: 'Склад №1 (Уральск)',
    unitMode: 'tons',
    sliderMin: 1,
    sliderMax: 20,
    sliderStep: 0.5,
    defaultVolume: 3,
    retailStockKg: 38,
    analyticsTitle: '📉 Скидки: сезонное снижение цены',
    analyticsText: 'Поступил крупный объем репчатого лука высокого качества. При закупке от 5 тонн действуют специальные оптовые условия.',
    trackStatus: null,
  },
  {
    id: 'carrot',
    name: 'Морковь',
    subtitle: 'Мытая',
    image: '/products/carrot.jpg',
    statusEmoji: '',
    statusText: 'В пути (Ожидается завтра)',
    statusTone: 'transit',
    availability: 'transit',
    basePrice: 130,
    bookingNote: 'Доступно бронирование',
    location: 'Таможенный пост «Маштаково» / Самарская трасса',
    unitMode: 'tons',
    sliderMin: 1,
    sliderMax: 20,
    sliderStep: 0.5,
    defaultVolume: 4,
    retailStockKg: 25,
    analyticsTitle: '📈 Прогноз: ожидается подорожание к концу недели',
    analyticsText: 'Из-за задержек крупных фур на КПП Маштаково прогнозируется временный дефицит свежей моркови. Рекомендуем зафиксировать объемы.',
    trackSteps: ['Отгружено (Ташкент)', 'Граница (КПП Маштаково)', 'Склад №1 (Уральск)'],
    trackCurrent: 1,
  },
  {
    id: 'tomato',
    name: 'Томаты',
    subtitle: 'Тепличные',
    image: '/products/tomato.jpg',
    statusEmoji: '',
    statusText: 'Свежий привоз (Сегодня)',
    statusTone: 'fresh',
    availability: 'warehouse',
    basePrice: 650,
    minOrder: 'Опт от 500 кг',
    location: 'Склад №2 (Охлаждаемый)',
    unitMode: 'kg',
    sliderMin: 500,
    sliderMax: 5000,
    sliderStep: 100,
    defaultVolume: 1500,
    retailStockKg: 50,
    analyticsTitle: '📊 Аналитика: высокий спрос',
    analyticsText: 'Тепличные томаты пользуются повышенным спросом перед выходными. Объемы на Складе №2 (Охлаждаемый) тают быстро, планируйте закуп заранее.',
    trackStatus: null,
  },
  {
    id: 'cabbage',
    name: 'Капуста',
    subtitle: 'Белокочанная',
    image: '/products/cabbage.jpg',
    statusEmoji: '',
    statusText: 'Свежий привоз (Сегодня 10:30)',
    statusTone: 'fresh',
    availability: 'warehouse',
    basePrice: 95,
    minOrder: 'Минимальный опт от 1 тонны',
    location: 'Склад №1 (Уральск)',
    unitMode: 'tons',
    sliderMin: 1,
    sliderMax: 20,
    sliderStep: 0.5,
    defaultVolume: 2,
    retailStockKg: 44,
    analyticsTitle: '📊 Аналитика рынка: цена стабильна',
    analyticsText: 'Белокочанная капуста зафиксировалась в цене. Качество партии отличное, листы плотные, товар готов к длительной транспортировке.',
    trackStatus: null,
  },
]

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'Все овощи' },
  { id: 'warehouse', label: 'В наличии на складе' },
  { id: 'transit', label: 'Товар в пути' },
]

const WAREHOUSE_FILTERS: { id: WarehouseFilterId; label: string }[] = [
  { id: 'all', label: 'Все склады' },
  { id: 'warehouse1', label: 'Склад №1 (Уральск)' },
  { id: 'warehouse2', label: 'Склад №2 (Охлаждаемый)' },
]

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'default', label: 'По умолчанию' },
  { id: 'price-asc', label: 'По цене ↑' },
  { id: 'price-desc', label: 'По цене ↓' },
]

const MOCK_ORDERS: MockOrder[] = [
  {
    id: '1024',
    date: '12.05',
    productName: 'Картофель',
    productId: 'potato',
    volume: 3,
    status: 'Доставлено',
    statusTone: 'delivered',
  },
  {
    id: '1018',
    date: '28.04',
    productName: 'Лук репчатый',
    productId: 'onion',
    volume: 5,
    status: 'В пути',
    statusTone: 'transit',
  },
]

const orderStatusClass: Record<MockOrder['statusTone'], string> = {
  delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  transit: 'bg-sky-50 text-sky-800 border-sky-200',
}

function formatDateRu(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value))
}

function formatCurrency(value: number): string {
  return `${formatMoney(value)} тг`
}

function getMidpoint(min: number, max: number): number {
  return (min + max) / 2
}

function getDiscountPercent(volume: number, min: number, max: number): number {
  const mid = getMidpoint(min, max)
  if (volume <= mid) return 0
  const ratio = (volume - mid) / (max - mid)
  return 5 + ratio * 2
}

function getWeightKg(_product: Product, volume: number, _isB2B = true): number {
  return volume
}

function getAvailableStockKg(product: Product): number {
  return Math.max(0, product.stock_amount ?? product.retailStockKg ?? 0)
}

function formatStockAmount(value: number): string {
  if (value >= 1000) {
    const tons = value / 1000
    return `${Number.isInteger(tons) ? tons : tons.toFixed(1)} т`
  }

  return `${formatMoney(value)} кг`
}

function getStockDisplay(product: Product) {
  const stock = getAvailableStockKg(product)

  if (stock <= 0) {
    return {
      stock,
      label: 'Нет в наличии',
      className: 'border-red-200 bg-red-50 text-red-700',
    }
  }

  if (stock <= 50) {
    return {
      stock,
      label: `Осталось мало: ${formatStockAmount(stock)}`,
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    }
  }

  return {
    stock,
    label: `Доступно: ${formatStockAmount(stock)}`,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
}

function getMinimumOrderKg(isB2B: boolean): number {
  return isB2B ? WHOLESALE_MIN_ORDER_KG : RETAIL_MIN_ORDER_KG
}

function canOrderProduct(product: Product, isB2B: boolean): boolean {
  return getAvailableStockKg(product) >= getMinimumOrderKg(isB2B)
}

function getProductOrderItemId(product: Product): number {
  const productId = Number(product.id)

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error(`У товара «${product.name}» некорректный ID для сохранения заказа.`)
  }

  return productId
}

function getProductDisplayConfig(product: Product, isB2B: boolean) {
  const minOrder = getMinimumOrderKg(isB2B)
  const stock = getAvailableStockKg(product)
  const canOrder = stock >= minOrder

  if (isB2B) {
    const sliderMax = stock

    return {
      unitMode: 'kg' as const,
      sliderMin: minOrder,
      sliderMax,
      sliderStep: 1,
      defaultVolume: canOrder ? minOrder : 0,
    }
  }

  const sliderMax = stock

  return {
    unitMode: 'kg' as const,
    sliderMin: minOrder,
    sliderMax,
    sliderStep: 1,
    defaultVolume: canOrder ? minOrder : 0,
  }
}

function snapVolume(value: number, product: Product, isB2B = true): number {
  const { sliderMin, sliderMax, sliderStep } = getProductDisplayConfig(product, isB2B)
  if (sliderMax < sliderMin) return 0
  const clamped = Math.min(sliderMax, Math.max(sliderMin, value))
  const stepped =
    sliderMin + Math.round((clamped - sliderMin) / sliderStep) * sliderStep
  const decimals = sliderStep % 1 !== 0 ? 1 : 0
  return Number(stepped.toFixed(decimals))
}

function formatVolumeLabel(_product: Product, volume: number, _isB2B = true): string {
  return `${formatMoney(volume)} кг`
}

function formatQuantityWhatsApp(volume: number, isB2B = true): string {
  if (!isB2B || volume < 1000) return `${formatMoney(volume)} кг`

  const tons = volume / 1000
  const label = Number.isInteger(tons) ? String(tons) : tons.toFixed(1)
  return `${label} тонн`
}

function formatVolumeWhatsApp(_product: Product, volume: number, isB2B = true): string {
  return formatQuantityWhatsApp(volume, isB2B)
}

function formatQuickQuantityLabel(value: number): string {
  if (value >= 1000) {
    const tons = value / 1000
    return `${Number.isInteger(tons) ? tons : tons.toFixed(1)} т`
  }

  return `${formatMoney(value)} кг`
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')

  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`
  }

  if (digits.length === 11 && digits.startsWith('7')) {
    return digits
  }

  if (digits.length === 10) {
    return `7${digits}`
  }

  return digits
}

function isValidNormalizedPhone(phone: string): boolean {
  return phone.length === 11 && phone.startsWith('7')
}

function formatPhoneForDisplay(phone: string): string {
  if (!isValidNormalizedPhone(phone)) return phone

  return `+${phone.slice(0, 1)} ${phone.slice(1, 4)} ${phone.slice(4, 7)} ${phone.slice(7, 9)} ${phone.slice(9, 11)}`
}

function createCheckoutForm(isB2B: boolean): CheckoutForm {
  return {
    name: '',
    phone: '',
    customerType: '',
    orderType: isB2B ? 'wholesale' : 'retail',
    fulfillment: '',
    address: '',
    comment: '',
  }
}

function formatOrderVolume(_product: Product, volume: number, _isB2B = true): string {
  return `${formatMoney(volume)} кг`
}

function calcPricing(product: Product, volume: number, isB2B = true) {
  const weightKg = getWeightKg(product, volume, isB2B)
  const { sliderMin, sliderMax } = getProductDisplayConfig(product, isB2B)
  const discount = isB2B
    ? getDiscountPercent(volume, sliderMin, sliderMax)
    : 0
  const wholesalePrice = product.wholesale_price ?? product.basePrice
  const retailPrice = product.retail_price ?? product.basePrice + RETAIL_MARKUP
  const pricePerKg = (isB2B ? wholesalePrice : retailPrice) * (1 - discount / 100)
  const total = weightKg * pricePerKg
  return { weightKg, discount, pricePerKg, total }
}

function getCartLines(cart: Cart, products: Product[], isB2B: boolean): CartLine[] {
  return Object.entries(cart)
    .map(([productId, volume]) => {
      const product = products.find((p) => p.id === productId)
      if (!product) return null
      const { total } = calcPricing(product, volume, isB2B)
      return {
        product,
        volume,
        total,
        volumeLabel: formatVolumeLabel(product, volume, isB2B),
      }
    })
    .filter((line): line is CartLine => line !== null)
}

function buildCartWhatsAppMessage(
  lines: CartLine[],
  grandTotal: number,
  isB2B: boolean,
  checkout?: CheckoutForm,
  normalizedPhone?: string,
): string {
  const itemLines = lines.map((line) => {
    const quantity = formatVolumeWhatsApp(line.product, line.volume, isB2B)
    return `- ${line.product.name}: ${quantity}, итого ${formatCurrency(line.total)}`
  })

  const totalVolume = lines.reduce((sum, line) => sum + line.volume, 0)
  const volumeLabel = formatQuantityWhatsApp(totalVolume, isB2B)
  const displayPhone = normalizedPhone ?? (checkout ? normalizePhone(checkout.phone) : '')
  const details = checkout
    ? [
        `Имя: ${checkout.name.trim()}`,
        `Телефон: ${formatPhoneForDisplay(displayPhone)}`,
        `Тип клиента: ${CUSTOMER_TYPE_LABELS[checkout.customerType as CustomerType]}`,
        `Тип заказа: ${ORDER_TYPE_LABELS[checkout.orderType as OrderType]}`,
        `Получение: ${FULFILLMENT_LABELS[checkout.fulfillment as FulfillmentType]}`,
        checkout.fulfillment === 'delivery' ? `Адрес: ${checkout.address.trim()}` : null,
        checkout.comment.trim() ? `Комментарий: ${checkout.comment.trim()}` : null,
      ].filter((line): line is string => Boolean(line))
    : ['Мой номер в системе: не указан']

  return [
    'Здравствуйте! Хочу забронировать овощи:',
    '',
    ...itemLines,
    '',
    `Всего: ${volumeLabel}`,
    `Общая сумма: ${formatCurrency(grandTotal)}`,
    '',
    ...details,
  ].join('\n')
}

function getCartWhatsAppUrl(
  lines: CartLine[],
  grandTotal: number,
  isB2B: boolean,
  checkout?: CheckoutForm,
  normalizedPhone?: string,
): string {
  const text = buildCartWhatsAppMessage(lines, grandTotal, isB2B, checkout, normalizedPhone)
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
}

function matchesTab(product: Product, tab: TabId): boolean {
  if (tab === 'all') return true
  if (tab === 'warehouse') return product.availability === 'warehouse'
  return product.availability === 'transit'
}

function matchesSearch(product: Product, query: string): boolean {
  if (!query) return true
  const haystack = `${product.name} ${product.subtitle}`.toLowerCase()
  return haystack.includes(query)
}

function getProductWarehouseId(product: Product): WarehouseFilterId | 'transit' {
  if (product.availability === 'transit') return 'transit'
  if (product.location.includes('2')) return 'warehouse2'
  return 'warehouse1'
}

function matchesWarehouse(product: Product, warehouse: WarehouseFilterId): boolean {
  if (warehouse === 'all') return true
  return getProductWarehouseId(product) === warehouse
}

function matchesInStockOnly(product: Product, onlyInStock: boolean): boolean {
  if (!onlyInStock) return true
  return product.availability === 'warehouse'
}

function sortProducts(products: Product[], sortBy: SortOption): Product[] {
  if (sortBy === 'default') return products
  const sorted = [...products]
  if (sortBy === 'price-asc') {
    sorted.sort((a, b) => a.basePrice - b.basePrice)
  } else {
    sorted.sort((a, b) => b.basePrice - a.basePrice)
  }
  return sorted
}

const statusToneClass: Record<Product['statusTone'], string> = {
  fresh: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  stock: 'bg-amber-50 text-amber-900 border-amber-200',
  transit: 'bg-sky-50 text-sky-900 border-sky-200',
}

interface QuantitySelectorProps {
  product: Product
  value: number
  isB2B: boolean
  onChange: (value: number) => void
}

function QuantitySelector({ product, value, isB2B, onChange }: QuantitySelectorProps) {
  const cfg = getProductDisplayConfig(product, isB2B)
  const stockDisplay = getStockDisplay(product)
  const currentQuantity = value
  const minQuantity = cfg.sliderMin
  const maxQuantity = cfg.sliderMax
  const quickQuantities = (isB2B ? WHOLESALE_QUICK_QUANTITIES : RETAIL_QUICK_QUANTITIES).filter(
    (quantity) => quantity >= minQuantity && quantity <= maxQuantity,
  )
  const step = isB2B ? 25 : 1
  const minHint = isB2B ? 'Минимальный заказ от 25 кг' : 'Можно заказать от 1 кг'
  const isOutOfStock = stockDisplay.stock <= 0
  const isBelowMinimum = !isOutOfStock && stockDisplay.stock < minQuantity
  const quantityDisabled = isOutOfStock || isBelowMinimum
  const canDecrease = !quantityDisabled && currentQuantity > minQuantity
  const canIncrease = !quantityDisabled && currentQuantity < maxQuantity

  const commitValue = (nextValue: number) => {
    if (quantityDisabled) return
    onChange(snapVolume(nextValue, product, isB2B))
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">Количество</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{minHint}</p>
          <p
            className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${stockDisplay.className}`}
          >
            {stockDisplay.label}
          </p>
          {isBelowMinimum && (
            <p className="mt-2 text-xs font-bold text-amber-700">
              Остаток меньше минимального заказа
            </p>
          )}
        </div>
        <span
          className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm"
          title={`Кнопки плюс и минус меняют количество на ${step} кг`}
        >
          +/- {step} кг
        </span>
      </div>

      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => commitValue(currentQuantity - step)}
          disabled={!canDecrease}
          className="flex h-12 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 active:scale-95"
          aria-label={`Уменьшить количество ${product.name}`}
        >
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <label className="flex min-w-0 items-center justify-center border-x border-slate-200 px-2">
          <input
            type="number"
            inputMode="numeric"
            min={cfg.sliderMin}
            max={cfg.sliderMax}
            step={cfg.sliderStep}
            value={currentQuantity}
            disabled={quantityDisabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const parsed = Number(e.target.value)
              if (!Number.isNaN(parsed)) {
                commitValue(parsed)
              }
            }}
            onBlur={(e) => {
              const parsed = Number(e.target.value)
              commitValue(Number.isNaN(parsed) || e.target.value === '' ? cfg.sliderMin : parsed)
            }}
            className="w-full bg-transparent text-center text-lg font-bold tabular-nums text-emerald-800 outline-none disabled:text-slate-300"
            aria-label={`Количество ${product.name} в килограммах`}
          />
          <span className="ml-1 text-sm font-semibold text-slate-500">кг</span>
        </label>
        <button
          type="button"
          onClick={() => commitValue(currentQuantity + step)}
          disabled={!canIncrease}
          className="flex h-12 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 active:scale-95"
          aria-label={`Увеличить количество ${product.name}`}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {quickQuantities.length > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {quickQuantities.map((quantity) => {
            const selected = currentQuantity === quantity
            return (
              <button
                key={quantity}
                type="button"
                onClick={() => commitValue(quantity)}
                aria-pressed={selected}
                className={`min-h-9 rounded-lg border px-1.5 text-xs font-bold transition active:scale-[0.98] ${
                  selected
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                }`}
              >
                {formatQuickQuantityLabel(quantity)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProductSkeleton() {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70">
      <div className="relative h-48 w-full overflow-hidden bg-slate-200">
        <div className="absolute inset-0 animate-pulse bg-slate-300" />
      </div>
      <div className="space-y-4 p-5">
        <div className="h-4 w-32 rounded-full bg-slate-200 animate-pulse" />
        <div className="h-6 w-1/2 rounded-full bg-slate-200 animate-pulse" />
        <div className="space-y-3">
          <div className="h-10 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-12 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    </article>
  )
}

function normalizeAdminStatus(value: unknown): AdminOrderStatus {
  return value === 'processing' || value === 'completed' || value === 'cancelled'
    ? value
    : 'new'
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function formatAdminDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminPage() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('uralsk_admin_auth') === 'true',
  )
  const [loginError, setLoginError] = useState<string | null>(null)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>('all')
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

  const loadAdminOrders = async () => {
    setOrdersLoading(true)
    setOrdersError(null)

    try {
      const { data: ordersData, error: ordersErrorResult } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (ordersErrorResult) throw ordersErrorResult

      const orderIds = (ordersData ?? []).map((order) => String(order.id))
      const { data: itemsData, error: itemsError } =
        orderIds.length > 0
          ? await supabase.from('order_items').select('*').in('order_id', orderIds)
          : { data: [], error: null }

      if (itemsError) throw itemsError

      const itemsByOrder = new Map<string, AdminOrderItem[]>()
      ;(itemsData ?? []).forEach((item) => {
        const orderId = String(item.order_id)
        const nextItem: AdminOrderItem = {
          id: String(item.id),
          order_id: orderId,
          product_id: item.product_id === null || item.product_id === undefined ? null : toNumber(item.product_id),
          product_name: String(item.product_name ?? 'Товар'),
          quantity_kg: toNumber(item.quantity_kg),
          price_per_kg: toNumber(item.price_per_kg),
          total_amount: toNumber(item.total_amount),
          created_at: typeof item.created_at === 'string' ? item.created_at : null,
        }
        itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), nextItem])
      })

      setOrders(
        (ordersData ?? []).map((order) => ({
          id: String(order.id),
          client_id: order.client_id ? String(order.client_id) : null,
          customer_name: String(order.customer_name ?? ''),
          customer_phone: String(order.customer_phone ?? ''),
          client_type: String(order.client_type ?? ''),
          order_type: String(order.order_type ?? ''),
          receiving_type: String(order.receiving_type ?? ''),
          delivery_address:
            typeof order.delivery_address === 'string' ? order.delivery_address : null,
          comment: typeof order.comment === 'string' ? order.comment : null,
          total_weight_kg: toNumber(order.total_weight_kg),
          total_amount: toNumber(order.total_amount),
          status: normalizeAdminStatus(order.status),
          created_at: String(order.created_at ?? ''),
          items: itemsByOrder.get(String(order.id)) ?? [],
        })),
      )
    } catch (error) {
      setOrdersError(getErrorMessage(error))
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      void loadAdminOrders()
    }
  }, [isAuthenticated])

  const filteredOrders = useMemo(
    () =>
      statusFilter === 'all'
        ? orders
        : orders.filter((order) => order.status === statusFilter),
    [orders, statusFilter],
  )
  const totalAmount = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0)

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== ADMIN_PASSWORD) {
      setLoginError('Неверный пароль')
      return
    }

    sessionStorage.setItem('uralsk_admin_auth', 'true')
    setIsAuthenticated(true)
    setLoginError(null)
  }

  const updateOrderStatus = async (orderId: string, status: AdminOrderStatus) => {
    setUpdatingOrderId(orderId)
    setOrdersError(null)

    try {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
      if (error) throw error

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status } : order)),
      )
    } catch (error) {
      setOrdersError(getErrorMessage(error))
    } finally {
      setUpdatingOrderId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/70"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Lock className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-900">Админка заказов</h1>
              <p className="text-sm text-slate-500">Временный вход по паролю</p>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setLoginError(null)
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
              autoFocus
            />
          </label>
          {loginError && <p className="mt-2 text-sm font-medium text-red-600">{loginError}</p>}
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-brand-700 px-4 py-3 text-base font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 active:scale-[0.98]"
          >
            Войти
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-6 lg:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <header className="mb-5 flex flex-col gap-4 rounded-3xl bg-brand-900 p-5 text-white shadow-xl shadow-slate-200/70 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100/80">
              URALSK VEG OPI
            </p>
            <h1 className="mt-1 text-2xl font-bold">Админка заказов</h1>
            <p className="mt-1 text-sm text-brand-100">
              Заказов: {filteredOrders.length} · Сумма: {formatCurrency(totalAmount)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AdminStatusFilter)}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-white/30 [&_option]:text-slate-800"
            >
              {ADMIN_STATUS_OPTIONS.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadAdminOrders}
              disabled={ordersLoading}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>
        </header>

        {ordersError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {ordersError}
          </div>
        )}

        {ordersLoading ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-lg shadow-slate-200/60">
            Загружаем заказы...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-lg shadow-slate-200/60">
            Заказов по выбранному фильтру нет.
          </div>
        ) : (
          <main className="grid gap-4 xl:grid-cols-2">
            {filteredOrders.map((order) => (
              <article
                key={order.id}
                className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70"
              >
                <div className="border-b border-slate-100 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {formatAdminDate(order.created_at)}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">
                        {order.customer_name || 'Без имени'}
                      </h2>
                      <p className="mt-1 text-sm font-medium text-slate-600">
                        {formatPhoneForDisplay(normalizePhone(order.customer_phone))}
                      </p>
                    </div>
                    <select
                      value={order.status}
                      onChange={(event) =>
                        void updateOrderStatus(order.id, event.target.value as AdminOrderStatus)
                      }
                      disabled={updatingOrderId === order.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:cursor-wait disabled:opacity-70"
                    >
                      {ADMIN_STATUS_OPTIONS.filter((status) => status.id !== 'all').map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Тип клиента
                      </dt>
                      <dd className="font-semibold text-slate-800">{order.client_type || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Тип заказа
                      </dt>
                      <dd className="font-semibold text-slate-800">{order.order_type || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Получение
                      </dt>
                      <dd className="font-semibold text-slate-800">
                        {order.receiving_type || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Статус
                      </dt>
                      <dd className="font-semibold text-slate-800">
                        {ADMIN_STATUS_LABELS[order.status]}
                      </dd>
                    </div>
                    {order.delivery_address && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Адрес доставки
                        </dt>
                        <dd className="font-semibold text-slate-800">
                          {order.delivery_address}
                        </dd>
                      </div>
                    )}
                    {order.comment && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Комментарий
                        </dt>
                        <dd className="font-semibold text-slate-800">{order.comment}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Общий вес
                      </p>
                      <p className="font-bold text-slate-900">
                        {formatVolumeLabel({} as Product, order.total_weight_kg)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Общая сумма
                      </p>
                      <p className="font-bold text-brand-800">
                        {formatCurrency(order.total_amount)}
                      </p>
                    </div>
                  </div>

                  <h3 className="mb-3 text-sm font-bold text-slate-800">Товары заказа</h3>
                  {order.items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      Позиции заказа не найдены.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{item.product_name}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {formatVolumeLabel({} as Product, item.quantity_kg)} ·{' '}
                                {formatCurrency(item.price_per_kg)}/кг
                              </p>
                            </div>
                            <p className="shrink-0 font-bold text-brand-800">
                              {formatCurrency(item.total_amount)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </main>
        )}
      </div>
    </div>
  )
}

export default function App() {
  if (window.location.pathname === '/admin') {
    return <AdminPage />
  }

  const today = useMemo(() => formatDateRu(new Date()), [])
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseFilterId>('all')
  const [onlyInStock, setOnlyInStock] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [isB2B, setIsB2B] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
  const [repeatedOrderId, setRepeatedOrderId] = useState<string | null>(null)
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const [analyticsOpenId, setAnalyticsOpenId] = useState<string | null>(null)
  const [cart, setCart] = useState<Cart>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(() =>
    createCheckoutForm(true),
  )
  const [checkoutErrors, setCheckoutErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({})
  const [checkoutSubmitError, setCheckoutSubmitError] = useState<string | null>(null)
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [lastOrder, setLastOrder] = useState<SavedOrder | null>(null)
  const [orderHistory, setOrderHistory] = useState<SavedOrder[]>([])
  const [showMyOrders, setShowMyOrders] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [volumes, setVolumes] = useState<Record<string, number>>(() =>
    Object.fromEntries(fallbackProducts.map((p) => [p.id, p.defaultVolume])),
  )

  const loadProducts = async () => {
    setProductsLoading(true)
    setProductsError(null)

    try {
      const nextProducts = await getProducts()
      setProducts(nextProducts)
    } catch (error) {
      setProducts([])
      setProductsError(getErrorMessage(error))
    } finally {
      setProductsLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    setVolumes((prev) => ({
      ...Object.fromEntries(
        products.map((product) => [
          product.id,
          getProductDisplayConfig(product, isB2B).defaultVolume,
        ]),
      ),
      ...prev,
    }))
  }, [isB2B, products])

  useEffect(() => {
    const storedLastOrder = localStorage.getItem(LOCAL_STORAGE_LAST_ORDER)
    const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY)

    if (storedLastOrder) {
      try {
        setLastOrder(JSON.parse(storedLastOrder))
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_LAST_ORDER)
      }
    }

    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory) as SavedOrder[]
        setOrderHistory(parsed.slice(-5).reverse())
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_HISTORY)
      }
    }

    const timeout = window.setTimeout(() => setIsLoading(false), 800)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    setVolumes(
      Object.fromEntries(
        products.map((product) => {
          const config = getProductDisplayConfig(product, isB2B)
          return [product.id, config.defaultVolume]
        }),
      ),
    )
    setCart((prev) =>
      Object.fromEntries(
        Object.entries(prev).flatMap(([productId, volume]) => {
          const product = products.find((p) => p.id === productId)
          const nextVolume = product ? snapVolume(volume, product, isB2B) : volume
          return nextVolume > 0 ? [[productId, nextVolume]] : []
        }),
      ),
    )
  }, [isB2B, products])

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const filteredProducts = useMemo(() => {
    const list = products.filter(
      (p) =>
        matchesTab(p, activeTab) &&
        matchesSearch(p, normalizedSearch) &&
        matchesWarehouse(p, warehouseFilter) &&
        matchesInStockOnly(p, onlyInStock),
    )
    return sortProducts(list, sortBy)
  }, [activeTab, normalizedSearch, warehouseFilter, onlyInStock, products, sortBy])

  const cartLines = useMemo(() => getCartLines(cart, products, isB2B), [cart, isB2B, products])
  const cartCount = cartLines.length
  const cartGrandTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.total, 0),
    [cartLines],
  )

  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    warehouseFilter !== 'all' ||
    onlyInStock ||
    sortBy !== 'default'

  const setProductVolume = (product: Product, raw: number) => {
    setVolumes((prev) => ({
      ...prev,
      [product.id]: snapVolume(raw, product, isB2B),
    }))
  }

  const addToCart = (product: Product) => {
    const stock = getAvailableStockKg(product)
    const minOrder = getMinimumOrderKg(isB2B)
    if (stock <= 0) {
      setCartError('Товара нет в наличии.')
      return
    }

    if (stock < minOrder) {
      setCartError(`Остаток меньше минимального заказа: минимум ${formatStockAmount(minOrder)}.`)
      return
    }

    const selected = volumes[product.id] ?? getProductDisplayConfig(product, isB2B).defaultVolume
    if (selected < minOrder) {
      setCartError(`Минимальный заказ: ${formatStockAmount(minOrder)}.`)
      return
    }

    setCartError(null)
    setCart((prev) => {
      const current = prev[product.id] ?? 0
      if (current >= stock) {
        setCartError(`В корзине уже выбран весь доступный остаток: ${formatStockAmount(stock)}.`)
        return prev
      }

      const nextVolume = Math.min(stock, current > 0 ? current + selected : selected)
      return {
        ...prev,
        [product.id]: snapVolume(nextVolume, product, isB2B),
      }
    })
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(null), 1500)
  }

  const removeFromCart = (productId: string) => {
    setCartError(null)
    setCart((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const handleRepeatOrder = (order: MockOrder) => {
    const product = products.find((p) => p.id === order.productId)
    if (!product) return

    setProductVolume(product, order.volume)
    setCart((prev) => ({
      ...prev,
      [product.id]: snapVolume(order.volume, product),
    }))
    setRepeatedOrderId(order.id)
    window.setTimeout(() => setRepeatedOrderId(null), 1800)
  }

  const toggleAnalytics = (productId: string) => {
    setAnalyticsOpenId((current) => (current === productId ? null : productId))
  }

  const clearCart = () => {
    setCartError(null)
    setCart({})
    setCheckoutOpen(false)
    setCheckoutErrors({})
    setCheckoutSubmitError(null)
  }

  const saveOrderToStorage = (order: SavedOrder) => {
    localStorage.setItem(LOCAL_STORAGE_LAST_ORDER, JSON.stringify(order))
    setLastOrder(order)
    const updatedHistory = [order, ...orderHistory].slice(0, 5)
    setOrderHistory(updatedHistory)
    localStorage.setItem(LOCAL_STORAGE_HISTORY, JSON.stringify(updatedHistory))
  }

  const updateCheckoutField = <Field extends keyof CheckoutForm>(
    field: Field,
    value: CheckoutForm[Field],
  ) => {
    setCheckoutForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'fulfillment' && value === 'pickup' ? { address: '' } : {}),
    }))
    setCheckoutErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      if (field === 'fulfillment') delete next.address
      return next
    })
    setCheckoutSubmitError(null)
  }

  const validateCheckoutForm = () => {
    const nextErrors: Partial<Record<keyof CheckoutForm, string>> = {}
    const normalizedPhone = normalizePhone(checkoutForm.phone)

    if (!checkoutForm.name.trim()) nextErrors.name = 'Укажите имя'
    if (!checkoutForm.phone.trim()) {
      nextErrors.phone = 'Укажите номер телефона'
    } else if (!isValidNormalizedPhone(normalizedPhone)) {
      nextErrors.phone = 'Введите номер Казахстана в формате +7 777 123 45 67'
    }
    if (!checkoutForm.customerType) nextErrors.customerType = 'Выберите тип клиента'
    if (!checkoutForm.orderType) nextErrors.orderType = 'Выберите тип заказа'
    if (!checkoutForm.fulfillment) nextErrors.fulfillment = 'Выберите способ получения'
    if (checkoutForm.fulfillment === 'delivery' && !checkoutForm.address.trim()) {
      nextErrors.address = 'Укажите адрес доставки'
    }

    setCheckoutErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleBookCart = () => {
    if (cartLines.length === 0) {
      setCartError('Корзина пуста. Добавьте товары перед оформлением заказа.')
      return
    }

    setCartError(null)
    setCheckoutErrors({})
    setCheckoutSubmitError(null)
    setCheckoutForm((prev) => ({
      ...prev,
      orderType: isB2B ? 'wholesale' : 'retail',
    }))
    setCheckoutOpen(true)
  }

  const saveCheckoutOrderToSupabase = async (normalizedPhone: string) => {
    const customerName = checkoutForm.name.trim()
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error('Введите корректный номер телефона перед сохранением заказа.')
    }

    const clientType = CUSTOMER_TYPE_LABELS[checkoutForm.customerType as CustomerType]
    const orderType = ORDER_TYPE_LABELS[checkoutForm.orderType as OrderType]
    const receivingType = FULFILLMENT_LABELS[checkoutForm.fulfillment as FulfillmentType]
    const deliveryAddress =
      checkoutForm.fulfillment === 'delivery' ? checkoutForm.address.trim() : null
    const comment = checkoutForm.comment.trim() || null
    const totalWeightKg = cartLines.reduce((sum, line) => sum + line.volume, 0)
    const updatedAt = new Date().toISOString()

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert(
        {
          name: customerName,
          phone: normalizedPhone,
          client_type: clientType,
          updated_at: updatedAt,
        },
        { onConflict: 'phone' },
      )
      .select('id')
      .single()

    if (clientError) throw new Error(`Не удалось сохранить клиента: ${clientError.message}`)
    if (!client?.id) throw new Error('Supabase не вернул ID клиента.')

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        client_id: client.id,
        customer_name: customerName,
        customer_phone: normalizedPhone,
        client_type: clientType,
        order_type: orderType,
        receiving_type: receivingType,
        delivery_address: deliveryAddress,
        comment,
        total_weight_kg: totalWeightKg,
        total_amount: cartGrandTotal,
        status: 'new',
      })
      .select('id')
      .single()

    if (orderError) throw new Error(`Не удалось сохранить заказ: ${orderError.message}`)
    if (!order?.id) throw new Error('Supabase не вернул ID заказа.')

    const orderItems = cartLines.map((line) => {
      const { pricePerKg } = calcPricing(line.product, line.volume, isB2B)

      return {
        order_id: order.id,
        product_id: getProductOrderItemId(line.product),
        product_name: line.product.name,
        quantity_kg: line.volume,
        price_per_kg: pricePerKg,
        total_amount: line.total,
      }
    })

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

    if (itemsError) throw new Error(`Не удалось сохранить товары заказа: ${itemsError.message}`)
  }

  const handleSubmitCheckout = async () => {
    if (isSubmittingOrder) return

    if (cartLines.length === 0) {
      setCheckoutOpen(false)
      setCartError('Корзина пуста. Добавьте товары перед оформлением заказа.')
      return
    }

    if (!validateCheckoutForm()) return

    const normalizedPhone = normalizePhone(checkoutForm.phone)
    if (!isValidNormalizedPhone(normalizedPhone)) {
      setCheckoutErrors((prev) => ({
        ...prev,
        phone: 'Введите номер Казахстана в формате +7 777 123 45 67',
      }))
      return
    }

    setCartError(null)
    setCheckoutSubmitError(null)
    setIsSubmittingOrder(true)

    try {
      await saveCheckoutOrderToSupabase(normalizedPhone)

      const whatsappUrl = getCartWhatsAppUrl(
        cartLines,
        cartGrandTotal,
        isB2B,
        checkoutForm,
        normalizedPhone,
      )
      const order: SavedOrder = {
        userName: checkoutForm.name.trim() || undefined,
        createdAt: new Date().toISOString(),
        items: cartLines.map((line) => ({
          productId: line.product.id,
          productName: line.product.name,
          volume: line.volume,
          volumeLabel: line.volumeLabel,
          total: line.total,
        })),
        total: cartGrandTotal,
        status: 'Отправлено в WhatsApp',
      }

      saveOrderToStorage(order)
      window.location.href = whatsappUrl
    } catch (error) {
      setCheckoutSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const handleRepeatLastOrder = () => {
    if (!lastOrder) return
    const nextCart: Cart = {}
    lastOrder.items.forEach((item) => {
      nextCart[item.productId] = item.volume
    })
    setCart(nextCart)
    setCartOpen(true)
  }

  return (
    <div className="min-h-dvh bg-slate-100 pb-24 lg:pb-10">
      <div className="relative border-b border-slate-200 bg-white shadow-sm">
        <header className="border-b border-brand-800/20 bg-brand-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white lg:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-100/80">
                URALSK VEG OPI
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
                ОПТ ОВОЩИ УРАЛЬСК
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
                aria-label={`Корзина: ${cartCount} позиций`}
              >
                <ShoppingCart className="h-5 w-5" strokeWidth={2} />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25D366] px-1 text-[10px] font-bold text-white shadow-md">
                    {cartCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
                aria-label="Личный кабинет"
              >
                <User className="h-5 w-5" strokeWidth={2} />
              </button>
              <Leaf className="h-9 w-9 text-brand-100" strokeWidth={1.5} aria-hidden />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-white/10 p-1 text-sm text-white sm:max-w-md" role="tablist" aria-label="Тип покупателя">
            <button
              type="button"
              onClick={() => setIsB2B(true)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isB2B
                  ? 'bg-emerald-50 text-brand-900 shadow-sm'
                  : 'text-white hover:bg-white/15'
              }`}
              role="tab"
              aria-selected={isB2B}
            >
              Оптовый
            </button>
            <button
              type="button"
              onClick={() => setIsB2B(false)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                !isB2B
                  ? 'bg-emerald-50 text-brand-900 shadow-sm'
                  : 'text-white hover:bg-white/15'
              }`}
              role="tab"
              aria-selected={!isB2B}
            >
              Розничный
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-brand-50">
            <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden />
            <span>Цены и остатки актуальны на сегодня — {today}</span>
          </div>
          </div>
        </header>

        <div className="bg-white px-3 py-3 lg:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск овощей..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
              aria-label="Поиск овощей"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                aria-label="Очистить поиск"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div
            className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50/90 p-2.5 md:flex md:items-center md:gap-3 md:space-y-0"
            aria-label="Расширенные фильтры"
          >
            <div className="flex items-center gap-2 md:min-w-[17rem]">
              <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value as WarehouseFilterId)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                aria-label="Фильтр по складу"
              >
                {WAREHOUSE_FILTERS.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:flex-1">
              <button
                type="button"
                onClick={() => setOnlyInStock((v) => !v)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                  onlyInStock
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                }`}
                aria-pressed={onlyInStock}
              >
                Только в наличии
              </button>

              <div className="flex min-w-0 flex-1 items-center gap-1.5 md:max-w-xs">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  aria-label="Сортировка по цене"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <nav className="mt-3" aria-label="Фильтр ассортимента">
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-brand-700 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
          </div>
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-[1400px] gap-6 px-3 pt-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
        {lastOrder && (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Рады видеть вас снова!</p>
                <p className="mt-1 text-sm text-emerald-900/80">
                  Повторить ваш прошлый заказ?
                </p>
              </div>
              <button
                type="button"
                onClick={handleRepeatLastOrder}
                className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800"
              >
                Повторить в 1 клик
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm text-emerald-950">
              {lastOrder.items.map((item) => (
                <p key={item.productId} className="leading-tight">
                  • {item.productName}: {item.volumeLabel}
                </p>
              ))}
            </div>
          </section>
        )}

        {productsError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900">
            <p>Не удалось загрузить товары из Supabase. {productsError}</p>
            <button
              type="button"
              onClick={loadProducts}
              className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700 active:scale-95"
            >
              Повторить
            </button>
          </div>
        )}

        {isLoading || productsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(4)].map((_, index) => (
              <ProductSkeleton key={index} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-slate-500">
            {normalizedSearch
              ? `По запросу «${searchQuery.trim()}» ничего не найдено.`
              : hasActiveFilters
                ? 'По выбранным фильтрам позиций нет. Измените склад, вкладку или снимите «Только в наличии».'
                : 'По выбранному фильтру позиций нет. Выберите другую вкладку.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
          const volume = volumes[product.id] ?? getProductDisplayConfig(product, isB2B).defaultVolume
          const { discount, pricePerKg, total } = calcPricing(product, volume, isB2B)
          const hasDiscount = discount > 0
          const inCart = product.id in cart
          const justAdded = addedProductId === product.id
          const stockDisplay = getStockDisplay(product)
          const cannotOrderProduct = !canOrderProduct(product, isB2B)
          const analyticsActionClass = 'bg-white text-emerald-700'
          const productTitle = product.image ? null : (
            <div className="px-5 pt-5">
              <p className="text-xs font-medium text-slate-500">{product.subtitle}</p>
              <h2 className="text-2xl font-bold text-slate-900">{product.name}</h2>
            </div>
          )

          return (
            <article
              key={product.id}
              className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70"
            >
              <div
                className={`group relative w-full overflow-hidden bg-slate-200 ${
                  product.image ? 'h-48' : 'h-28'
                }`}
              >
                {product.image ? (
                  <>
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-48 w-full object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-50 px-8 text-center text-sm font-semibold text-slate-500">
                    Фото товара скоро будет добавлено
                  </div>
                )}
                <div className={product.image ? 'absolute bottom-4 left-4 right-4' : 'sr-only'}>
                  <p className={`text-xs font-medium ${product.image ? 'text-white/90' : 'text-slate-600'}`}>
                    {product.subtitle}
                  </p>
                  <h2 className={`text-2xl font-bold ${product.image ? 'text-white' : 'text-slate-900'}`}>
                    {product.name}
                  </h2>
                </div>
                {inCart && (
                  <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                    В корзине
                  </span>
                )}
              </div>

              {productTitle}

              <div className="flex flex-1 flex-col space-y-4 p-5">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium ${statusToneClass[product.statusTone]}`}
                >
                  {product.statusText}
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Базовая цена
                    </p>
                    <p className="text-2xl font-bold text-brand-800">
                      {hasDiscount ? (
                        <>
                          <span className="mr-2 text-base font-normal text-slate-400 line-through">
                            {formatCurrency(product.basePrice)}/кг
                          </span>
                          {formatCurrency(pricePerKg)}/кг
                        </>
                      ) : (
                        <>{formatCurrency(pricePerKg)}/кг</>
                      )}
                    </p>
                  </div>
                  {hasDiscount && (
                    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">
                      −{discount.toFixed(1)}% опт
                    </span>
                  )}
                </div>

                <p className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Scale className="h-4 w-4 text-brand-600" aria-hidden />
                  {isB2B ? 'Минимальный заказ от 25 кг' : 'Можно заказать от 1 кг'}
                </p>
                {product.bookingNote && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
                    <Package className="h-4 w-4" aria-hidden />
                    {product.bookingNote}
                  </p>
                )}
                <p className="flex items-start gap-1.5 text-sm text-slate-600">
                  {product.availability === 'transit' ? (
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                  ) : (
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  )}
                  {product.location}
                </p>

                {product.trackSteps && product.trackCurrent !== undefined && (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <Truck className="h-5 w-5 text-sky-600" aria-hidden />
                      <span className="font-bold text-slate-800">Трек доставки</span>
                    </div>
                    <div className="space-y-3 border-l border-slate-200 pl-4">
                      {product.trackSteps.map((step, idx) => {
                        const isActive = idx === product.trackCurrent
                        const isCompleted = idx < product.trackCurrent!
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <span
                              className={`-ml-[23px] flex h-3.5 w-3.5 rounded-full ring-4 ring-slate-50 ${
                                isActive
                                  ? 'animate-pulse bg-emerald-500'
                                  : isCompleted
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-300'
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                isActive ? 'font-bold text-slate-800' : 'text-slate-600'
                              }`}
                            >
                              {step}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-950">
                  <button
                    type="button"
                    onClick={() => toggleAnalytics(product.id)}
                    className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold transition"
                  >
                    <span>{product.analyticsTitle}</span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${analyticsActionClass}`}>
                      {analyticsOpenId === product.id ? 'Скрыть' : 'Подробнее'}
                    </span>
                  </button>

                  {analyticsOpenId === product.id && (
                    <div className="mt-3 rounded-lg bg-white/60 p-3 text-sm leading-relaxed">
                      <p>{product.analyticsText}</p>
                    </div>
                  )}
                </div>

                <hr className="border-gray-100" />

                <div>
                  <QuantitySelector
                    product={product}
                    value={volume}
                    isB2B={isB2B}
                    onChange={(nextVolume) => setProductVolume(product, nextVolume)}
                  />
                  <p
                    className={`mt-4 text-center text-xl font-bold ${
                      hasDiscount ? 'text-emerald-700' : 'text-slate-800'
                    }`}
                  >
                    Итого за {formatVolumeLabel(product, volume, isB2B)}:{' '}
                    <span className="tabular-nums">{formatCurrency(total)}</span>
                  </p>
                  {hasDiscount && (
                    <p className="mt-1 text-center text-xs font-medium text-emerald-600">
                      Прогрессивный опт: выгода {discount.toFixed(1)}% от базовой цены
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={cannotOrderProduct}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-bold shadow-md transition active:scale-[0.98] hover:shadow-lg ${
                    cannotOrderProduct
                      ? 'cursor-not-allowed bg-slate-200 text-slate-500 shadow-none hover:shadow-md'
                      : justAdded
                      ? 'bg-emerald-700 text-white shadow-emerald-700/20'
                      : inCart
                        ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700'
                        : 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700'
                  }`}
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  <span className="sm:hidden">
                    {cannotOrderProduct
                      ? stockDisplay.stock <= 0
                        ? 'Нет в наличии'
                        : 'Недостаточно остатка'
                      : justAdded
                        ? 'Добавлено!'
                        : inCart
                          ? 'Добавить ещё в корзину'
                          : 'Добавить в корзину'}
                  </span>
                  <span className="hidden sm:inline">
                    {cannotOrderProduct
                      ? stockDisplay.stock <= 0
                        ? 'Нет в наличии'
                        : 'Недостаточно остатка'
                      : justAdded
                        ? 'Добавлено!'
                        : inCart
                          ? 'Добавить ещё'
                          : 'В корзину'}
                  </span>
                </button>
              </div>
            </article>
          )
          })}
          </div>
        )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-100 bg-brand-900 px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">
                    {isB2B ? 'Оптовая корзина' : 'Розничная корзина'}
                  </h3>
                  <p className="mt-0.5 text-xs text-brand-100">
                    {cartCount}{' '}
                    {cartCount === 1 ? 'позиция' : cartCount < 5 ? 'позиции' : 'позиций'}
                  </p>
                </div>
                <ShoppingCart className="h-6 w-6 text-brand-100" aria-hidden />
              </div>
            </div>

            <div className="max-h-[calc(100dvh-18rem)] overflow-y-auto px-5 py-4">
              {cartLines.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Добавьте овощи из каталога, и заказ появится здесь.
                </p>
              ) : (
                <ul className="space-y-3">
                  {cartLines.map((line) => (
                    <li
                      key={line.product.id}
                      className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      {line.product.image ? (
                        <img
                          src={line.product.image}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-200 px-2 text-center text-[10px] font-semibold leading-tight text-slate-500">
                          Фото скоро
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-800">{line.product.name}</p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(line.product.id)}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
                            aria-label={`Удалить ${line.product.name} из корзины`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600">{line.volumeLabel}</p>
                        <p className="mt-1 text-base font-bold tabular-nums text-brand-800">
                          {formatCurrency(line.total)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cartLines.length > 0 && (
              <div className="border-t border-slate-100 bg-white px-5 py-4">
                {cartError && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-900">
                    {cartError}
                    <a
                      href={getCartWhatsAppUrl(cartLines, cartGrandTotal, isB2B)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block font-bold text-amber-950 underline"
                    >
                      Открыть WhatsApp вручную
                    </a>
                  </div>
                )}
                <div className="mb-3 flex items-center justify-between gap-3 text-slate-800">
                  <span className="text-sm font-semibold">Итого</span>
                  <span className="text-lg font-bold tabular-nums text-brand-800">
                    {formatCurrency(cartGrandTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBookCart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] hover:bg-[#1ebe5d]"
                >
                  {isB2B ? 'Забронировать в WhatsApp' : 'Оформить в WhatsApp'}
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Очистить корзину
                </button>
              </div>
            )}
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pt-6 text-center text-xs text-slate-500 lg:px-6">
        Оптово-розничная витрина · Уральск, Казахстан · Цены в тенге
      </footer>

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-xl transition hover:bg-brand-800 active:scale-95 lg:hidden"
          aria-label={`Открыть корзину: ${cartCount} позиций`}
        >
          <ShoppingCart className="h-6 w-6" strokeWidth={2} />
          <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-xs font-bold shadow-md">
            {cartCount}
          </span>
        </button>
      )}

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-modal-title"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="flex max-h-[min(92dvh,720px)] w-full max-w-md animate-[slideUp_0.3s_ease-out] flex-col rounded-t-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden />
            <div className="flex items-start justify-between border-b border-slate-100 px-5 pb-4 pt-3">
              <div>
                <h3 id="cart-modal-title" className="text-lg font-bold text-brand-900">
                  {isB2B ? 'Ваш оптовый заказ' : 'Ваш розничный заказ'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {cartCount}{' '}
                  {cartCount === 1 ? 'позиция' : cartCount < 5 ? 'позиции' : 'позиций'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Очистить всё
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="Закрыть корзину"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartLines.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Корзина пуста. Добавьте овощи из каталога.
                </p>
              ) : (
                <ul className="space-y-3">
                  {cartLines.map((line) => (
                    <li
                      key={line.product.id}
                      className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      {line.product.image ? (
                        <img
                          src={line.product.image}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-200 px-2 text-center text-[10px] font-semibold leading-tight text-slate-500">
                          Фото скоро
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-800">{line.product.name}</p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(line.product.id)}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
                            aria-label={`Удалить ${line.product.name} из корзины`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600">{line.volumeLabel}</p>
                        <p className="mt-1 text-base font-bold tabular-nums text-brand-800">
                          {formatCurrency(line.total)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cartLines.length > 0 && (
              <div className="border-t border-slate-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
                {cartError && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-900">
                    {cartError}
                    <a
                      href={getCartWhatsAppUrl(cartLines, cartGrandTotal, isB2B)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block font-bold text-amber-950 underline"
                    >
                      Открыть WhatsApp вручную
                    </a>
                  </div>
                )}
                <p className="mb-3 text-center text-lg font-bold text-slate-800">
                  Итого к оплате:{' '}
                  <span className="tabular-nums text-brand-800">
                    {formatCurrency(cartGrandTotal)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleBookCart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] hover:bg-[#1ebe5d]"
                >
                  {isB2B ? 'Забронировать всё в WhatsApp' : 'Оформить заказ в WhatsApp'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-modal-title"
          onClick={() => {
            if (!isSubmittingOrder) setCheckoutOpen(false)
          }}
        >
          <form
            className="max-h-[min(92dvh,760px)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmitCheckout()
            }}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h3 id="checkout-modal-title" className="text-lg font-bold text-brand-900">
                  Оформление заказа
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Заполните данные, и мы соберём сообщение для WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                disabled={isSubmittingOrder}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                aria-label="Закрыть форму оформления"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Имя клиента</span>
                <input
                  type="text"
                  value={checkoutForm.name}
                  onChange={(e) => updateCheckoutField('name', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                  placeholder="Иван"
                />
                {checkoutErrors.name && (
                  <p className="mt-1 text-xs font-medium text-red-600">{checkoutErrors.name}</p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Номер телефона</span>
                <input
                  type="tel"
                  value={checkoutForm.phone}
                  onChange={(e) => updateCheckoutField('phone', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                  placeholder="+7 777 123 45 67"
                />
                {checkoutErrors.phone && (
                  <p className="mt-1 text-xs font-medium text-red-600">{checkoutErrors.phone}</p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Тип клиента</span>
                <select
                  value={checkoutForm.customerType}
                  onChange={(e) =>
                    updateCheckoutField('customerType', e.target.value as CheckoutForm['customerType'])
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="" disabled>Выберите тип клиента</option>
                  <option value="retail">Розница</option>
                  <option value="wholesale">Оптовик</option>
                  <option value="shop">Магазин</option>
                  <option value="cafe">Кафе</option>
                </select>
                {checkoutErrors.customerType && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {checkoutErrors.customerType}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Тип заказа</span>
                <select
                  value={checkoutForm.orderType}
                  onChange={(e) =>
                    updateCheckoutField('orderType', e.target.value as CheckoutForm['orderType'])
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="" disabled>Выберите тип заказа</option>
                  <option value="retail">Розничный</option>
                  <option value="wholesale">Оптовый</option>
                </select>
                {checkoutErrors.orderType && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {checkoutErrors.orderType}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Получение</span>
                <select
                  value={checkoutForm.fulfillment}
                  onChange={(e) =>
                    updateCheckoutField('fulfillment', e.target.value as CheckoutForm['fulfillment'])
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                >
                  <option value="" disabled>Выберите способ получения</option>
                  <option value="pickup">Самовывоз</option>
                  <option value="delivery">Доставка</option>
                </select>
                {checkoutErrors.fulfillment && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {checkoutErrors.fulfillment}
                  </p>
                )}
              </label>

              {checkoutForm.fulfillment === 'delivery' && (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Адрес доставки</span>
                  <input
                    type="text"
                    value={checkoutForm.address}
                    onChange={(e) => updateCheckoutField('address', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                    placeholder="Уральск, ул. Абая 10"
                  />
                  {checkoutErrors.address && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {checkoutErrors.address}
                    </p>
                  )}
                </label>
              )}

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Комментарий</span>
                <textarea
                  value={checkoutForm.comment}
                  onChange={(e) => updateCheckoutField('comment', e.target.value)}
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                  placeholder="Доставить после 18:00"
                />
              </label>
            </div>

            <div className="border-t border-slate-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              {checkoutSubmitError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {checkoutSubmitError}
                </div>
              )}
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">К оплате</span>
                <span className="text-lg font-bold tabular-nums text-brand-800">
                  {formatCurrency(cartGrandTotal)}
                </span>
              </div>
              <button
                type="submit"
                disabled={isSubmittingOrder}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] hover:bg-[#1ebe5d] disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
              >
                {isSubmittingOrder ? 'Сохраняем заказ...' : 'Отправить в WhatsApp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="max-h-[min(90dvh,640px)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h3 id="profile-modal-title" className="text-lg font-bold text-brand-900">
                  Личный кабинет покупателя
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Прототип · скоро полная авторизация</p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Статус авторизации
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Вход выполнен через WhatsApp: {PROFILE_PHONE}
                </p>
              </div>

              <section>
                <h4 className="mb-3 text-sm font-bold text-slate-800">История заказов</h4>
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-slate-800">Быстрые примеры</h5>
                  <button
                    type="button"
                    onClick={() => setShowMyOrders((s) => !s)}
                    className="text-xs text-brand-700"
                  >
                    {showMyOrders ? 'Скрыть мои заказы' : 'Показать мои заказы'}
                  </button>
                </div>
                <ul className="space-y-3">
                  {MOCK_ORDERS.map((order) => {
                    const product = products.find((p) => p.id === order.productId)
                    const volumeLabel = product
                      ? formatOrderVolume(product, order.volume)
                      : `${order.volume} кг`
                    const isRepeated = repeatedOrderId === order.id

                    return (
                      <li
                        key={order.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              Заказ №{order.id} от {order.date}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-600">
                              {order.productName} ({volumeLabel})
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${orderStatusClass[order.statusTone]}`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRepeatOrder(order)}
                          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition active:scale-[0.98] ${
                            isRepeated
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50'
                          }`}
                        >
                          <RotateCcw
                            className={`h-4 w-4 ${isRepeated ? 'animate-spin' : ''}`}
                            aria-hidden
                          />
                          {isRepeated ? 'Добавлено в корзину' : 'Повторить заказ'}
                        </button>
                      </li>
                    )
                    })}
                  </ul>

                  {showMyOrders && (
                    <div className="mt-4">
                      <h5 className="mb-2 text-sm font-semibold text-slate-800">Мои чеки</h5>
                      {orderHistory.length === 0 ? (
                        <p className="text-sm text-slate-500">Пока нет отправленных накладных.</p>
                      ) : (
                        <ul className="space-y-3">
                          {orderHistory.map((so, idx) => (
                            <li key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{formatDateRu(new Date(so.createdAt))}</p>
                                  <p className="mt-1 text-sm text-slate-600">{so.items.map(i => `${i.productName} (${i.volumeLabel})`).join(', ')}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-brand-800">{formatCurrency(so.total)}</p>
                                  <p className="text-xs text-slate-500">{so.status}</p>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
