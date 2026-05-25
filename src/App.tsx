import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import {
  ArrowUpDown,
  Archive,
  CalendarCheck,
  CheckCircle2,
  Download,
  Lock,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import { getErrorMessage, getProducts } from './services/products'
import type { Product } from './types/product'

const WHATSAPP_PHONE = '77774681889'
const LOCAL_STORAGE_ORDER_IDS = 'uralsk_veg_order_ids'
const LOCAL_STORAGE_CART = 'uralsk_veg_cart'
const CUSTOMER_COMMENT_MAX_LENGTH = 300
const DELIVERY_ADDRESS_MAX_LENGTH = 150
const STAFF_NOTE_MAX_LENGTH = 500
const CLIENT_NOTE_MAX_LENGTH = 500

type TabId = 'all' | 'warehouse' | 'transit'
type WarehouseFilterId = 'all' | 'warehouse1' | 'warehouse2'
type SortOption = 'default' | 'price-asc' | 'price-desc'
type OrderType = 'retail' | 'wholesale'
type FulfillmentType = 'pickup' | 'delivery'
type AdminOrderStatus = 'new' | 'processing' | 'completed' | 'cancelled'
type AdminStatusFilter = AdminOrderStatus | 'all'
type AdminTab = 'orders' | 'products' | 'clients'
type AdminReportStatusMode = AdminStatusFilter | 'active'
type ClientManualStatus = 'regular' | 'frequent' | 'vip'
type AdminPeriodPreset =
  | 'today'
  | 'last7'
  | 'last30'
  | 'current-month'
  | 'previous-month'
  | 'custom'
  | 'all'
type Cart = Record<string, number>
type ProductVolume = number | ''
type AdminRole = 'owner' | 'worker'

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
  staff_note?: string | null
  archived_at?: string | null
  created_at: string
  items: AdminOrderItem[]
}

interface CreateAdminOrderItem {
  productId: string
  quantity: number
}

interface CreateAdminOrderForm {
  customerName: string
  customerPhone: string
  orderType: OrderType
  fulfillment: FulfillmentType
  deliveryAddress: string
  comment: string
  staffNote: string
  items: CreateAdminOrderItem[]
}

interface AdminClient {
  id: string
  name: string
  phone: string
  client_type: string
  client_status?: ClientManualStatus | null
  client_note?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface AdminClientStats {
  orderCount: number
  totalAmount: number
  averageAmount: number
  lastOrderAt: string | null
}

interface AdminProfile {
  id: string
  email: string
  role: AdminRole
  created_at?: string | null
}

interface AdminProduct {
  id: string
  name: string
  variant: string
  category: string
  retail_price: number
  wholesale_price: number
  stock_amount: number
  unit: string
  status: string
  freshness: string
  location: string
  description: string
  origin: string
  in_stock: boolean
  is_in_transit: boolean
  delivery_eta: string
  image_url: string
  image?: string
  is_active: boolean
}

type NumericField = number | ''
type AdminProductForm = Omit<AdminProduct, 'id' | 'image'> & {
  retail_price: NumericField
  wholesale_price: NumericField
  stock_amount: NumericField
}

const LOCAL_STORAGE_LAST_ORDER = 'last_vegetable_order'
const LOCAL_STORAGE_HISTORY = 'order_history'
const RETAIL_MARKUP = 90
const RETAIL_MIN_ORDER_KG = 1
const WHOLESALE_MIN_ORDER_KG = 25
const QUANTITY_INPUT_MAX_LENGTH = 7

const CUSTOMER_TYPE_LABELS: Record<OrderType, string> = {
  retail: 'Розница',
  wholesale: 'Оптовик',
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  retail: 'Розничный',
  wholesale: 'Оптовый',
}

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  pickup: 'Самовывоз',
  delivery: 'Доставка',
}

const FULFILLMENT_OPTIONS: { value: FulfillmentType; label: string }[] = [
  { value: 'pickup', label: 'Самовывоз' },
  { value: 'delivery', label: 'Доставка' },
]

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

const CLIENT_MANUAL_STATUS_LABELS: Record<ClientManualStatus, string> = {
  regular: 'Обычный',
  frequent: 'Постоянный',
  vip: 'VIP',
}

const CLIENT_MANUAL_STATUS_OPTIONS: { id: ClientManualStatus; label: string }[] = [
  { id: 'regular', label: CLIENT_MANUAL_STATUS_LABELS.regular },
  { id: 'frequent', label: CLIENT_MANUAL_STATUS_LABELS.frequent },
  { id: 'vip', label: CLIENT_MANUAL_STATUS_LABELS.vip },
]

const ADMIN_PERIOD_OPTIONS: { id: AdminPeriodPreset; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'last7', label: '7 дней' },
  { id: 'last30', label: '30 дней' },
  { id: 'current-month', label: 'Этот месяц' },
  { id: 'previous-month', label: 'Прошлый месяц' },
  { id: 'custom', label: 'Выбрать даты' },
  { id: 'all', label: 'Все время' },
]

const REPORT_CLIENT_TYPE_OPTIONS = ['all', 'Розница', 'Оптовик'] as const
const REPORT_RECEIVING_TYPE_OPTIONS = ['all', 'Доставка', 'Самовывоз'] as const
const REPORT_STATUS_OPTIONS: { id: AdminReportStatusMode; label: string }[] = [
  { id: 'all', label: 'Все статусы' },
  { id: 'new', label: 'Только новые' },
  { id: 'processing', label: 'В работе' },
  { id: 'completed', label: 'Выполненные' },
  { id: 'cancelled', label: 'Отменённые' },
  { id: 'active', label: 'Новые + В работе' },
]

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: 'orders', label: 'Заказы' },
  { id: 'products', label: 'Товары' },
  { id: 'clients', label: 'Клиенты' },
]

const PRODUCT_IMAGE_BUCKET = 'product-images'
const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024
const PRODUCT_IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const emptyAdminProductForm: AdminProductForm = {
  name: '',
  variant: '',
  category: '',
  retail_price: 0,
  wholesale_price: 0,
  stock_amount: 0,
  unit: 'кг',
  status: '',
  freshness: '',
  location: '',
  description: '',
  origin: '',
  in_stock: true,
  is_in_transit: false,
  delivery_eta: '',
  image_url: '',
  is_active: true,
}

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
    analyticsTitle: '?? Аналитика рынка: цена стабильна',
    analyticsText: 'На рынке Уральска стабильный объем местного картофеля. В ближайшие 2 недели ценовых скачков не ожидается, запасы на складе в избытке.',
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
    analyticsTitle: '?? Скидки: сезонное снижение цены',
    analyticsText: 'Поступил крупный объем репчатого лука высокого качества. При закупке от 5 тонн действуют специальные оптовые условия.',
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
    analyticsTitle: '?? Прогноз: ожидается подорожание к концу недели',
    analyticsText: 'Из-за задержек крупных фур на КПП Маштаково прогнозируется временный дефицит свежей моркови. Рекомендуем зафиксировать объемы.',
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
    analyticsTitle: '?? Аналитика: высокий спрос',
    analyticsText: 'Тепличные томаты пользуются повышенным спросом перед выходными. Объемы на Складе №2 (Охлаждаемый) тают быстро, планируйте закуп заранее.',
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
    analyticsTitle: '?? Аналитика рынка: цена стабильна',
    analyticsText: 'Белокочанная капуста зафиксировалась в цене. Качество партии отличное, листы плотные, товар готов к длительной транспортировке.',
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
  { id: 'price-asc', label: 'По цене ^' },
  { id: 'price-desc', label: 'По цене v' },
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

function formatKg(value: number): string {
  return `${Number(value || 0).toLocaleString('ru-RU')} кг`
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

function getMaxOrderQuantityKg(product: Product): number | null {
  const stock = product.stock_amount ?? product.retailStockKg
  if (typeof stock !== 'number' || !Number.isFinite(stock) || stock <= 0) return null
  return stock
}

function getStockLimitError(product: Product): string {
  const maxQuantity = getMaxOrderQuantityKg(product) ?? getAvailableStockKg(product)
  return `На складе доступно только ${formatMoney(maxQuantity)} кг`
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
  if (product.in_stock === false && product.is_in_transit !== true) return false
  return getAvailableStockKg(product) >= getMinimumOrderKg(isB2B)
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
  const maxQuantity = getMaxOrderQuantityKg(product)
  const upperLimit = maxQuantity ?? sliderMax
  const clamped = Math.min(upperLimit, Math.max(sliderMin, value))
  const stepped =
    sliderMin + Math.round((clamped - sliderMin) / sliderStep) * sliderStep
  const decimals = sliderStep % 1 !== 0 ? 1 : 0
  return Number(stepped.toFixed(decimals))
}

function sanitizeQuantityInput(value: string): ProductVolume {
  const digits = value.replace(/\D/g, '').slice(0, QUANTITY_INPUT_MAX_LENGTH)
  if (!digits) return ''
  return Number(digits)
}

function getSafeProductVolume(value: ProductVolume, product: Product, isB2B: boolean): number {
  if (value === '' || !Number.isFinite(value) || value <= 0) {
    return getProductDisplayConfig(product, isB2B).defaultVolume
  }

  const maxQuantity = getMaxOrderQuantityKg(product)
  return maxQuantity ? Math.min(value, maxQuantity) : value
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

function normalizePhoneForSearch(value: string): string {
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

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''

  const normalizedDigits = digits.startsWith('8')
    ? `7${digits.slice(1)}`
    : digits.startsWith('7')
    ? digits
    : `7${digits}`
  const phone = normalizedDigits.slice(0, 11)
  const parts = [
    phone.slice(1, 4),
    phone.slice(4, 7),
    phone.slice(7, 9),
    phone.slice(9, 11),
  ].filter(Boolean)

  return `+${phone.slice(0, 1)}${parts.length > 0 ? ` ${parts.join(' ')}` : ''}`
}

function getSavedCart(): Cart {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CART)
    const parsed = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).flatMap(([productId, value]) => {
        const volume = toNumber(value)
        return productId.trim() && volume > 0 ? [[productId, volume]] : []
      }),
    )
  } catch {
    localStorage.removeItem(LOCAL_STORAGE_CART)
    return {}
  }
}

function saveCartToLocalStorage(cart: Cart) {
  if (Object.keys(cart).length === 0) {
    localStorage.removeItem(LOCAL_STORAGE_CART)
    return
  }

  localStorage.setItem(LOCAL_STORAGE_CART, JSON.stringify(cart))
}

function limitText(value: string, maxLength: number): string {
  return value.slice(0, maxLength)
}

function CharacterCounter({
  value,
  maxLength,
}: {
  value: string
  maxLength: number
}) {
  return (
    <p className="mt-1 text-right text-xs text-slate-400">
      {value.length} / {maxLength}
    </p>
  )
}

function getStoredOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDER_IDS)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.map((id) => String(id)).filter((id) => id.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function saveOrderIdToLocalStorage(orderId: string) {
  const nextIds = Array.from(new Set([...getStoredOrderIds(), String(orderId)]))
  localStorage.setItem(LOCAL_STORAGE_ORDER_IDS, JSON.stringify(nextIds))
}

function setStoredOrderIds(orderIds: string[]) {
  const nextIds = Array.from(new Set(orderIds.map((id) => String(id)).filter(Boolean)))
  localStorage.setItem(LOCAL_STORAGE_ORDER_IDS, JSON.stringify(nextIds))
}

function createCheckoutForm(isB2B: boolean): CheckoutForm {
  return {
    name: '',
    phone: '',
    orderType: isB2B ? 'wholesale' : 'retail',
    fulfillment: '',
    address: '',
    comment: '',
  }
}

interface CheckoutFormContentProps {
  checkoutStep: 'cart' | 'details'
  checkoutForm: CheckoutForm
  checkoutErrors: Partial<Record<keyof CheckoutForm, string>>
  checkoutSubmitError: string | null
  checkoutSuccessMessage: string | null
  isSubmittingOrder: boolean
  cartCount: number
  cartGrandTotal: number
  isB2B: boolean
  cartLines: CartLine[]
  onBack?: () => void
  updateCheckoutField: (field: keyof CheckoutForm, value: string) => void
}

function CheckoutFormContent({
  checkoutStep,
  checkoutForm,
  checkoutErrors,
  checkoutSubmitError,
  checkoutSuccessMessage,
  isSubmittingOrder,
  cartCount,
  cartGrandTotal,
  isB2B,
  cartLines,
  onBack,
  updateCheckoutField,
}: CheckoutFormContentProps) {
  const commentPlaceholder =
    checkoutForm.fulfillment === 'pickup'
      ? 'Например: заберу после 18:00'
      : 'Например: доставить после 18:00'

  return (
    <div className="space-y-4 px-5 pb-4 pt-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] sm:gap-4 sm:pb-6">
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {checkoutStep === 'details' ? 'Шаг 2 из 2' : 'Оформление заказа'}
            </p>
            <h3 className="mt-2 text-xl font-bold text-brand-900">Данные для WhatsApp</h3>
            <p className="mt-1 text-sm text-slate-500">
              Заполните контакты, чтобы мы могли отправить заказ напрямую в WhatsApp.
            </p>
          </div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ← Назад к корзине
            </button>
          )}
        </div>

        {checkoutSuccessMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {checkoutSuccessMessage}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Имя</span>
            <input
              type="text"
              value={checkoutForm.name}
              onChange={(e) => updateCheckoutField('name', e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
              placeholder="Иван"
            />
            {checkoutErrors.name && (
              <p className="mt-1 text-xs font-medium text-red-600">{checkoutErrors.name}</p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Телефон</span>
              <input
                type="tel"
                value={checkoutForm.phone}
                inputMode="tel"
                onChange={(e) => updateCheckoutField('phone', formatPhoneInput(e.target.value))}
                className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                placeholder="+7 700 000 00 00"
              />
            {checkoutErrors.phone && (
              <p className="mt-1 text-xs font-medium text-red-600">{checkoutErrors.phone}</p>
            )}
          </label>

          {/* Тип клиента и Тип заказа определяются автоматически по режиму сайта (isB2B) */}

          <div className="sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Получение</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {FULFILLMENT_OPTIONS.map((option) => {
                const selected = checkoutForm.fulfillment === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateCheckoutField('fulfillment', option.value)}
                    aria-pressed={selected}
                    className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition focus:outline-none ${
                      selected
                        ? 'border-brand-700 bg-brand-700 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {checkoutErrors.fulfillment && (
              <p className="mt-1 text-xs font-medium text-red-600">{checkoutErrors.fulfillment}</p>
            )}
          </div>

          {checkoutForm.fulfillment === 'delivery' && (
            <label className="sm:col-span-2 block">
              <span className="text-sm font-semibold text-slate-700">Адрес доставки</span>
              <input
                type="text"
                value={checkoutForm.address}
                maxLength={DELIVERY_ADDRESS_MAX_LENGTH}
                onChange={(e) =>
                  updateCheckoutField('address', limitText(e.target.value, DELIVERY_ADDRESS_MAX_LENGTH))
                }
                className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                placeholder="Уральск, ул. Абая 10"
              />
              <CharacterCounter value={checkoutForm.address} maxLength={DELIVERY_ADDRESS_MAX_LENGTH} />
              {checkoutErrors.address && (
                <p className="mt-1 text-xs font-medium text-red-600">{checkoutErrors.address}</p>
              )}
            </label>
          )}

          <label className="sm:col-span-2 block">
            <span className="text-sm font-semibold text-slate-700">Комментарий</span>
            <textarea
              value={checkoutForm.comment}
              maxLength={CUSTOMER_COMMENT_MAX_LENGTH}
              onChange={(e) =>
                updateCheckoutField('comment', limitText(e.target.value, CUSTOMER_COMMENT_MAX_LENGTH))
              }
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
              placeholder={commentPlaceholder}
            />
            <CharacterCounter value={checkoutForm.comment} maxLength={CUSTOMER_COMMENT_MAX_LENGTH} />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Сводка заказа</p>
          <p className="mt-2 text-sm text-slate-600">Проверьте сумму и добавьте комментарий перед отправкой.</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Позиции</span>
            <span>{cartCount}</span>
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
            <p className="flex items-center justify-between font-semibold text-slate-800">
              <span>Всего к оплате</span>
              <span className="tabular-nums">{formatCurrency(cartGrandTotal)}</span>
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {isB2B ? 'Для оптового заказа' : 'Для розничного заказа'} · {formatQuantityWhatsApp(cartLines.reduce((sum, line) => sum + line.volume, 0), isB2B)}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmittingOrder}
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-[#25D366] px-4 py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] hover:bg-[#1ebe5d] disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
        >
          {isSubmittingOrder ? 'Создаём заказ...' : 'Отправить в WhatsApp'}
        </button>

        {checkoutSubmitError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {checkoutSubmitError}
          </div>
        )}
      </div>
    </div>
  )
}

function formatOrderVolume(_product: Product, volume: number, _isB2B = true): string {
  return `${formatMoney(volume)} кг`
}

function calcPricing(product: Product, volume: number, isB2B = true) {
  const minQuantity = getMinimumOrderKg(isB2B)
  const maxQuantity = getMaxOrderQuantityKg(product)
  const safeVolume = Number.isFinite(volume) && volume > 0 ? volume : minQuantity
  const normalizedVolume = maxQuantity ? Math.min(safeVolume, maxQuantity) : safeVolume
  const weightKg = getWeightKg(product, normalizedVolume, isB2B)
  const { sliderMin, sliderMax } = getProductDisplayConfig(product, isB2B)
  const discount = isB2B
    ? getDiscountPercent(normalizedVolume, sliderMin, sliderMax)
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
        `Тип заказа: ${ORDER_TYPE_LABELS[isB2B ? 'wholesale' : 'retail']}`,
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

function CollapsibleText({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const shouldCollapse = text.length > 140 || text.split(/\r?\n/).length > 3

  return (
    <div>
      <p
        className={`${className} whitespace-pre-wrap break-words ${
          shouldCollapse && !expanded ? 'max-h-[4.8em] overflow-hidden' : ''
        }`}
      >
        {text}
      </p>
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-bold text-brand-700 transition hover:text-brand-900"
        >
          {expanded ? 'Скрыть' : 'Показать полностью'}
        </button>
      )}
    </div>
  )
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
  return product.availability === 'warehouse' && product.in_stock !== false
}

function matchesLowStock(product: Product, onlyLowStock: boolean): boolean {
  if (!onlyLowStock) return true
  const stock = getAvailableStockKg(product)
  return stock > 0 && stock <= 50
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
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">Количество</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{minHint}</p>
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

      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => commitValue(currentQuantity - step)}
          disabled={!canDecrease}
          className="flex h-11 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 active:scale-95"
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
            className="w-full bg-transparent text-center text-base font-bold tabular-nums text-emerald-800 outline-none disabled:text-slate-300"
            aria-label={`Количество ${product.name} в килограммах`}
          />
          <span className="ml-1 text-sm font-semibold text-slate-500">кг</span>
        </label>
        <button
          type="button"
          onClick={() => commitValue(currentQuantity + step)}
          disabled={!canIncrease}
          className="flex h-11 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 active:scale-95"
          aria-label={`Увеличить количество ${product.name}`}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {quickQuantities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickQuantities.map((quantity) => {
            const selected = currentQuantity === quantity
            return (
              <button
                key={quantity}
                type="button"
                onClick={() => commitValue(quantity)}
                aria-pressed={selected}
                className={`min-h-8 flex-1 basis-[4rem] rounded-lg border px-1.5 text-xs font-bold transition active:scale-[0.98] ${
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
      <div className="relative h-[250px] w-full overflow-hidden bg-slate-200 lg:h-52">
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

function normalizeClientTypeLabel(value: unknown): string {
  const rawValue = String(value ?? '').trim()
  const normalizedValue = rawValue.toLowerCase()

  if (normalizedValue === 'retail' || normalizedValue === CUSTOMER_TYPE_LABELS.retail.toLowerCase()) {
    return CUSTOMER_TYPE_LABELS.retail
  }

  return CUSTOMER_TYPE_LABELS.wholesale
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

function getDateInputStart(value: string): number | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function getDateInputEnd(value: string): number | null {
  if (!value) return null
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function getAdminPeriodRange(
  preset: AdminPeriodPreset,
  dateFrom: string,
  dateTo: string,
): { fromTime: number | null; toTime: number | null } {
  const today = new Date()

  if (preset === 'all') {
    return { fromTime: null, toTime: null }
  }

  if (preset === 'custom') {
    return {
      fromTime: getDateInputStart(dateFrom),
      toTime: getDateInputEnd(dateTo),
    }
  }

  if (preset === 'today') {
    return {
      fromTime: startOfDay(today).getTime(),
      toTime: endOfDay(today).getTime(),
    }
  }

  if (preset === 'last7' || preset === 'last30') {
    const days = preset === 'last7' ? 6 : 29
    const from = startOfDay(today)
    from.setDate(from.getDate() - days)
    return {
      fromTime: from.getTime(),
      toTime: endOfDay(today).getTime(),
    }
  }

  if (preset === 'current-month') {
    return {
      fromTime: new Date(today.getFullYear(), today.getMonth(), 1).getTime(),
      toTime: endOfDay(today).getTime(),
    }
  }

  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)

  return {
    fromTime: previousMonthStart.getTime(),
    toTime: previousMonthEnd.getTime(),
  }
}

function getAdminPeriodLabel(preset: AdminPeriodPreset, dateFrom: string, dateTo: string): string {
  if (preset === 'custom') {
    if (dateFrom && dateTo) return `${dateFrom} - ${dateTo}`
    if (dateFrom) return `с ${dateFrom}`
    if (dateTo) return `по ${dateTo}`
    return 'Выбрать даты'
  }

  return ADMIN_PERIOD_OPTIONS.find((option) => option.id === preset)?.label ?? 'Все время'
}

const REPORT_MONTH_NAMES = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const

function formatReportDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()}`
}

function getReportInputDate(value: string): Date | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatReportDateRange(from: Date, to: Date): string {
  return `${formatReportDate(from)}–${formatReportDate(to)}`
}

function getReportPeriodText(preset: AdminPeriodPreset, dateFrom: string, dateTo: string): string {
  const today = new Date()

  if (preset === 'all') {
    return 'Всё время'
  }

  if (preset === 'custom') {
    const from = getReportInputDate(dateFrom)
    const to = getReportInputDate(dateTo)
    if (from && to) return formatReportDateRange(from, to)
    if (from) return `с ${formatReportDate(from)}`
    if (to) return `по ${formatReportDate(to)}`
    return 'Выбранный период'
  }

  if (preset === 'today') {
    return `Сегодня — ${formatReportDate(today)}`
  }

  if (preset === 'last7' || preset === 'last30') {
    const days = preset === 'last7' ? 6 : 29
    const from = startOfDay(today)
    from.setDate(from.getDate() - days)
    const label = preset === 'last7' ? 'Последние 7 дней' : 'Последние 30 дней'
    return `${label} — ${formatReportDateRange(from, today)}`
  }

  if (preset === 'current-month') {
    return `Этот месяц — ${REPORT_MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`
  }

  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return `Прошлый месяц — ${REPORT_MONTH_NAMES[previousMonth.getMonth()]} ${previousMonth.getFullYear()}`
}

function getReportStatusLabel(statusMode: AdminReportStatusMode): string {
  return REPORT_STATUS_OPTIONS.find((option) => option.id === statusMode)?.label ?? 'Все статусы'
}

function getAdminStatusClass(status: AdminOrderStatus): string {
  const classes: Record<AdminOrderStatus, string> = {
    new: 'border-sky-200 bg-sky-50 text-sky-800',
    processing: 'border-amber-200 bg-amber-50 text-amber-800',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
  }

  return classes[status]
}

function getAdminClientStatus(stats: AdminClientStats): { label: string; className: string } {
  if (stats.orderCount >= 10 || stats.totalAmount >= 100_000) {
    return {
      label: 'VIP клиент',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    }
  }

  if (stats.orderCount >= 3) {
    return {
      label: 'Постоянный клиент',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    }
  }

  return {
    label: 'Новый клиент',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
  }
}

function normalizeClientManualStatus(value: unknown): ClientManualStatus {
  return value === 'frequent' || value === 'vip' || value === 'regular' ? value : 'regular'
}

function getClientManualStatusClass(status: ClientManualStatus): string {
  const classes: Record<ClientManualStatus, string> = {
    regular: 'border-slate-200 bg-slate-100 text-slate-700',
    frequent: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    vip: 'border-amber-200 bg-amber-50 text-amber-800',
  }

  return classes[status]
}

function toAdminProduct(row: Record<string, unknown>): AdminProduct {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    variant: typeof row.variant === 'string' ? row.variant : '',
    category: typeof row.category === 'string' ? row.category : '',
    retail_price: toNumber(row.retail_price),
    wholesale_price: toNumber(row.wholesale_price),
    stock_amount: toNumber(row.stock_amount),
    unit: typeof row.unit === 'string' && row.unit.trim() ? row.unit : 'кг',
    status: typeof row.status === 'string' ? row.status : '',
    freshness: typeof row.freshness === 'string' ? row.freshness : '',
    location: typeof row.location === 'string' ? row.location : '',
    description: typeof row.description === 'string' ? row.description : '',
    origin: typeof row.origin === 'string' ? row.origin : '',
    in_stock: row.in_stock === true,
    is_in_transit: row.is_in_transit === true,
    delivery_eta: typeof row.delivery_eta === 'string' ? row.delivery_eta : '',
    image_url: typeof row.image_url === 'string' ? row.image_url : '',
    image: typeof row.image === 'string' ? row.image : '',
    is_active: row.is_active !== false,
  }
}

function adminProductToForm(product: AdminProduct): AdminProductForm {
  return {
    name: product.name,
    variant: product.variant,
    category: product.category,
    retail_price: product.retail_price,
    wholesale_price: product.wholesale_price,
    stock_amount: product.stock_amount,
    unit: product.unit,
    status: product.status,
    freshness: product.freshness,
    location: product.location,
    description: product.description,
    origin: product.origin,
    in_stock: product.in_stock,
    is_in_transit: product.is_in_transit,
    delivery_eta: product.delivery_eta,
    image_url: product.image_url,
    is_active: product.is_active,
  }
}

function normalizeAdminProductNumber(value: number | string): number {
  if (value === '' || value === null || value === undefined) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildAdminProductPayload(form: AdminProductForm) {
  return {
    name: form.name.trim(),
    variant: form.variant.trim() || null,
    category: form.category.trim() || null,
    retail_price: normalizeAdminProductNumber(form.retail_price),
    wholesale_price: normalizeAdminProductNumber(form.wholesale_price),
    stock_amount: normalizeAdminProductNumber(form.stock_amount),
    unit: form.unit.trim() || 'кг',
    status: form.status.trim() || null,
    freshness: form.freshness.trim() || null,
    location: form.location.trim() || null,
    description: form.description.trim() || null,
    origin: form.origin.trim() || null,
    in_stock: form.in_stock,
    is_in_transit: form.is_in_transit,
    delivery_eta: form.delivery_eta.trim() || null,
    image_url: form.image_url.trim() || null,
    is_active: form.is_active,
  }
}

function ProductImage({
  src,
  alt,
  className,
  imgClassName = 'block h-full w-full object-contain object-center',
  fallbackClassName = 'text-sm font-semibold text-slate-500',
}: {
  src?: string | null
  alt: string
  className: string
  imgClassName?: string
  fallbackClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const hasImage = Boolean(src && !failed)

  return (
    <div className={className}>
      {hasImage ? (
        <img
          src={src ?? ''}
          alt={alt}
          className={imgClassName}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={`flex h-full items-center justify-center px-6 text-center ${fallbackClassName}`}>
          Фото товара скоро будет добавлено
        </div>
      )}
    </div>
  )
}

function getProductImageUploadPath(file: File, productId: string | null): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeProductId = (productId ?? 'new-product').replace(/[^a-z0-9_-]/gi, '-')
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  return `${safeProductId}/${uniqueName}`
}

function buildAdminOrderCopyText(order: AdminOrder): string {
  const productLines = order.items.map(
    (item) =>
      `- ${item.product_name}: ${formatVolumeLabel({} as Product, item.quantity_kg)} x ${formatCurrency(item.price_per_kg)} = ${formatCurrency(item.total_amount)}`,
  )

  return [
    'Заказ:',
    `Клиент: ${order.customer_name || '-'}`,
    `Телефон: ${formatPhoneForDisplay(normalizePhone(order.customer_phone))}`,
    `Тип клиента: ${normalizeClientTypeLabel(order.client_type)}`,
    `Тип заказа: ${order.order_type || '-'}`,
    `Получение: ${order.receiving_type || '-'}`,
    `Адрес: ${order.delivery_address ?? ''}`,
    `Комментарий: ${order.comment ?? ''}`,
    '',
    'Товары:',
    ...(productLines.length > 0 ? productLines : ['- Позиции заказа не найдены']),
    '',
    `Общий вес: ${formatVolumeLabel({} as Product, order.total_weight_kg)}`,
    `Общая сумма: ${formatCurrency(order.total_amount)}`,
    `Статус: ${ADMIN_STATUS_LABELS[order.status]}`,
  ].join('\n')
}

function AdminClientsPanel({
  canDeleteClients = false,
  canEditClientNotes = false,
  canEditClientStatus = false,
}: {
  canDeleteClients?: boolean
  canEditClientNotes?: boolean
  canEditClientStatus?: boolean
}) {
  const [clients, setClients] = useState<AdminClient[]>([])
  const [clientStats, setClientStats] = useState<Record<string, AdminClientStats>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingClientNoteId, setEditingClientNoteId] = useState<string | null>(null)
  const [clientNoteDraft, setClientNoteDraft] = useState('')
  const [savingClientNoteId, setSavingClientNoteId] = useState<string | null>(null)
  const [savingClientStatusId, setSavingClientStatusId] = useState<string | null>(null)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)

  const loadClients = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true })

      if (clientsError) throw clientsError

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, client_id, total_amount, created_at')

      if (ordersError) throw ordersError

      const nextStats: Record<string, AdminClientStats> = {}
      ;((ordersData ?? []) as Record<string, unknown>[]).forEach((order) => {
        if (!order.client_id) return
        const clientId = String(order.client_id)
        const current = nextStats[clientId] ?? {
          orderCount: 0,
          totalAmount: 0,
          averageAmount: 0,
          lastOrderAt: null,
        }
        const totalAmount = toNumber(order.total_amount)
        const createdAt = typeof order.created_at === 'string' ? order.created_at : null
        const currentLastTime = current.lastOrderAt ? new Date(current.lastOrderAt).getTime() : 0
        const nextLastTime = createdAt ? new Date(createdAt).getTime() : 0

        nextStats[clientId] = {
          orderCount: current.orderCount + 1,
          totalAmount: current.totalAmount + totalAmount,
          averageAmount: 0,
          lastOrderAt: nextLastTime > currentLastTime ? createdAt : current.lastOrderAt,
        }
      })

      Object.keys(nextStats).forEach((clientId) => {
        const stats = nextStats[clientId]
        nextStats[clientId] = {
          ...stats,
          averageAmount: stats.orderCount > 0 ? stats.totalAmount / stats.orderCount : 0,
        }
      })

      setClientStats(nextStats)
      setClients(
        ((clientsData ?? []) as Record<string, unknown>[]).map((client) => ({
          id: String(client.id),
          name: String(client.name ?? ''),
          phone: String(client.phone ?? ''),
          client_type: normalizeClientTypeLabel(client.client_type),
          client_status: normalizeClientManualStatus(client.client_status),
          client_note: typeof client.client_note === 'string' ? client.client_note : null,
          created_at: typeof client.created_at === 'string' ? client.created_at : null,
          updated_at: typeof client.updated_at === 'string' ? client.updated_at : null,
        })),
      )
    } catch (loadError) {
      setError(`Не удалось загрузить клиентов: ${getErrorMessage(loadError)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadClients()
  }, [])

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    const searchDigits = search.replace(/\D/g, '')
    const normalizedSearchPhone = normalizePhoneForSearch(search)
    if (!query) return clients

    return clients.filter((client) => {
      const clientPhoneDigits = client.phone.replace(/\D/g, '')
      const normalizedClientPhone = normalizePhoneForSearch(client.phone)
      const textMatch = [
        client.name,
        client.phone,
        formatPhoneForDisplay(normalizePhone(client.phone)),
        client.client_type,
        CLIENT_MANUAL_STATUS_LABELS[normalizeClientManualStatus(client.client_status)],
        client.client_note ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
      const phoneMatch =
        searchDigits.length > 0 &&
        (clientPhoneDigits.includes(searchDigits) ||
          normalizedClientPhone.includes(normalizedSearchPhone) ||
          normalizedSearchPhone.includes(normalizedClientPhone) ||
          normalizedClientPhone.endsWith(searchDigits) ||
          clientPhoneDigits.endsWith(searchDigits))

      return textMatch || phoneMatch
    })
  }, [clients, search])

  const startEditClientNote = (client: AdminClient) => {
    if (!canEditClientNotes) {
      setError('Нет доступа к редактированию заметки клиента.')
      return
    }

    setEditingClientNoteId(client.id)
    setClientNoteDraft(client.client_note ?? '')
    setError(null)
  }

  const cancelEditClientNote = () => {
    setEditingClientNoteId(null)
    setClientNoteDraft('')
  }

  const saveClientNote = async (clientId: string) => {
    if (!canEditClientNotes) {
      setError('Нет доступа к редактированию заметки клиента.')
      return
    }

    setSavingClientNoteId(clientId)
    setError(null)

    try {
      const nextNote = limitText(clientNoteDraft.trim(), CLIENT_NOTE_MAX_LENGTH) || null
      const { error: updateError } = await supabase
        .from('clients')
        .update({ client_note: nextNote })
        .eq('id', clientId)

      if (updateError) throw updateError

      setClients((prev) =>
        prev.map((client) =>
          client.id === clientId ? { ...client, client_note: nextNote } : client,
        ),
      )
      setEditingClientNoteId(null)
      setClientNoteDraft('')
    } catch (saveError) {
      setError(`Не удалось сохранить заметку клиента: ${getErrorMessage(saveError)}`)
    } finally {
      setSavingClientNoteId(null)
    }
  }

  const changeClientStatus = async (client: AdminClient, nextStatus: ClientManualStatus) => {
    if (!canEditClientStatus) {
      setError('Нет доступа к изменению статуса клиента.')
      return
    }

    if (normalizeClientManualStatus(client.client_status) === nextStatus) return

    setSavingClientStatusId(client.id)
    setError(null)

    try {
      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update({ client_status: nextStatus })
        .eq('id', client.id)
        .select('id, client_status')
        .maybeSingle()

      if (updateError) throw updateError
      if (!updatedClient?.id) throw new Error('Client status was not updated')

      const normalizedStatus = normalizeClientManualStatus(updatedClient.client_status)
      setClients((prev) =>
        prev.map((item) =>
          item.id === client.id ? { ...item, client_status: normalizedStatus } : item,
        ),
      )
    } catch (statusError) {
      console.error('Failed to change client status:', statusError)
      setError('Не удалось изменить статус клиента')
    } finally {
      setSavingClientStatusId(null)
    }
  }

  const deleteClient = async (client: AdminClient) => {
    if (!canDeleteClients) {
      setError('Нет доступа к удалению клиентов.')
      return
    }

    const confirmed = window.confirm('Удалить клиента? Это действие нельзя отменить.')
    if (!confirmed) return

    setDeletingClientId(client.id)
    setError(null)

    try {
      const { data: deletedClient, error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id)
        .select('id')
        .maybeSingle()

      if (deleteError) throw deleteError
      if (!deletedClient?.id) throw new Error('Client was not deleted')

      setClients((prev) => prev.filter((item) => item.id !== client.id))
      setClientStats((prev) => {
        const next = { ...prev }
        delete next[client.id]
        return next
      })
    } catch (deleteError) {
      console.error('Failed to delete client:', deleteError)
      setError('Не удалось удалить клиента')
    } finally {
      setDeletingClientId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-brand-900 p-4 text-white shadow-xl shadow-slate-200/70 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100/80">
              URALSK VEG OPI
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Клиенты</h1>
            <p className="mt-1 text-sm text-brand-100">
              Статусы клиентов только для подсказки. Скидки и бонусы не применяются автоматически.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadClients()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </button>
        </div>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по имени, телефону, типу или заметке..."
            className="h-11 w-full rounded-xl border border-white/20 bg-white/10 py-2 pl-10 pr-3 text-sm font-semibold text-white outline-none placeholder:text-white/60 focus:ring-2 focus:ring-white/30"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-lg shadow-slate-200/60">
          Загружаем клиентов...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-lg shadow-slate-200/60">
          Клиенты не найдены.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredClients.map((client) => {
            const stats = clientStats[client.id] ?? {
              orderCount: 0,
              totalAmount: 0,
              averageAmount: 0,
              lastOrderAt: null,
            }
            const status = getAdminClientStatus(stats)
            const manualStatus = normalizeClientManualStatus(client.client_status)
            const normalizedPhone = normalizePhone(client.phone)
            const whatsappText = encodeURIComponent('Здравствуйте! Это URALSK VEG OPI по вашему заказу.')
            const hasNoOrders = stats.orderCount === 0

            return (
              <article key={client.id} className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {normalizeClientTypeLabel(client.client_type)}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {client.name || 'Без имени'}
                    </h2>
                    <a
                      href={`https://wa.me/${normalizedPhone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-sm font-bold text-brand-700 hover:underline"
                    >
                      {formatPhoneForDisplay(normalizedPhone)}
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getClientManualStatusClass(
                        manualStatus,
                      )}`}
                    >
                      Статус: {CLIENT_MANUAL_STATUS_LABELS[manualStatus]}
                    </span>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}>
                      Подсказка сайта: {status.label}
                    </span>
                    {hasNoOrders && (
                      <span className="w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        Нет заказов
                      </span>
                    )}
                  </div>
                </div>

                {canEditClientStatus && (
                  <label className="mt-4 block max-w-xs">
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      Статус клиента
                    </span>
                    <select
                      value={manualStatus}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                        void changeClientStatus(client, event.target.value as ClientManualStatus)
                      }
                      disabled={savingClientStatusId === client.id}
                      className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {CLIENT_MANUAL_STATUS_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase text-slate-400">Заказов</dt>
                    <dd className="font-bold text-slate-900">{stats.orderCount}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase text-slate-400">Общая сумма</dt>
                    <dd className="font-bold text-brand-800">{formatCurrency(stats.totalAmount)}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase text-slate-400">Средний чек</dt>
                    <dd className="font-bold text-slate-900">{formatCurrency(stats.averageAmount)}</dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <dt className="text-xs font-semibold uppercase text-slate-400">Последний заказ</dt>
                    <dd className="font-bold text-slate-900">
                      {stats.lastOrderAt ? formatAdminDate(stats.lastOrderAt) : '-'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Заметка работника</h3>
                    {canEditClientNotes && editingClientNoteId !== client.id && (
                      <button
                        type="button"
                        onClick={() => startEditClientNote(client)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                      >
                        {client.client_note ? 'Редактировать заметку' : 'Добавить заметку'}
                      </button>
                    )}
                  </div>

                  {editingClientNoteId === client.id ? (
                    <div className="mt-3">
                      <textarea
                        value={clientNoteDraft}
                        maxLength={CLIENT_NOTE_MAX_LENGTH}
                        onChange={(event) =>
                          setClientNoteDraft(limitText(event.target.value, CLIENT_NOTE_MAX_LENGTH))
                        }
                        rows={4}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                        placeholder="Например: часто берёт картофель"
                      />
                      <CharacterCounter value={clientNoteDraft} maxLength={CLIENT_NOTE_MAX_LENGTH} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveClientNote(client.id)}
                          disabled={savingClientNoteId === client.id}
                          className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70"
                        >
                          {savingClientNoteId === client.id ? 'Сохраняем...' : 'Сохранить'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditClientNote}
                          disabled={savingClientNoteId === client.id}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : client.client_note ? (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white px-3 py-3 text-sm font-medium leading-relaxed text-slate-700">
                      {client.client_note}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Заметки пока нет.</p>
                  )}
                </div>

                <a
                  href={`https://wa.me/${normalizedPhone}?text=${whatsappText}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1ebe5d] sm:w-auto"
                >
                  WhatsApp
                </a>
                {canDeleteClients ? (
                  <button
                    type="button"
                    onClick={() => void deleteClient(client)}
                    disabled={deletingClientId === client.id}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-70 sm:ml-2 sm:mt-4 sm:w-auto"
                  >
                    {deletingClientId === client.id ? 'Удаляем...' : 'Удалить клиента'}
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function AdminProductsPanel({ canManageProducts = true }: { canManageProducts?: boolean }) {
  const productFormRef = useRef<HTMLFormElement | null>(null)
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [onlyInStock, setOnlyInStock] = useState(false)
  const [onlyTransit, setOnlyTransit] = useState(false)
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminProductForm>(emptyAdminProductForm)
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<string | null>(null)
  const [quickUpdatingProductId, setQuickUpdatingProductId] = useState<string | null>(null)

  const resetProductForm = () => {
    setForm(emptyAdminProductForm)
    setEditingId(null)
    setFormMode(null)
  }

  const scrollToProductForm = () => {
    window.setTimeout(() => {
      productFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 0)
  }

  const loadProducts = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (productsError) throw productsError
      setProducts((data ?? []).map((row) => toAdminProduct(row)))
    } catch (loadError) {
      setError(`Не удалось загрузить товары: ${getErrorMessage(loadError)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  )
  const lowStockCount = useMemo(
    () => products.filter((product) => (product.stock_amount ?? 0) <= 50).length,
    [products],
  )

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return products.filter((product) => {
      if (categoryFilter !== 'all' && product.category !== categoryFilter) return false
      if (onlyInStock && !product.in_stock) return false
      if (onlyTransit && !product.is_in_transit) return false
      if (onlyLowStock && (product.stock_amount ?? 0) > 50) return false
      if (!query) return true

      return [
        product.name,
        product.variant,
        product.category,
        product.description,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [categoryFilter, onlyInStock, onlyLowStock, onlyTransit, products, search])

  const startCreate = () => {
    if (!canManageProducts) return

    setForm(emptyAdminProductForm)
    setEditingId(null)
    setFormMode('create')
    setError(null)
    setSuccess(null)
    scrollToProductForm()
  }

  const startEdit = (product: AdminProduct) => {
    if (!canManageProducts) return

    setForm(adminProductToForm(product))
    setEditingId(product.id)
    setFormMode('edit')
    setError(null)
    setSuccess(null)
    scrollToProductForm()
  }

  const updateForm = <K extends keyof AdminProductForm>(key: K, value: AdminProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  type AdminProductNumericKey = 'retail_price' | 'wholesale_price' | 'stock_amount'

  const clearZeroNumericField = (key: AdminProductNumericKey) => {
    const value = form[key] as NumericField
    if (value === 0) {
      updateForm(key, '' as unknown as AdminProductForm[typeof key])
    }
  }

  const restoreZeroNumericField = (key: AdminProductNumericKey) => {
    if ((form[key] as NumericField) === '') {
      updateForm(key, 0 as AdminProductForm[typeof key])
    }
  }

  const updateNumericField = (key: AdminProductNumericKey, value: NumericField) => {
    updateForm(key, value as AdminProductForm[typeof key])
  }

  const saveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageProducts) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      if (!form.name.trim()) {
        setError('Введите название товара.')
        return
      }

      console.log('Saving product form image_url:', form.image_url)
      const payload = buildAdminProductPayload(form)

      if (formMode === 'edit' && editingId) {
        const { data, error: updateError } = await supabase
          .from('products')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .select('*')

        if (updateError) throw updateError
        const updatedProduct = data?.[0] ? toAdminProduct(data[0]) : { id: editingId, image: '', ...form }
        setProducts((prev) =>
          prev.map((product) => (product.id === editingId ? updatedProduct : product)),
        )
        setSuccess('Товар сохранён.')
      } else {
        const { data, error: insertError } = await supabase
          .from('products')
          .insert(payload)
          .select('*')

        if (insertError) throw insertError
        const createdProducts = (data ?? []).map((row) => toAdminProduct(row))
        setProducts((prev) => [...createdProducts, ...prev])
        setSuccess('Товар добавлен.')
      }

      resetProductForm()
    } catch (saveError) {
      setError(`Не удалось сохранить товар: ${getErrorMessage(saveError)}`)
    } finally {
      setSaving(false)
    }
  }

  const uploadProductImage = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canManageProducts) return

    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploadingPhoto(true)
    setError(null)
    setSuccess(null)

    try {
      if (!PRODUCT_IMAGE_ALLOWED_TYPES.includes(file.type)) {
        setError('Фото должно быть в формате JPG, PNG или WebP.')
        return
      }

      if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
        setError('Фото слишком большое. Максимальный размер для админки: 5 MB.')
        return
      }

      const path = getProductImageUploadPath(file, editingId)
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .getPublicUrl(path)
      const publicUrl = publicUrlData.publicUrl
      console.log('Uploaded product image URL:', publicUrl)
      console.log('Current editing product id:', editingId)

      if (editingId) {
        const { error: imageUpdateError } = await supabase
          .from('products')
          .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', editingId)

        if (imageUpdateError) {
          console.error('Failed to save image_url:', imageUpdateError)
          setError(`Фото загружено, но ссылка не сохранилась: ${imageUpdateError.message}`)
          return
        }

        const { data: checkedProduct, error: checkError } = await supabase
          .from('products')
          .select('id, image_url')
          .eq('id', editingId)
          .maybeSingle()

        console.log('Checked product image_url after update:', checkedProduct, checkError)

        if (checkError) {
          setError(`Не удалось проверить image_url: ${checkError.message}`)
          return
        }

        if (!checkedProduct?.image_url) {
          setError(
            'Фото загружено, но image_url не записался в Supabase. Проверь RLS policy для products update.',
          )
          return
        }

        setForm((prev) => ({
          ...prev,
          image_url: checkedProduct.image_url,
        }))

        setProducts((prev) =>
          prev.map((product) =>
            product.id === editingId
              ? { ...product, image_url: checkedProduct.image_url }
              : product,
          ),
        )
        setSuccess('Фото загружено, image_url товара обновлён.')
      } else {
        setForm((prev) => ({
          ...prev,
          image_url: publicUrl,
        }))
        setSuccess('Фото загружено. Сохраните товар, чтобы записать image_url в каталог.')
      }
    } catch (uploadError) {
      setError(`Не удалось загрузить фото: ${getErrorMessage(uploadError)}`)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const toggleProductActive = async (product: AdminProduct) => {
    if (!canManageProducts) return

    setVisibilityUpdatingId(product.id)
    setError(null)
    setSuccess(null)

    try {
      const nextActive = !product.is_active
      const { data, error: updateError } = await supabase
        .from('products')
        .update({ is_active: nextActive })
        .eq('id', product.id)
        .select('*')

      if (updateError) throw updateError

      const updatedProduct = data?.[0]
        ? toAdminProduct(data[0])
        : { ...product, is_active: nextActive }
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? updatedProduct : item)),
      )
      setSuccess(nextActive ? 'Товар показан на витрине.' : 'Товар скрыт с витрины.')
    } catch (visibilityError) {
      setError(`Не удалось изменить видимость товара: ${getErrorMessage(visibilityError)}`)
    } finally {
      setVisibilityUpdatingId(null)
    }
  }

  const applyQuickProductUpdate = async (
    product: AdminProduct,
    patch: Partial<Pick<AdminProduct, 'stock_amount' | 'in_stock' | 'is_in_transit'>>,
    message: string,
  ) => {
    if (!canManageProducts) return

    setQuickUpdatingProductId(product.id)
    setError(null)
    setSuccess(null)

    try {
      const { data, error: updateError } = await supabase
        .from('products')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', product.id)
        .select('*')

      if (updateError) throw updateError

      const updatedProduct = data?.[0] ? toAdminProduct(data[0]) : { ...product, ...patch }
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? updatedProduct : item)),
      )
      if (editingId === product.id) {
        setForm(adminProductToForm(updatedProduct))
      }
      setSuccess(message)
    } catch (quickUpdateError) {
      setError(`Не удалось быстро обновить товар: ${getErrorMessage(quickUpdateError)}`)
    } finally {
      setQuickUpdatingProductId(null)
    }
  }

  const adjustProductStock = (product: AdminProduct, delta: number) => {
    const nextStock = Math.max(0, product.stock_amount + delta)
    void applyQuickProductUpdate(
      product,
      { stock_amount: nextStock },
      `Остаток товара «${product.name}» обновлён: ${nextStock} ${product.unit || 'кг'}.`,
    )
  }

  const toggleProductStockStatus = (product: AdminProduct) => {
    const nextInStock = !product.in_stock
    void applyQuickProductUpdate(
      product,
      { in_stock: nextInStock },
      nextInStock ? 'Товар отмечен как в наличии.' : 'Товар отмечен как нет в наличии.',
    )
  }

  const toggleProductTransitStatus = (product: AdminProduct) => {
    const nextInTransit = !product.is_in_transit
    void applyQuickProductUpdate(
      product,
      { is_in_transit: nextInTransit },
      nextInTransit ? 'Товар отмечен как в пути.' : 'Товар отмечен как не в пути.',
    )
  }

  const textInputClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20'
  const quickButtonClass =
    'min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60'

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-white p-4 shadow-xl shadow-slate-200/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Товары</h2>
            <p className="mt-1 text-sm text-slate-500">Каталог из Supabase · без физического удаления</p>
            <p className="mt-1 text-xs font-semibold text-amber-700">Мало остатка: {lowStockCount}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadProducts}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
            {canManageProducts && (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
            >
              <Plus className="h-4 w-4" />
              Добавить товар
            </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(18rem,1fr)_12rem_9rem_8rem_9rem]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию, варианту, категории, описанию..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          >
            <option value="all">Все категории</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={onlyInStock}
              onChange={(event) => setOnlyInStock(event.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            В наличии
          </label>
          <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={onlyTransit}
              onChange={(event) => setOnlyTransit(event.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            В пути
          </label>
          <label className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(event) => setOnlyLowStock(event.target.checked)}
              className="h-4 w-4 accent-amber-600"
            />
            Мало остатка
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {canManageProducts && formMode && (
        <form
          ref={productFormRef}
          onSubmit={saveProduct}
          className="scroll-mt-24 rounded-3xl bg-white p-4 shadow-xl shadow-slate-200/70"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">
              {formMode === 'create' ? 'Добавить товар' : 'Редактировать товар'}
            </h3>
            <button
              type="button"
              onClick={resetProductForm}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              Закрыть
            </button>
          </div>
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-bold text-slate-900">Основное</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Название</span>
                  <input className={textInputClass} value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Вариант / сорт / фасовка</span>
                  <input className={textInputClass} value={form.variant} onChange={(e) => updateForm('variant', e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Категория</span>
                  <input className={textInputClass} value={form.category} onChange={(e) => updateForm('category', e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Откуда товар</span>
                  <input className={textInputClass} value={form.origin} onChange={(e) => updateForm('origin', e.target.value)} />
                </label>
              </div>
            </section>

            <h2 className="mt-4 mb-2 text-lg font-semibold text-slate-900 lg:mt-6 lg:hidden">Все товары</h2>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-bold text-slate-900">Цены и остатки</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Розничная цена</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    step={1}
                    className={textInputClass}
                    value={form.retail_price}
                    onFocus={() => clearZeroNumericField('retail_price')}
                    onBlur={() => restoreZeroNumericField('retail_price')}
                    onChange={(e) =>
                      updateNumericField(
                        'retail_price',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Оптовая цена</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    step={1}
                    className={textInputClass}
                    value={form.wholesale_price}
                    onFocus={() => clearZeroNumericField('wholesale_price')}
                    onBlur={() => restoreZeroNumericField('wholesale_price')}
                    onChange={(e) =>
                      updateNumericField(
                        'wholesale_price',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Остаток</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    step={1}
                    className={textInputClass}
                    value={form.stock_amount}
                    onFocus={() => clearZeroNumericField('stock_amount')}
                    onBlur={() => restoreZeroNumericField('stock_amount')}
                    onChange={(e) =>
                      updateNumericField(
                        'stock_amount',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Единица</span>
                  <input className={textInputClass} value={form.unit} onChange={(e) => updateForm('unit', e.target.value)} />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-bold text-slate-900">Статус и поставка</h4>
              <div className="mt-3 grid gap-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={form.in_stock} onChange={(e) => updateForm('in_stock', e.target.checked)} className="h-4 w-4 accent-brand-700" />
                    В наличии
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={form.is_in_transit} onChange={(e) => updateForm('is_in_transit', e.target.checked)} className="h-4 w-4 accent-brand-700" />
                    В пути
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => updateForm('is_active', e.target.checked)} className="h-4 w-4 accent-brand-700" />
                    Показывать на витрине
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Статус</span>
                    <input className={textInputClass} value={form.status} onChange={(e) => updateForm('status', e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Свежесть</span>
                    <input className={textInputClass} value={form.freshness} onChange={(e) => updateForm('freshness', e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Локация</span>
                    <input className={textInputClass} value={form.location} onChange={(e) => updateForm('location', e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Ожидаемая поставка</span>
                    <input className={textInputClass} value={form.delivery_eta} onChange={(e) => updateForm('delivery_eta', e.target.value)} />
                    {form.is_in_transit && (
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Этот текст увидит клиент в блоке Товар в пути.
                      </p>
                    )}
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-bold text-slate-900">Фото</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_260px]">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Ссылка на фото</span>
                  <input className={textInputClass} value={form.image_url} onChange={(e) => updateForm('image_url', e.target.value)} />
                </label>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <span className="text-sm font-semibold text-slate-700">Фото товара</span>
                  <label className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-sm font-bold text-brand-800 transition hover:bg-brand-50">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => void uploadProductImage(event)}
                      disabled={uploadingPhoto}
                      className="sr-only"
                    />
                    {uploadingPhoto ? 'Загружаем фото...' : 'Загрузить JPG/PNG/WebP'}
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    Рекомендуемый размер до 5 MB. Старое фото не удаляется из Storage.
                  </p>
                  {form.image_url && (
                    <img
                      src={form.image_url}
                      alt="Превью товара"
                      className="mt-3 h-32 w-full rounded-xl object-cover"
                    />
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-bold text-slate-900">Описание</h4>
              <label className="mt-3 block">
                <span className="text-sm font-semibold text-slate-700">Описание товара</span>
                <textarea className={`${textInputClass} min-h-28`} value={form.description} onChange={(e) => updateForm('description', e.target.value)} />
              </label>
              <button
                type="submit"
                disabled={saving || uploadingPhoto}
                className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-base font-bold text-white transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:text-sm"
              >
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </section>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-lg shadow-slate-200/60">
          Загружаем товары...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-lg shadow-slate-200/60">
          Товаров по выбранным фильтрам нет.
        </div>
      ) : (
        <main className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const productImage = product.image_url || product.image
            const isQuickUpdating = quickUpdatingProductId === product.id
            const isLowStock = (product.stock_amount ?? 0) <= 50

            return (
              <article key={product.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
                <ProductImage
                  src={productImage}
                  alt={product.name}
                  className="h-40 w-full overflow-hidden bg-slate-100 sm:h-44"
                  fallbackClassName="text-sm font-bold text-slate-400"
                />
                  <div className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {product.category || 'Без категории'}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">{product.name}</h3>
                        {product.variant && <p className="text-sm font-semibold text-slate-500">{product.variant}</p>}
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${product.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        {product.is_active ? 'Показан' : 'Скрыт'}
                      </span>
                      {isLowStock && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                          Мало остатка
                        </span>
                      )}
                    </div>
                    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Розница</dt><dd className="font-bold text-brand-800">{formatCurrency(product.retail_price)}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Опт</dt><dd className="font-bold text-brand-800">{formatCurrency(product.wholesale_price)}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Остаток</dt><dd className="font-semibold text-slate-800">{product.stock_amount} {product.unit}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Статус</dt><dd className="font-semibold text-slate-800">{product.status || '-'}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Свежесть</dt><dd className="font-semibold text-slate-800">{product.freshness || '-'}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Локация</dt><dd className="font-semibold text-slate-800">{product.location || '-'}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Наличие</dt><dd className="font-semibold text-slate-800">{product.in_stock ? 'В наличии' : 'Нет в наличии'}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">В пути</dt><dd className="font-semibold text-slate-800">{product.is_in_transit ? 'Да' : 'Нет'}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Ожидаемая поставка</dt><dd className="font-semibold text-slate-800">{product.delivery_eta || '-'}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-slate-400">Откуда товар</dt><dd className="font-semibold text-slate-800">{product.origin || '-'}</dd></div>
                    </dl>
                    {product.description && <p className="mt-3 text-sm text-slate-600">{product.description}</p>}
                    {canManageProducts && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-800">Быстрые действия</p>
                        {isQuickUpdating && (
                          <span className="text-xs font-semibold text-brand-700">Обновляем...</span>
                        )}
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Быстрый остаток
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => adjustProductStock(product, 10)}
                              disabled={isQuickUpdating}
                              className={quickButtonClass}
                            >
                              +10 кг
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustProductStock(product, 50)}
                              disabled={isQuickUpdating}
                              className={quickButtonClass}
                            >
                              +50 кг
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustProductStock(product, -10)}
                              disabled={isQuickUpdating}
                              className={quickButtonClass}
                            >
                              -10 кг
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustProductStock(product, -50)}
                              disabled={isQuickUpdating}
                              className={quickButtonClass}
                            >
                              -50 кг
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Быстрый статус
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => toggleProductStockStatus(product)}
                              disabled={isQuickUpdating}
                              className={quickButtonClass}
                            >
                              {product.in_stock ? 'Нет в наличии' : 'В наличии'}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleProductTransitStatus(product)}
                              disabled={isQuickUpdating}
                              className={quickButtonClass}
                            >
                              {product.is_in_transit ? 'Не в пути' : 'В пути'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                    {canManageProducts && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(product)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleProductActive(product)}
                        disabled={visibilityUpdatingId === product.id}
                        className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-100 disabled:cursor-wait disabled:opacity-70"
                      >
                        {product.is_active ? 'Скрыть товар' : 'Показать товар'}
                      </button>
                    </div>
                    )}
                  </div>
              </article>
            )
          })}
        </main>
      )}
    </section>
  )
}

function AdminPage() {
  const [adminSession, setAdminSession] = useState<Session | null>(null)
  const [adminUser, setAdminUser] = useState<User | null>(null)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [adminAuthLoading, setAdminAuthLoading] = useState(true)
  const [adminProfileLoading, setAdminProfileLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('orders')
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>('all')
  const [periodPreset, setPeriodPreset] = useState<AdminPeriodPreset>('all')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [reportPeriod, setReportPeriod] = useState<AdminPeriodPreset>('all')
  const [reportDateFrom, setReportDateFrom] = useState('')
  const [reportDateTo, setReportDateTo] = useState('')
  const [reportClientType, setReportClientType] = useState('all')
  const [reportReceivingType, setReportReceivingType] = useState('all')
  const [reportStatusMode, setReportStatusMode] = useState<AdminReportStatusMode>('all')
  const [showArchivedOrders, setShowArchivedOrders] = useState(false)
  const [adminSearchQuery, setAdminSearchQuery] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [archivingOrderId, setArchivingOrderId] = useState<string | null>(null)
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)
  const [reportCopied, setReportCopied] = useState(false)
  const [editingStaffNoteOrderId, setEditingStaffNoteOrderId] = useState<string | null>(null)
  const [staffNoteDraft, setStaffNoteDraft] = useState('')
  const [savingStaffNoteOrderId, setSavingStaffNoteOrderId] = useState<string | null>(null)
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null)
  const [ordersSuccess, setOrdersSuccess] = useState<string | null>(null)
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [createOrderLoading, setCreateOrderLoading] = useState(false)
  const [createOrderError, setCreateOrderError] = useState<string | null>(null)
  const [createOrderForm, setCreateOrderForm] = useState<CreateAdminOrderForm>({
    customerName: '',
    customerPhone: '',
    orderType: 'retail',
    fulfillment: 'pickup',
    deliveryAddress: '',
    comment: '',
    staffNote: '',
    items: [],
  })
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProductQuantity, setSelectedProductQuantity] = useState<number | ''>('')
  const [quickCalcPrice, setQuickCalcPrice] = useState('')
  const [quickCalcQuantity, setQuickCalcQuantity] = useState('')
  const [mobileOrderFiltersOpen, setMobileOrderFiltersOpen] = useState(false)
  const [mobileReportFiltersOpen, setMobileReportFiltersOpen] = useState(false)
  const isAdminAuthenticated = Boolean(adminSession && adminProfile)
  const adminRole = adminProfile?.role ?? null
  const isOwner = adminRole === 'owner'

  const setCreateOrderFormField = <K extends keyof CreateAdminOrderForm>(
    key: K,
    value: CreateAdminOrderForm[K],
  ) => {
    setCreateOrderForm((prev) => ({ ...prev, [key]: value }))
  }

  const loadAdminProfile = useCallback(async (user: User) => {
    setAdminProfileLoading(true)
    setLoginError(null)

    try {
      const { data, error } = await supabase
        .from('admin_profiles')
        .select('id, email, role, created_at')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        setAdminProfile(null)
        setLoginError('Нет доступа к админке')
        return
      }

      setAdminProfile({
        id: String(data.id),
        email: String(data.email),
        role: data.role === 'owner' ? 'owner' : 'worker',
        created_at: typeof data.created_at === 'string' ? data.created_at : null,
      })
    } catch (error) {
      setAdminProfile(null)
      setLoginError(`Не удалось загрузить профиль админки: ${getErrorMessage(error)}`)
    } finally {
      setAdminProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadCurrentSession = async () => {
      setAdminAuthLoading(true)
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) return

      if (error) {
        setLoginError(`Не удалось проверить вход: ${getErrorMessage(error)}`)
        setAdminSession(null)
        setAdminUser(null)
        setAdminProfile(null)
        setAdminAuthLoading(false)
        return
      }

      const session = data.session
      setAdminSession(session)
      setAdminUser(session?.user ?? null)

      if (session?.user) {
        await loadAdminProfile(session.user)
      } else {
        setAdminProfile(null)
      }

      if (isMounted) {
        setAdminAuthLoading(false)
      }
    }

    void loadCurrentSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminSession(session)
      setAdminUser(session?.user ?? null)

      if (session?.user) {
        void loadAdminProfile(session.user)
      } else {
        setAdminProfile(null)
        setLoginError(null)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadAdminProfile])

  const resetCreateOrderForm = () => {
    setCreateOrderError(null)
    setCreateOrderForm({
      customerName: '',
      customerPhone: '',
      orderType: 'retail',
      fulfillment: 'pickup',
      deliveryAddress: '',
      comment: '',
      staffNote: '',
      items: [],
    })
    setSelectedProductQuantity('')
    setSelectedProductId(availableProducts[0]?.id ?? '')
  }

  const normalizeQuantityInput = (value: string): number | '' => {
    const onlyDigits = value.replace(/\D/g, '')
    if (onlyDigits === '') {
      return ''
    }

    const normalizedValue = onlyDigits.replace(/^0+(?=\d)/, '')
    return Number(normalizedValue)
  }

  useEffect(() => {
    const originalOverflow = document.body.style.overflow

    if (createOrderOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [createOrderOpen])

  const loadCreateOrderProducts = async () => {
    setProductsLoading(true)
    setProductsError(null)

    try {
      const products = await getProducts()
      setAvailableProducts(products)
      if (!selectedProductId && products.length > 0) {
        setSelectedProductId(products[0].id)
      }
    } catch (error) {
      setProductsError(getErrorMessage(error))
    } finally {
      setProductsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdminAuthenticated) return
    void loadCreateOrderProducts()
  }, [isAdminAuthenticated])

  useEffect(() => {
    if (availableProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(availableProducts[0].id)
    }
  }, [availableProducts, selectedProductId])

  useEffect(() => {
    if (!ordersSuccess) return
    const timeout = window.setTimeout(() => setOrdersSuccess(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [ordersSuccess])

  const getCreateOrderItemPrice = (product: Product) => {
    if (createOrderForm.orderType === 'wholesale') {
      return product.wholesale_price ?? product.basePrice
    }
    return product.retail_price ?? product.basePrice
  }

  const handleAddCreateOrderItem = () => {
    if (!selectedProductId) {
      setCreateOrderError('Выберите товар')
      return
    }

    if (selectedProductQuantity === '' || selectedProductQuantity <= 0) {
      setCreateOrderError('Введите количество больше 0.')
      return
    }

    const productExists = availableProducts.some((product) => product.id === selectedProductId)
    if (!productExists) {
      setCreateOrderError('Товар не найден')
      return
    }

    setCreateOrderForm((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.productId === selectedProductId)
      if (existingIndex >= 0) {
        return {
          ...prev,
          items: prev.items.map((item, index) =>
            index === existingIndex
              ? { ...item, quantity: item.quantity + selectedProductQuantity }
              : item,
          ),
        }
      }
      return {
        ...prev,
        items: [...prev.items, { productId: selectedProductId, quantity: selectedProductQuantity }],
      }
    })
    setCreateOrderError(null)
    setSelectedProductQuantity('')
  }

  const removeCreateOrderItem = (productId: string) => {
    setCreateOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.productId !== productId),
    }))
  }

  const createOrderItems = createOrderForm.items.map((item) => {
    const product = availableProducts.find((product) => product.id === item.productId)
    const pricePerKg = product ? getCreateOrderItemPrice(product) : 0
    const quantity = Math.max(0, item.quantity)
    return {
      ...item,
      quantity,
      productName: product?.name ?? 'Товар',
      price_per_kg: pricePerKg,
      total_amount: pricePerKg * quantity,
    }
  })

  const createOrderTotals = createOrderItems.reduce(
    (acc, item) => ({
      itemCount: acc.itemCount + 1,
      totalWeight: acc.totalWeight + item.quantity,
      totalAmount: acc.totalAmount + item.total_amount,
    }),
    { itemCount: 0, totalWeight: 0, totalAmount: 0 },
  )

  const selectedCreateOrderProduct = availableProducts.find(
    (product) => product.id === selectedProductId,
  )

  const handleCreateAdminOrder = async () => {
    setCreateOrderError(null)
    setOrdersError(null)

    const customerName = createOrderForm.customerName.trim()
    const customerPhone = createOrderForm.customerPhone.trim()
    const phone = normalizePhone(customerPhone)

    if (!customerName) {
      setCreateOrderError('Введите имя клиента')
      return
    }

    if (!customerPhone) {
      setCreateOrderError('Введите телефон')
      return
    }

    if (!isValidNormalizedPhone(phone)) {
      setCreateOrderError('Введите корректный телефон')
      return
    }

    if (createOrderForm.items.length === 0) {
      setCreateOrderError('Добавьте хотя бы один товар')
      return
    }

    const invalidItem = createOrderForm.items.find((item) => item.quantity <= 0)
    if (invalidItem) {
      setCreateOrderError('Введите количество больше 0.')
      return
    }

    const orderProducts = createOrderItems.filter((item) => item.price_per_kg > 0)
    if (orderProducts.length !== createOrderForm.items.length) {
      setCreateOrderError('Один из товаров недоступен')
      return
    }

    const totalWeight = createOrderTotals.totalWeight
    const totalAmount = createOrderTotals.totalAmount

    setCreateOrderLoading(true)

    try {
      const clientType = CUSTOMER_TYPE_LABELS[createOrderForm.orderType]
      const orderTypeLabel = ORDER_TYPE_LABELS[createOrderForm.orderType]
      const receivingType = FULFILLMENT_LABELS[createOrderForm.fulfillment]
      const deliveryAddress =
        createOrderForm.fulfillment === 'delivery'
          ? limitText(createOrderForm.deliveryAddress.trim(), DELIVERY_ADDRESS_MAX_LENGTH) || null
          : null
      const customerComment =
        limitText(createOrderForm.comment.trim(), CUSTOMER_COMMENT_MAX_LENGTH) || null
      const staffNote = limitText(createOrderForm.staffNote.trim(), STAFF_NOTE_MAX_LENGTH) || null

      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .upsert(
          {
            name: customerName,
            phone,
            client_type: clientType,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'phone' },
        )
        .select('id')
        .single()

      if (clientError) throw clientError
      if (!clientData?.id) throw new Error('Не удалось получить id клиента')

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_id: clientData.id,
          customer_name: customerName,
          customer_phone: phone,
          client_type: clientType,
          order_type: orderTypeLabel,
          receiving_type: receivingType,
          delivery_address: deliveryAddress,
          comment: customerComment,
          staff_note: staffNote,
          total_weight_kg: totalWeight,
          total_amount: totalAmount,
          status: 'new',
          archived_at: null,
        })
        .select('*')
        .single()

      if (orderError) throw orderError
      if (!orderData?.id) throw new Error('Не удалось создать заказ')

      const orderItemsPayload = createOrderItems.map((item) => ({
        order_id: orderData.id,
        product_id: toNumber(item.productId),
        product_name: item.productName,
        quantity_kg: item.quantity,
        price_per_kg: item.price_per_kg,
        total_amount: item.total_amount,
      }))

      const { data: insertedItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsPayload)
        .select('*')

      if (itemsError) {
        await supabase.from('orders').delete().eq('id', orderData.id)
        throw itemsError
      }

      const newOrder: AdminOrder = {
        id: String(orderData.id),
        client_id: String(clientData.id),
        customer_name: customerName,
        customer_phone: phone,
        client_type: clientType,
        order_type: orderTypeLabel,
        receiving_type: receivingType,
        delivery_address: deliveryAddress,
        comment: customerComment,
        total_weight_kg: totalWeight,
        total_amount: totalAmount,
        status: 'new',
        staff_note: staffNote,
        archived_at: null,
        created_at: String(orderData.created_at ?? new Date().toISOString()),
        items: (insertedItems ?? []).map((item) => ({
          id: String(item.id),
          order_id: String(item.order_id),
          product_id:
            item.product_id === null || item.product_id === undefined
              ? null
              : String(item.product_id) === ''
              ? null
              : toNumber(item.product_id),
          product_name: String(item.product_name ?? 'Товар'),
          quantity_kg: toNumber(item.quantity_kg),
          price_per_kg: toNumber(item.price_per_kg),
          total_amount: toNumber(item.total_amount),
          created_at: typeof item.created_at === 'string' ? item.created_at : null,
        })),
      }

      setOrders((prev) => [newOrder, ...prev])
      setOrdersSuccess('Заказ создан')
      resetCreateOrderForm()
      setCreateOrderOpen(false)
    } catch (error) {
      setCreateOrderError(getErrorMessage(error))
    } finally {
      setCreateOrderLoading(false)
    }
  }

  const handleCreateOrderButton = () => {
    if (!isOwner) return

    setOrdersError(null)
    setOrdersSuccess(null)
    setCreateOrderError(null)
    resetCreateOrderForm()
    setCreateOrderOpen(true)
  }

  const handleCloseCreateOrder = () => {
    setCreateOrderOpen(false)
    setCreateOrderError(null)
  }

  const loadAdminOrders = async () => {
    setOrdersLoading(true)
    setOrdersError(null)

    try {
      const ordersQuery = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: ordersData, error: ordersErrorResult } = await (showArchivedOrders
        ? ordersQuery.not('archived_at', 'is', null)
        : ordersQuery.is('archived_at', null))

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
          staff_note: typeof order.staff_note === 'string' ? order.staff_note : null,
          archived_at: typeof order.archived_at === 'string' ? order.archived_at : null,
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
    if (isAdminAuthenticated) {
      void loadAdminOrders()
    }
  }, [isAdminAuthenticated, showArchivedOrders])

  const filteredOrders = useMemo(() => {
    const query = adminSearchQuery.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesArchiveMode = showArchivedOrders
        ? Boolean(order.archived_at)
        : !order.archived_at
      if (!matchesArchiveMode) return false

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      if (!matchesStatus) return false
      if (!query) return true

      const haystack = [
        order.customer_name,
        order.customer_phone,
        formatPhoneForDisplay(normalizePhone(order.customer_phone)),
        order.delivery_address ?? '',
        order.comment ?? '',
        ...order.items.map((item) => item.product_name),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [adminSearchQuery, orders, showArchivedOrders, statusFilter])
  const statsOrders = useMemo(() => {
    const { fromTime, toTime } = getAdminPeriodRange(periodPreset, periodFrom, periodTo)

    return filteredOrders.filter((order) => {
      const orderTime = new Date(order.created_at).getTime()
      if (Number.isNaN(orderTime)) return false
      if (fromTime !== null && orderTime < fromTime) return false
      if (toTime !== null && orderTime > toTime) return false
      return true
    })
  }, [filteredOrders, periodFrom, periodPreset, periodTo])
  const statusStats = statsOrders.reduce(
    (acc, order) => {
      acc[order.status] += 1
      if (order.status === 'completed') acc.revenue += order.total_amount
      if (order.status === 'new' || order.status === 'processing') {
        acc.expected += order.total_amount
      }
      if (order.status === 'cancelled') acc.cancelledAmount += order.total_amount
      return acc
    },
    {
      new: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
      expected: 0,
      cancelledAmount: 0,
    },
  )
  const reportOrders = useMemo(() => {
    const { fromTime, toTime } = getAdminPeriodRange(reportPeriod, reportDateFrom, reportDateTo)

    return orders.filter((order) => {
      const matchesArchiveMode = showArchivedOrders
        ? Boolean(order.archived_at)
        : !order.archived_at
      if (!matchesArchiveMode) return false

      const orderTime = new Date(order.created_at).getTime()
      if (Number.isNaN(orderTime)) return false
      if (fromTime !== null && orderTime < fromTime) return false
      if (toTime !== null && orderTime > toTime) return false

      if (reportClientType !== 'all' && normalizeClientTypeLabel(order.client_type) !== reportClientType) return false
      if (reportReceivingType !== 'all' && order.receiving_type !== reportReceivingType) return false
      if (reportStatusMode === 'active') {
        return order.status === 'new' || order.status === 'processing'
      }
      if (reportStatusMode !== 'all' && order.status !== reportStatusMode) return false

      return true
    })
  }, [
    orders,
    reportClientType,
    reportDateFrom,
    reportDateTo,
    reportPeriod,
    reportReceivingType,
    reportStatusMode,
    showArchivedOrders,
  ])
  const reportSummary = [
    getAdminPeriodLabel(reportPeriod, reportDateFrom, reportDateTo),
    reportClientType === 'all' ? 'Все клиенты' : reportClientType,
    reportReceivingType === 'all' ? 'Все способы' : reportReceivingType,
    getReportStatusLabel(reportStatusMode),
    `${reportOrders.length} заказов`,
  ].join(' · ')
  const orderAnalytics = useMemo(() => {
    const productTotals = new Map<string, { productName: string; totalQuantityKg: number; totalAmount: number }>()
    const clientTypeTotals = new Map<string, { label: string; count: number; totalAmount: number }>()
    const orderTypeTotals = new Map<string, { label: string; count: number; totalAmount: number }>()
    const receivingTypeTotals = new Map<string, { label: string; count: number; totalAmount: number }>()

    const totals = reportOrders.reduce(
      (acc, order) => {
        acc.totalTurnover += order.total_amount
        acc.totalWeightKg += order.total_weight_kg

        if (order.status === 'completed') {
          acc.completedOrdersCount += 1
          acc.completedRevenue += order.total_amount
          acc.completedWeightKg += order.total_weight_kg
        }

        if (order.status === 'new' || order.status === 'processing') {
          acc.expectedAmount += order.total_amount
          acc.expectedWeightKg += order.total_weight_kg
        }

        if (order.status === 'cancelled') {
          acc.cancelledAmount += order.total_amount
          acc.cancelledWeightKg += order.total_weight_kg
        }

        const clientLabel = normalizeClientTypeLabel(order.client_type)
        const currentClient = clientTypeTotals.get(clientLabel) ?? {
          label: clientLabel,
          count: 0,
          totalAmount: 0,
        }
        clientTypeTotals.set(clientLabel, {
          ...currentClient,
          count: currentClient.count + 1,
          totalAmount: currentClient.totalAmount + order.total_amount,
        })

        const orderTypeLabel = order.order_type || 'Не указан'
        const currentOrderType = orderTypeTotals.get(orderTypeLabel) ?? {
          label: orderTypeLabel,
          count: 0,
          totalAmount: 0,
        }
        orderTypeTotals.set(orderTypeLabel, {
          ...currentOrderType,
          count: currentOrderType.count + 1,
          totalAmount: currentOrderType.totalAmount + order.total_amount,
        })

        const receivingLabel = order.receiving_type || 'Не указано'
        const currentReceiving = receivingTypeTotals.get(receivingLabel) ?? {
          label: receivingLabel,
          count: 0,
          totalAmount: 0,
        }
        receivingTypeTotals.set(receivingLabel, {
          ...currentReceiving,
          count: currentReceiving.count + 1,
          totalAmount: currentReceiving.totalAmount + order.total_amount,
        })

        order.items.forEach((item) => {
          const productName = item.product_name || 'Товар'
          const currentProduct = productTotals.get(productName) ?? {
            productName,
            totalQuantityKg: 0,
            totalAmount: 0,
          }
          productTotals.set(productName, {
            ...currentProduct,
            totalQuantityKg: currentProduct.totalQuantityKg + item.quantity_kg,
            totalAmount: currentProduct.totalAmount + item.total_amount,
          })
        })

        return acc
      },
      {
        totalTurnover: 0,
        totalWeightKg: 0,
        completedOrdersCount: 0,
        completedRevenue: 0,
        completedWeightKg: 0,
        expectedAmount: 0,
        expectedWeightKg: 0,
        cancelledAmount: 0,
        cancelledWeightKg: 0,
      },
    )

    return {
      ...totals,
      averageCheck: totals.completedOrdersCount > 0
        ? totals.completedRevenue / totals.completedOrdersCount
        : 0,
      topProducts: Array.from(productTotals.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5),
      clientTypes: Array.from(clientTypeTotals.values()).sort((a, b) => b.totalAmount - a.totalAmount),
      orderTypes: Array.from(orderTypeTotals.values()).sort((a, b) => b.totalAmount - a.totalAmount),
      receivingTypes: Array.from(receivingTypeTotals.values()).sort((a, b) => b.totalAmount - a.totalAmount),
    }
  }, [reportOrders])
  const quickCalcTotal = toNumber(quickCalcPrice) * toNumber(quickCalcQuantity)

  const buildReportCopyText = () => {
    const periodLabel = getReportPeriodText(reportPeriod, reportDateFrom, reportDateTo)

    if (reportOrders.length === 0) {
      return ['URALSK VEG OPI', `Отчёт: ${periodLabel}`, 'Заказов нет.'].join('\n')
    }

    const productLines = orderAnalytics.topProducts.map(
      (item, index) =>
        `${index + 1}. ${item.productName} - ${formatKg(item.totalQuantityKg)} / ${formatCurrency(item.totalAmount)}`,
    )
    const receivingLines = orderAnalytics.receivingTypes.map(
      (item) => `${item.label} - ${item.count} заказов / ${formatCurrency(item.totalAmount)}`,
    )
    const clientTypeLines = orderAnalytics.clientTypes.map(
      (item) => `${item.label} - ${item.count} заказов / ${formatCurrency(item.totalAmount)}`,
    )
    const orderTypeLines = orderAnalytics.orderTypes.map(
      (item) => `${item.label} - ${item.count} заказов / ${formatCurrency(item.totalAmount)}`,
    )

    return [
      'URALSK VEG OPI',
      `Отчёт: ${periodLabel}`,
      '',
      `Заказов: ${reportOrders.length}`,
      `Выручка: ${formatCurrency(orderAnalytics.completedRevenue)}`,
      `Ожидаемая сумма: ${formatCurrency(orderAnalytics.expectedAmount)}`,
      `Отменено: ${formatCurrency(orderAnalytics.cancelledAmount)}`,
      `Общий оборот: ${formatCurrency(orderAnalytics.totalTurnover)}`,
      `Средний чек: ${formatCurrency(orderAnalytics.averageCheck)}`,
      '',
      `Общий вес: ${formatKg(orderAnalytics.totalWeightKg)}`,
      `Выполнено: ${formatKg(orderAnalytics.completedWeightKg)}`,
      `Ожидается: ${formatKg(orderAnalytics.expectedWeightKg)}`,
      `Отменено: ${formatKg(orderAnalytics.cancelledWeightKg)}`,
      '',
      'Топ товаров:',
      ...(productLines.length > 0 ? productLines : ['Нет данных']),
      '',
      'Типы клиентов:',
      ...(clientTypeLines.length > 0 ? clientTypeLines : ['Нет данных']),
      '',
      'Получение:',
      ...(receivingLines.length > 0 ? receivingLines : ['Нет данных']),
      '',
      'Типы заказов:',
      ...(orderTypeLines.length > 0 ? orderTypeLines : ['Нет данных']),
    ].join('\n')
  }

  const copyReportToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(buildReportCopyText())
      setReportCopied(true)
      setOrdersError(null)
      window.setTimeout(() => setReportCopied(false), 1800)
    } catch {
      setOrdersError('Не удалось скопировать отчёт')
    }
  }

  const downloadExcelReport = async () => {
    if (!isOwner) {
      setOrdersError('Нет доступа к скачиванию полного Excel-отчёта.')
      return
    }

    type ExcelValue = string | number | null
    type ExcelRow = Record<string, ExcelValue>
    type AddSheetOptions = {
      autoFilter?: boolean
      headers?: string[]
    }
    type ReportClientData = {
      id: string
      name: string
      phone: string
      client_type: string
      client_status: ClientManualStatus
      client_note: string | null
    }

    const formatExcelDate = (value: string | null | undefined) => {
      if (!value) return ''
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ru-RU')
    }
    const roundMoney = (value: number) => Math.round(Number(value) || 0)
    const roundKg = (value: number) => Math.round((Number(value) || 0) * 100) / 100
    const formatExcelMoney = (value: number) => formatCurrency(roundMoney(value))
    const formatExcelKg = (value: number) => `${roundKg(value).toLocaleString('ru-RU')} кг`
    const formatExcelPercent = (value: number) => `${Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`

    try {
      setOrdersError(null)
      const XLSX = await import('xlsx')
      const addSheet = (
        workbook: import('xlsx').WorkBook,
        name: string,
        rows: ExcelRow[],
        options: AddSheetOptions = {},
      ) => {
        const headers = options.headers ?? (rows[0] ? Object.keys(rows[0]) : [])
        const sheet = XLSX.utils.aoa_to_sheet([
          headers,
          ...rows.map((row) => headers.map((header) => row[header] ?? '')),
        ])
        sheet['!cols'] = headers.map((header, index) => {
          const maxLength = Math.max(
            header.length,
            ...rows.map((row) => String(row[header] ?? '').length),
          )
          const width = Math.min(Math.max(maxLength + 2, index === 0 ? 18 : 12), 48)
          return { wch: width }
        })

        const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null
        if (range) {
          for (let column = range.s.c; column <= range.e.c; column += 1) {
            const headerCell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })]
            if (headerCell) {
              headerCell.s = { ...(headerCell.s ?? {}), font: { bold: true } }
            }
          }
          if (options.autoFilter && range.e.r > 0) {
            sheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) }
          }
        }

        XLSX.utils.book_append_sheet(workbook, sheet, name)
      }

      const periodLabel = getReportPeriodText(reportPeriod, reportDateFrom, reportDateTo)
      const createSummarySheet = (workbook: import('xlsx').WorkBook) => {
        const now = new Date()
        const summaryRows = [
          ['ОПТ ОВОЩИ УРАЛЬСК — ОТЧЁТ', ''],
          [],
          ['Период отчёта', periodLabel],
          ['Дата выгрузки', now.toLocaleString('ru-RU')],
          [],
          ['Финансы', ''],
          ['Выручка', formatExcelMoney(orderAnalytics.completedRevenue)],
          ['Ожидаемая сумма', formatExcelMoney(orderAnalytics.expectedAmount)],
          ['Отменённая сумма', formatExcelMoney(orderAnalytics.cancelledAmount)],
          ['Общий оборот', formatExcelMoney(orderAnalytics.totalTurnover)],
          ['Средний чек', formatExcelMoney(orderAnalytics.averageCheck)],
          [],
          ['Заказы', ''],
          ['Количество заказов', reportOrders.length],
          ['Выполнено', reportOrders.filter((order) => order.status === 'completed').length],
          ['Новые / В работе', reportOrders.filter((order) => order.status === 'new' || order.status === 'processing').length],
          ['Отменено', reportOrders.filter((order) => order.status === 'cancelled').length],
          [],
          ['Вес', ''],
          ['Всего кг', formatExcelKg(orderAnalytics.totalWeightKg)],
          ['Выполнено кг', formatExcelKg(orderAnalytics.completedWeightKg)],
          ['Ожидается кг', formatExcelKg(orderAnalytics.expectedWeightKg)],
          ['Отменено кг', formatExcelKg(orderAnalytics.cancelledWeightKg)],
        ]

        const sheet = XLSX.utils.aoa_to_sheet(summaryRows)
        sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
        const columnWidths = [0, 0]
        summaryRows.forEach((row) => {
          row.forEach((cell, index) => {
            const length = String(cell ?? '').length
            if (length > columnWidths[index]) columnWidths[index] = length
          })
        })
        sheet['!cols'] = columnWidths.map((length) => ({ wch: Math.min(Math.max(length + 2, 12), 48) }))

        const boldRows = new Set([0, 5, 12, 17])
        summaryRows.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            if (!cell) return
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })
            const sheetCell = sheet[address]
            if (!sheetCell) return
            const isSectionTitle = boldRows.has(rowIndex)
            sheetCell.s = {
              ...(sheetCell.s ?? {}),
              font: { bold: isSectionTitle || rowIndex === 0, sz: rowIndex === 0 ? 14 : 11 },
            }
          })
        })

        XLSX.utils.book_append_sheet(workbook, sheet, 'Сводка')
      }

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, phone, client_type, client_status, client_note')

      if (clientsError) throw clientsError

      const clients = ((clientsData ?? []) as Record<string, unknown>[]).map<ReportClientData>((client) => ({
        id: String(client.id ?? ''),
        name: String(client.name ?? ''),
        phone: String(client.phone ?? ''),
        client_type: normalizeClientTypeLabel(client.client_type),
        client_status: normalizeClientManualStatus(client.client_status),
        client_note: typeof client.client_note === 'string' ? client.client_note : null,
      }))
      const clientsById = new Map(clients.map((client) => [client.id, client]))
      const clientsByPhone = new Map(
        clients
          .map((client) => [normalizePhone(client.phone), client] as const)
          .filter(([phone]) => phone.length > 0),
      )

      const workbook = XLSX.utils.book_new()
      createSummarySheet(workbook)

      const orderRows: ExcelRow[] = reportOrders.map((order) => ({
        'Дата заказа': formatExcelDate(order.created_at),
        'Номер/ID заказа': order.id,
        'Имя клиента': order.customer_name || '',
        Телефон: formatPhoneForDisplay(normalizePhone(order.customer_phone)),
        'Тип заказа': order.order_type || '',
        Получение: order.receiving_type || '',
        Статус: ADMIN_STATUS_LABELS[order.status],
        Сумма: formatExcelMoney(order.total_amount),
        'Общий вес': formatExcelKg(order.total_weight_kg),
        'Адрес доставки': order.delivery_address ?? '',
        'Комментарий клиента': order.comment ?? '',
        'Заметка работника': order.staff_note ?? '',
      }))
      const ordersTotalAmount = reportOrders.reduce((sum, order) => sum + order.total_amount, 0)
      const ordersTotalWeight = reportOrders.reduce((sum, order) => sum + order.total_weight_kg, 0)
      orderRows.push({
        'Дата заказа': 'Итого заказов',
        'Номер/ID заказа': reportOrders.length,
        Сумма: formatExcelMoney(ordersTotalAmount),
        'Общий вес': formatExcelKg(ordersTotalWeight),
      })

      addSheet(
        workbook,
        'Заказы',
        orderRows,
        {
          autoFilter: true,
          headers: [
            'Дата заказа',
            'Номер/ID заказа',
            'Имя клиента',
            'Телефон',
            'Тип заказа',
            'Получение',
            'Статус',
            'Сумма',
            'Общий вес',
            'Адрес доставки',
            'Комментарий клиента',
            'Заметка работника',
          ],
        },
      )

      const statusRows = (
        [
          { key: 'new' as AdminOrderStatus, label: ADMIN_STATUS_LABELS.new },
          { key: 'processing' as AdminOrderStatus, label: ADMIN_STATUS_LABELS.processing },
          { key: 'completed' as AdminOrderStatus, label: ADMIN_STATUS_LABELS.completed },
          { key: 'cancelled' as AdminOrderStatus, label: ADMIN_STATUS_LABELS.cancelled },
        ] as const
      ).map((statusItem) => {
        const statusOrders = reportOrders.filter((order) => order.status === statusItem.key)
        const statusAmount = statusOrders.reduce((sum, order) => sum + order.total_amount, 0)
        const statusWeight = statusOrders.reduce((sum, order) => sum + order.total_weight_kg, 0)
        return {
          Статус: statusItem.label,
          'Количество заказов': statusOrders.length,
          Сумма: formatExcelMoney(statusAmount),
          Кг: formatExcelKg(statusWeight),
        }
      })
      addSheet(workbook, 'Статусы', statusRows, {
        autoFilter: true,
        headers: ['Статус', 'Количество заказов', 'Сумма', 'Кг'],
      })

      const productTotals = new Map<
        string,
        {
          productName: string
          orderIds: Set<string>
          positionCount: number
          totalQuantityKg: number
          totalAmount: number
        }
      >()
      reportOrders.forEach((order) => {
        order.items.forEach((item) => {
          const productName = item.product_name || 'Товар'
          const current = productTotals.get(productName) ?? {
            productName,
            orderIds: new Set<string>(),
            positionCount: 0,
            totalQuantityKg: 0,
            totalAmount: 0,
          }
          current.orderIds.add(order.id)
          current.positionCount += 1
          current.totalQuantityKg += item.quantity_kg
          current.totalAmount += item.total_amount
          productTotals.set(productName, current)
        })
      })

      const allProductRows: ExcelRow[] = Array.from(productTotals.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map((item) => ({
          'Название товара': item.productName,
          'Количество заказов': item.orderIds.size,
          'Количество позиций': item.positionCount,
          'Общий вес кг': formatExcelKg(item.totalQuantityKg),
          'Общая сумма': formatExcelMoney(item.totalAmount),
          'Средняя цена за кг': item.totalQuantityKg > 0 ? formatExcelMoney(item.totalAmount / item.totalQuantityKg) : formatExcelMoney(0),
        }))

      const totalPositions = allProductRows.reduce((sum, item) => sum + Number(item['Количество позиций'] || 0), 0)
      const totalProductsAmount = Array.from(productTotals.values()).reduce((sum, item) => sum + item.totalAmount, 0)
      const totalProductsKg = Array.from(productTotals.values()).reduce((sum, item) => sum + item.totalQuantityKg, 0)
      allProductRows.push({
        'Название товара': 'Итого позиций',
        'Количество позиций': totalPositions,
        'Общий вес кг': formatExcelKg(totalProductsKg),
        'Общая сумма': formatExcelMoney(totalProductsAmount),
      })

      addSheet(
        workbook,
        'Товары',
        allProductRows,
        {
          autoFilter: true,
          headers: [
            'Название товара',
            'Количество заказов',
            'Количество позиций',
            'Общий вес кг',
            'Общая сумма',
            'Средняя цена за кг',
          ],
        },
      )

      const topProductRows: ExcelRow[] = Array.from(productTotals.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map((item) => ({
          Товар: item.productName,
          'Количество заказов/позиций': `${item.orderIds.size}/${item.positionCount}`,
          'Общий вес кг': formatExcelKg(item.totalQuantityKg),
          'Общая сумма': formatExcelMoney(item.totalAmount),
          'Доля от оборота': formatExcelPercent(
            orderAnalytics.totalTurnover > 0
              ? (item.totalAmount / orderAnalytics.totalTurnover) * 100
              : 0,
          ),
        }))

      addSheet(workbook, 'Топ товаров', topProductRows, {
        autoFilter: true,
        headers: [
          'Товар',
          'Количество заказов/позиций',
          'Общий вес кг',
          'Общая сумма',
          'Доля от оборота',
        ],
      })

      const clientTypeRows: ExcelRow[] = orderAnalytics.clientTypes.map((item) => ({
        'Тип клиента': item.label,
        'Количество заказов': item.count,
        'Общая сумма': formatExcelMoney(item.totalAmount),
        'Средний чек': item.count > 0 ? formatExcelMoney(item.totalAmount / item.count) : formatExcelMoney(0),
        'Доля от оборота': formatExcelPercent(
          orderAnalytics.totalTurnover > 0
            ? (item.totalAmount / orderAnalytics.totalTurnover) * 100
            : 0,
        ),
      }))
      addSheet(workbook, 'Типы клиентов', clientTypeRows, {
        autoFilter: true,
        headers: ['Тип клиента', 'Количество заказов', 'Общая сумма', 'Средний чек', 'Доля от оборота'],
      })

      const receivingRows: ExcelRow[] = orderAnalytics.receivingTypes.map((item) => ({
        Получение: item.label,
        'Количество заказов': item.count,
        'Общая сумма': formatExcelMoney(item.totalAmount),
        'Средний чек': item.count > 0 ? formatExcelMoney(item.totalAmount / item.count) : formatExcelMoney(0),
        'Доля от оборота': formatExcelPercent(
          orderAnalytics.totalTurnover > 0
            ? (item.totalAmount / orderAnalytics.totalTurnover) * 100
            : 0,
        ),
      }))
      addSheet(workbook, 'Получение', receivingRows, {
        autoFilter: true,
        headers: ['Получение', 'Количество заказов', 'Общая сумма', 'Средний чек', 'Доля от оборота'],
      })

      const clientTotals = new Map<
        string,
        {
          name: string
          phone: string
          clientType: string
          clientStatus: ClientManualStatus
          clientNote: string | null
          orderCount: number
          totalAmount: number
          lastOrderAt: string | null
        }
      >()
      reportOrders.forEach((order) => {
        const normalizedPhone = normalizePhone(order.customer_phone)
        const linkedClient =
          (order.client_id ? clientsById.get(order.client_id) : undefined) ??
          clientsByPhone.get(normalizedPhone)
        const key = linkedClient?.id || normalizedPhone || `${order.customer_name}-${order.customer_phone}`
        const current = clientTotals.get(key) ?? {
          name: linkedClient?.name || order.customer_name || '',
          phone: linkedClient?.phone || order.customer_phone || '',
          clientType: normalizeClientTypeLabel(linkedClient?.client_type || order.client_type),
          clientStatus: normalizeClientManualStatus(linkedClient?.client_status),
          clientNote: linkedClient?.client_note ?? null,
          orderCount: 0,
          totalAmount: 0,
          lastOrderAt: null,
        }
        const currentLastTime = current.lastOrderAt ? new Date(current.lastOrderAt).getTime() : 0
        const nextLastTime = new Date(order.created_at).getTime()
        clientTotals.set(key, {
          ...current,
          orderCount: current.orderCount + 1,
          totalAmount: current.totalAmount + order.total_amount,
          lastOrderAt:
            !Number.isNaN(nextLastTime) && nextLastTime > currentLastTime
              ? order.created_at
              : current.lastOrderAt,
        })
      })

      const clientRows: ExcelRow[] = Array.from(clientTotals.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .map((client) => {
          const stats = {
            orderCount: client.orderCount,
            totalAmount: client.totalAmount,
            averageAmount: client.orderCount > 0 ? client.totalAmount / client.orderCount : 0,
            lastOrderAt: client.lastOrderAt,
          }

          return {
            'Имя клиента': client.name,
            Телефон: formatPhoneForDisplay(normalizePhone(client.phone)),
            'Количество заказов': stats.orderCount,
            'Общая сумма': formatExcelMoney(stats.totalAmount),
            'Средний чек': formatExcelMoney(stats.averageAmount),
            'Последний заказ': formatExcelDate(stats.lastOrderAt),
            'Статус клиента': CLIENT_MANUAL_STATUS_LABELS[client.clientStatus],
            'Подсказка сайта': getAdminClientStatus(stats).label,
            'Заметка работника': client.clientNote ?? '',
          }
        })

      clientRows.push({
        'Имя клиента': 'Итого клиентов',
        'Количество заказов': clientRows.length,
        'Общая сумма': formatExcelMoney(
          Array.from(clientTotals.values()).reduce((sum, client) => sum + client.totalAmount, 0),
        ),
        'Средний чек': formatExcelMoney(
          reportOrders.length > 0
            ? reportOrders.reduce((sum, order) => sum + order.total_amount, 0) / reportOrders.length
            : 0,
        ),
      })

      addSheet(
        workbook,
        'Клиенты',
        clientRows,
        {
          autoFilter: true,
          headers: [
            'Имя клиента',
            'Телефон',
            'Количество заказов',
            'Общая сумма',
            'Средний чек',
            'Последний заказ',
            'Статус клиента',
            'Подсказка сайта',
            'Заметка работника',
          ],
        },
      )

      const fileDate = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `uralsk-veg-report-${fileDate}.xlsx`)
    } catch (error) {
      setOrdersError(`Не удалось скачать отчёт: ${getErrorMessage(error)}`)
    }
  }

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setLoginError('Введите email и пароль')
      return
    }

    setLoginLoading(true)
    setLoginError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setLoginError(`Не удалось войти в админку: ${getErrorMessage(error)}`)
      setLoginLoading(false)
      return
    }

    setAdminSession(data.session)
    setAdminUser(data.user)
    if (data.user) {
      await loadAdminProfile(data.user)
    }
    setLoginLoading(false)
  }

  const endAdminSession = async () => {
    await supabase.auth.signOut()
    setAdminSession(null)
    setAdminUser(null)
    setAdminProfile(null)
    setEmail('')
    setPassword('')
    setActiveAdminTab('orders')
    setOrders([])
    setOrdersError(null)
    setAdminSearchQuery('')
    setStatusFilter('all')
    setPeriodPreset('all')
    setPeriodFrom('')
    setPeriodTo('')
    setReportPeriod('all')
    setReportDateFrom('')
    setReportDateTo('')
    setReportClientType('all')
    setReportReceivingType('all')
    setReportStatusMode('all')
    setShowArchivedOrders(false)
    setQuickCalcPrice('')
    setQuickCalcQuantity('')
    setMobileOrderFiltersOpen(false)
    setMobileReportFiltersOpen(false)
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

  const archiveOrder = async (orderId: string) => {
    if (!isOwner) {
      setOrdersError('Нет доступа к архивированию заказов.')
      return
    }

    setArchivingOrderId(orderId)
    setOrdersError(null)

    try {
      const archivedAt = new Date().toISOString()
      console.log('Archiving order id:', orderId)

      const { error: updateError } = await supabase
        .from('orders')
        .update({ archived_at: archivedAt })
        .eq('id', orderId)

      if (updateError) {
        console.error('Archive order update error:', updateError)
        setOrdersError(`Не удалось отправить заказ в архив: ${updateError.message}`)
        return
      }

      const { data: updatedOrder, error: readError } = await supabase
        .from('orders')
        .select('id, archived_at')
        .eq('id', orderId)
        .maybeSingle()

      if (readError) {
        console.error('Archive order read error:', readError)
        setOrdersError(`Заказ обновлён, но не удалось проверить архив: ${readError.message}`)
        await loadAdminOrders()
        return
      }

      if (!updatedOrder?.archived_at) {
        console.error('Archive order verification failed:', {
          orderId,
          updatedOrder,
        })
        setOrdersError('Supabase не подтвердил archived_at. Проверь, изменилось ли значение в таблице orders.')
        await loadAdminOrders()
        return
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, archived_at: updatedOrder.archived_at } : order,
        ),
      )
    } catch (error) {
      console.error('Archive order unexpected error:', error)
      setOrdersError(`Не удалось отправить заказ в архив: ${getErrorMessage(error)}`)
    } finally {
      setArchivingOrderId(null)
    }
  }

  const restoreOrder = async (orderId: string) => {
    if (!isOwner) {
      setOrdersError('Нет доступа к восстановлению архивных заказов.')
      return
    }

    setArchivingOrderId(orderId)
    setOrdersError(null)

    try {
      console.log('Restoring order id:', orderId)

      const { error: updateError } = await supabase
        .from('orders')
        .update({ archived_at: null })
        .eq('id', orderId)

      if (updateError) {
        console.error('Restore order update error:', updateError)
        setOrdersError(`Не удалось восстановить заказ: ${updateError.message}`)
        return
      }

      const { data: updatedOrder, error: readError } = await supabase
        .from('orders')
        .select('id, archived_at')
        .eq('id', orderId)
        .maybeSingle()

      if (readError) {
        console.error('Restore order read error:', readError)
        setOrdersError(`Заказ обновлён, но не удалось проверить восстановление: ${readError.message}`)
        await loadAdminOrders()
        return
      }

      if (!updatedOrder) {
        console.error('Restore order verification failed:', {
          orderId,
          updatedOrder,
        })
        setOrdersError('Supabase не вернул заказ после восстановления. Проверь id заказа или RLS policy.')
        await loadAdminOrders()
        return
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, archived_at: null } : order,
        ),
      )
    } catch (error) {
      console.error('Restore order unexpected error:', error)
      setOrdersError(`Не удалось восстановить заказ: ${getErrorMessage(error)}`)
    } finally {
      setArchivingOrderId(null)
    }
  }

  const deleteArchivedOrderForever = async (orderId: string) => {
    if (!isOwner) {
      setOrdersError('Нет доступа к удалению архивных заказов.')
      return
    }

    const confirmed = window.confirm('Удалить заказ навсегда? Это действие нельзя отменить.')
    if (!confirmed) return

    setDeletingOrderId(orderId)
    setOrdersError(null)

    try {
      console.log('Deleting archived order:', orderId)

      const { error: itemsDeleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)

      console.log('Deleted order_items error:', itemsDeleteError)

      if (itemsDeleteError) {
        setOrdersError(
          `Не удалось удалить позиции заказа. Заказ не удалён. Проверь delete policy для order_items: ${itemsDeleteError.message}`,
        )
        return
      }

      const { error: orderDeleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

      console.log('Deleted order error:', orderDeleteError)

      if (orderDeleteError) {
        setOrdersError(
          `Не удалось удалить заказ. Проверь delete policy для orders: ${orderDeleteError.message}`,
        )
        return
      }

      const { data: checkOrder, error: checkError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .maybeSingle()

      console.log('Check deleted order:', checkOrder, checkError)

      if (checkError) {
        setOrdersError(`Не удалось проверить удаление заказа: ${checkError.message}`)
        return
      }

      if (checkOrder) {
        setOrdersError('Заказ не был удалён из базы. Проверьте delete policy для orders.')
        return
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId))
    } catch (error) {
      setOrdersError(`Не удалось удалить заказ навсегда: ${getErrorMessage(error)}`)
    } finally {
      setDeletingOrderId(null)
    }
  }

  const startEditStaffNote = (order: AdminOrder) => {
    setEditingStaffNoteOrderId(order.id)
    setStaffNoteDraft(order.staff_note ?? '')
    setOrdersError(null)
  }

  const cancelEditStaffNote = () => {
    setEditingStaffNoteOrderId(null)
    setStaffNoteDraft('')
  }

  const saveStaffNote = async (orderId: string) => {
    setSavingStaffNoteOrderId(orderId)
    setOrdersError(null)

    try {
      const nextNote = limitText(staffNoteDraft.trim(), STAFF_NOTE_MAX_LENGTH) || null
      const { error } = await supabase
        .from('orders')
        .update({ staff_note: nextNote })
        .eq('id', orderId)

      if (error) throw error

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, staff_note: nextNote } : order,
        ),
      )
      setEditingStaffNoteOrderId(null)
      setStaffNoteDraft('')
    } catch (error) {
      setOrdersError(`Не удалось сохранить заметку работника: ${getErrorMessage(error)}`)
    } finally {
      setSavingStaffNoteOrderId(null)
    }
  }

  const copyOrderToClipboard = async (order: AdminOrder) => {
    try {
      await navigator.clipboard.writeText(buildAdminOrderCopyText(order))
      setCopiedOrderId(order.id)
      window.setTimeout(() => setCopiedOrderId(null), 1600)
    } catch (error) {
      setOrdersError(`Не удалось скопировать заказ: ${getErrorMessage(error)}`)
    }
  }

  if (adminAuthLoading || adminProfileLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-sm font-bold text-slate-600 shadow-xl shadow-slate-200/70">
          Проверяем доступ к админке...
        </div>
      </div>
    )
  }

  if (adminSession && !adminProfile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/70">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <Lock className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-900">Нет доступа</h1>
              <p className="text-sm text-slate-500">Нет доступа к админке</p>
            </div>
          </div>
          {adminUser?.email && (
            <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              {adminUser.email}
            </p>
          )}
          {loginError && <p className="mb-4 text-sm font-medium text-red-600">{loginError}</p>}
          <button
            type="button"
            onClick={() => void endAdminSession()}
            className="w-full rounded-xl bg-brand-700 px-4 py-3 text-base font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 active:scale-[0.98]"
          >
            Сменить аккаунт
          </button>
        </div>
      </div>
    )
  }

  if (!isAdminAuthenticated) {
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
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setLoginError(null)
              }}
              className="mt-1 mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
              placeholder="Email"
              autoComplete="email"
              autoFocus
            />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-slate-700">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setLoginError(null)
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
              placeholder="Пароль"
              autoComplete="current-password"
            />
          </label>
          {loginError && <p className="mt-2 text-sm font-medium text-red-600">{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading}
            className="mt-5 w-full rounded-xl bg-brand-700 px-4 py-3 text-base font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-800 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {loginLoading ? 'Входим...' : 'Войти в админку'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-6 lg:px-6">
      <div className="mx-auto w-full max-w-[1400px]">
        <nav className="mb-4 grid grid-cols-4 items-center gap-2 rounded-2xl bg-white p-2 shadow-lg shadow-slate-200/60 sm:flex sm:flex-row sm:flex-wrap">
          <div className="contents sm:flex sm:flex-wrap sm:gap-2">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveAdminTab(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  activeAdminTab === tab.id
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-brand-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="contents sm:ml-auto sm:flex sm:items-center sm:gap-2">
            <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:inline">
              {adminProfile?.email} · {adminRole}
            </span>
            <button
              type="button"
              onClick={() => void endAdminSession()}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
            >
              <span>Выйти</span>
            </button>
          </div>
        </nav>

        {activeAdminTab === 'orders' ? (
          <>
        <header className="mb-4 rounded-3xl bg-brand-900 p-3 text-white shadow-xl shadow-slate-200/70 sm:mb-5 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100/80">
                URALSK VEG OPI
              </p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">Админка заказов</h1>
              <p className="mt-0.5 text-xs text-brand-100 sm:mt-1 sm:text-sm">
                Новые сверху · данные из Supabase
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/10 p-2 sm:mt-5 sm:p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] lg:grid-cols-[minmax(18rem,1.4fr)_12rem_12rem_12rem_10rem]">
              <label className="relative block sm:col-span-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
                  aria-hidden
                />
                <input
                  type="search"
                  value={adminSearchQuery}
                  onChange={(event) => setAdminSearchQuery(event.target.value)}
                  placeholder="Поиск: имя, телефон, адрес, товар..."
                  className="h-11 w-full rounded-xl border border-white/20 bg-white/10 py-2 pl-10 pr-3 text-sm font-semibold text-white outline-none placeholder:text-white/60 focus:ring-2 focus:ring-white/30"
                />
              </label>
              <button
                type="button"
                onClick={() => setMobileOrderFiltersOpen((value) => !value)}
                className="flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/20 lg:hidden"
              >
                Фильтры
              </button>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as AdminStatusFilter)}
                className={`${mobileOrderFiltersOpen ? 'block' : 'hidden'} h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-white/30 sm:col-span-3 lg:col-span-1 lg:block [&_option]:text-slate-800`}
              >
                {ADMIN_STATUS_OPTIONS.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
              <select
                value={periodPreset}
                onChange={(event) => setPeriodPreset(event.target.value as AdminPeriodPreset)}
                className={`${mobileOrderFiltersOpen ? 'block' : 'hidden'} h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-white/30 sm:col-span-3 lg:col-span-1 lg:block [&_option]:text-slate-800`}
              >
                {ADMIN_PERIOD_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label
                className={`hidden h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition lg:col-span-1 lg:flex ${
                  showArchivedOrders
                    ? 'border-white bg-white text-brand-800'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showArchivedOrders}
                  onChange={(event) => setShowArchivedOrders(event.target.checked)}
                  className="h-4 w-4 accent-brand-700"
                />
                Показать только архив
              </label>
              <button
                type="button"
                onClick={loadAdminOrders}
                disabled={ordersLoading}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-brand-800 transition hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70 sm:px-4"
              >
                <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
                Обновить
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setShowArchivedOrders(false)}
                className={`h-10 rounded-xl border px-3 text-sm font-bold transition ${
                  !showArchivedOrders
                    ? 'border-white bg-white text-brand-800'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                }`}
                aria-pressed={!showArchivedOrders}
              >
                Все заказы
              </button>
              <button
                type="button"
                onClick={() => setShowArchivedOrders(true)}
                className={`h-10 rounded-xl border px-3 text-sm font-bold transition ${
                  showArchivedOrders
                    ? 'border-white bg-white text-brand-800'
                    : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                }`}
                aria-pressed={showArchivedOrders}
              >
                Архив
              </button>
            </div>

            {periodPreset === 'custom' && (
              <div className={`${mobileOrderFiltersOpen ? 'grid' : 'hidden'} mt-3 gap-2 sm:grid-cols-2 lg:grid lg:w-[24.5rem]`}>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-100">
                    С
                  </span>
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(event) => setPeriodFrom(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-100">
                    По
                  </span>
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(event) => setPeriodTo(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-4 lg:grid-cols-7">
            <div className="rounded-2xl bg-white/10 px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-xs text-brand-100">Всего заказов</p>
              <p className="text-lg font-bold sm:text-xl">{statsOrders.length}</p>
            </div>
            <div className="hidden rounded-2xl bg-white/10 px-3 py-2 sm:px-4 sm:py-3 lg:block">
              <p className="text-xs text-brand-100">Новые</p>
              <p className="text-lg font-bold sm:text-xl">{statusStats.new}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-xs text-brand-100">В работе</p>
              <p className="text-lg font-bold sm:text-xl">{statusStats.processing}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-xs text-brand-100">Выполненные</p>
              <p className="text-lg font-bold sm:text-xl">{statusStats.completed}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 sm:px-4 sm:py-3">
              <p className="text-xs text-brand-100">Выручка</p>
              <p className="text-base font-bold sm:text-lg">{formatCurrency(statusStats.revenue)}</p>
            </div>
            <div className="hidden rounded-2xl bg-white/10 px-3 py-2 sm:px-4 sm:py-3 lg:block">
              <p className="text-xs text-brand-100">Ожидаемая сумма</p>
              <p className="text-lg font-bold">{formatCurrency(statusStats.expected)}</p>
            </div>
            <div className="hidden rounded-2xl bg-white/10 px-3 py-2 sm:px-4 sm:py-3 lg:block">
              <p className="text-xs text-brand-100">Отменено</p>
              <p className="text-lg font-bold">{formatCurrency(statusStats.cancelledAmount)}</p>
            </div>
          </div>
        </header>

        {createOrderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 overscroll-contain">
            <div className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[calc(100vh-32px)]">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Создать заказ вручную</h2>
                  <p className="text-sm text-slate-500">Заполните данные клиента и добавьте товары.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseCreateOrder}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  aria-label="Закрыть окно создания заказа"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-5 sm:px-6" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                {(createOrderError || productsError) && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {createOrderError || productsError}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Имя клиента</span>
                    <input
                      type="text"
                      value={createOrderForm.customerName}
                      onChange={(event) => setCreateOrderFormField('customerName', event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Телефон</span>
                    <input
                      type="tel"
                      value={createOrderForm.customerPhone}
                      inputMode="tel"
                      onChange={(event) =>
                        setCreateOrderFormField('customerPhone', formatPhoneInput(event.target.value))
                      }
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      placeholder="+7 777 123 45 67"
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Тип заказа</span>
                    <select
                      value={createOrderForm.orderType}
                      onChange={(event) => setCreateOrderFormField('orderType', event.target.value as OrderType)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="retail">Розничный</option>
                      <option value="wholesale">Оптовый</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Способ получения</span>
                    <select
                      value={createOrderForm.fulfillment}
                      onChange={(event) => setCreateOrderFormField('fulfillment', event.target.value as FulfillmentType)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="pickup">Самовывоз</option>
                      <option value="delivery">Доставка</option>
                    </select>
                  </label>
                  {createOrderForm.fulfillment === 'delivery' ? (
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Адрес доставки</span>
                      <input
                        type="text"
                        value={createOrderForm.deliveryAddress}
                        maxLength={DELIVERY_ADDRESS_MAX_LENGTH}
                        onChange={(event) =>
                          setCreateOrderFormField(
                            'deliveryAddress',
                            limitText(event.target.value, DELIVERY_ADDRESS_MAX_LENGTH),
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                      <CharacterCounter
                        value={createOrderForm.deliveryAddress}
                        maxLength={DELIVERY_ADDRESS_MAX_LENGTH}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.4fr_auto]">
                  <div className="grid gap-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Товар</span>
                      <select
                        value={selectedProductId}
                        onChange={(event) => setSelectedProductId(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      >
                        {availableProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">Количество (кг)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        step={1}
                        value={selectedProductQuantity === '' ? '' : selectedProductQuantity}
                        placeholder="Например: 25"
                        onKeyDown={(event) => {
                          if (['-', '+', '.', ',', 'e', 'E'].includes(event.key)) {
                            event.preventDefault()
                          }
                        }}
                        onChange={(event) => setSelectedProductQuantity(normalizeQuantityInput(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                    </label>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Текущая цена</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">
                      {selectedCreateOrderProduct ? `${formatCurrency(getCreateOrderItemPrice(selectedCreateOrderProduct))}/кг` : 'Выберите товар'}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddCreateOrderItem}
                      className="mt-4 w-full rounded-2xl bg-brand-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={!selectedProductId}
                    >
                      Добавить товар
                    </button>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Товары в заказе</h3>
                    <span className="text-sm text-slate-500">{createOrderTotals.itemCount} поз.</span>
                  </div>
                  {createOrderItems.length === 0 ? (
                    <p className="text-sm text-slate-500">Товары пока не добавлены.</p>
                  ) : (
                    <ul className="space-y-2">
                      {createOrderItems.map((item) => (
                        <li key={item.productId} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-sm text-slate-500">
                              {item.quantity} кг × {formatCurrency(item.price_per_kg)}/кг
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-right font-bold text-slate-900">{formatCurrency(item.total_amount)}</p>
                            <button
                              type="button"
                              onClick={() => removeCreateOrderItem(item.productId)}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              Удалить
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Всего позиций</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">{createOrderTotals.itemCount}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Общий вес</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">{createOrderTotals.totalWeight} кг</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Итог</p>
                    <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(createOrderTotals.totalAmount)}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Комментарий клиента</span>
                    <textarea
                      value={createOrderForm.comment}
                      maxLength={CUSTOMER_COMMENT_MAX_LENGTH}
                      onChange={(event) =>
                        setCreateOrderFormField(
                          'comment',
                          limitText(event.target.value, CUSTOMER_COMMENT_MAX_LENGTH),
                        )
                      }
                      className="mt-2 h-28 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                    <CharacterCounter
                      value={createOrderForm.comment}
                      maxLength={CUSTOMER_COMMENT_MAX_LENGTH}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Заметка работника</span>
                    <textarea
                      value={createOrderForm.staffNote}
                      maxLength={STAFF_NOTE_MAX_LENGTH}
                      onChange={(event) =>
                        setCreateOrderFormField(
                          'staffNote',
                          limitText(event.target.value, STAFF_NOTE_MAX_LENGTH),
                        )
                      }
                      className="mt-2 h-28 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                    <CharacterCounter
                      value={createOrderForm.staffNote}
                      maxLength={STAFF_NOTE_MAX_LENGTH}
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Проверьте данные перед сохранением</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={handleCloseCreateOrder}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateAdminOrder}
                      disabled={createOrderLoading}
                      className="rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70"
                    >
                      {createOrderLoading ? 'Сохраняем...' : 'Создать заказ'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mb-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-4 shadow-xl shadow-slate-200/70 sm:p-5 xl:col-span-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Фильтр отчёта</h2>
                <p className="text-sm text-slate-500">
                  {reportSummary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileReportFiltersOpen((value) => !value)}
                className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:hidden"
              >
                {mobileReportFiltersOpen ? 'Скрыть' : 'Настроить отчёт'}
              </button>
              <p className="hidden text-sm text-slate-500 sm:block">
                Эти фильтры управляют финансами, топами и аналитикой ниже
              </p>
              <button
                type="button"
                onClick={() => {
                  setReportPeriod('all')
                  setReportDateFrom('')
                  setReportDateTo('')
                  setReportClientType('all')
                  setReportReceivingType('all')
                  setReportStatusMode('all')
                }}
                className={`${mobileReportFiltersOpen ? 'block' : 'hidden'} rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:block`}
              >
                Сбросить фильтры
              </button>
            </div>
            <div className={`${mobileReportFiltersOpen ? 'flex' : 'hidden'} mt-4 flex-wrap gap-2 sm:flex`}>
              {ADMIN_PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setReportPeriod(option.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                    reportPeriod === option.id
                      ? 'bg-brand-700 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {reportPeriod === 'custom' && (
              <div className={`${mobileReportFiltersOpen ? 'grid' : 'hidden'} mt-4 gap-3 sm:grid sm:grid-cols-2 lg:w-[24rem]`}>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Дата С</span>
                  <input
                    type="date"
                    value={reportDateFrom}
                    onChange={(event) => setReportDateFrom(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Дата ПО</span>
                  <input
                    type="date"
                    value={reportDateTo}
                    onChange={(event) => setReportDateTo(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </label>
              </div>
            )}

            <div className={`${mobileReportFiltersOpen ? 'grid' : 'hidden'} mt-4 gap-3 sm:grid lg:grid-cols-3`}>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Тип клиента</span>
                <select
                  value={reportClientType}
                  onChange={(event) => setReportClientType(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                >
                  {REPORT_CLIENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'Все клиенты' : option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Получение</span>
                <select
                  value={reportReceivingType}
                  onChange={(event) => setReportReceivingType(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                >
                  {REPORT_RECEIVING_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === 'all' ? 'Все способы' : option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Режим заказов</span>
                <select
                  value={reportStatusMode}
                  onChange={(event) => setReportStatusMode(event.target.value as AdminReportStatusMode)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                >
                  {REPORT_STATUS_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-xl shadow-slate-200/70 sm:p-5 xl:col-span-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Финансы за выбранный период</h2>
                <p className="text-sm text-slate-500">
                  Отчёт: {reportSummary}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <p className="text-sm font-bold text-brand-700">
                  {reportOrders.length} заказов
                </p>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void copyReportToClipboard()}
                    className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-100"
                  >
                    {reportCopied ? 'Отчёт скопирован' : 'Скопировать отчёт'}
                  </button>
                  {isOwner && (
                  <button
                    type="button"
                    onClick={() => void downloadExcelReport()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
                  >
                    <Download className="h-4 w-4" />
                    Скачать отчёт
                  </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
              <div className="rounded-2xl bg-emerald-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Выручка</p>
                <p className="mt-1 text-base font-bold text-emerald-900 sm:text-xl">
                  {formatCurrency(orderAnalytics.completedRevenue)}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Ожидаемая сумма</p>
                <p className="mt-1 text-base font-bold text-amber-900 sm:text-xl">
                  {formatCurrency(orderAnalytics.expectedAmount)}
                </p>
              </div>
              <div className="hidden rounded-2xl bg-slate-100 px-3 py-2 sm:px-4 sm:py-3 lg:block">
                <p className="text-xs font-semibold uppercase text-slate-500">Отменённая сумма</p>
                <p className="mt-1 text-xl font-bold text-slate-800">
                  {formatCurrency(orderAnalytics.cancelledAmount)}
                </p>
              </div>
              <div className="rounded-2xl bg-brand-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-brand-700">Общий оборот</p>
                <p className="mt-1 text-base font-bold text-brand-900 sm:text-xl">
                  {formatCurrency(orderAnalytics.totalTurnover)}
                </p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-sky-700">Средний чек</p>
                <p className="mt-1 text-base font-bold text-sky-900 sm:text-xl">
                  {formatCurrency(orderAnalytics.averageCheck)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-slate-400">Всего кг</p>
                <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                  {formatKg(orderAnalytics.totalWeightKg)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-slate-400">Выполнено кг</p>
                <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                  {formatKg(orderAnalytics.completedWeightKg)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-slate-400">Ожидается кг</p>
                <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                  {formatKg(orderAnalytics.expectedWeightKg)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 sm:py-3">
                <p className="text-xs font-semibold uppercase text-slate-400">Отменено кг</p>
                <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                  {formatKg(orderAnalytics.cancelledWeightKg)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/70">
            <h2 className="text-lg font-bold text-slate-900">Топ товаров</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Товар</th>
                    <th className="px-3 py-2 text-right">Количество</th>
                    <th className="px-3 py-2 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderAnalytics.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-5 text-center text-slate-500">
                        Нет товаров в выбранных заказах.
                      </td>
                    </tr>
                  ) : (
                    orderAnalytics.topProducts.map((item) => (
                      <tr key={item.productName}>
                        <td className="px-3 py-2 font-semibold text-slate-800">{item.productName}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatKg(item.totalQuantityKg)}</td>
                        <td className="px-3 py-2 text-right font-bold text-brand-800">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/70">
            <h2 className="text-lg font-bold text-slate-900">Типы клиентов</h2>
            <div className="mt-4 space-y-2">
              {orderAnalytics.clientTypes.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  Нет данных по клиентам.
                </p>
              ) : (
                orderAnalytics.clientTypes.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{item.label}</p>
                      <p className="text-sm text-slate-500">{item.count} заказов</p>
                    </div>
                    <p className="text-right font-bold text-brand-800">{formatCurrency(item.totalAmount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/70">
            <h2 className="text-lg font-bold text-slate-900">Получение</h2>
            <div className="mt-4 space-y-2">
              {orderAnalytics.receivingTypes.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  Нет данных по получению.
                </p>
              ) : (
                orderAnalytics.receivingTypes.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-bold text-slate-900">{item.label}</p>
                      <p className="text-sm text-slate-500">{item.count} заказов</p>
                    </div>
                    <p className="text-right font-bold text-brand-800">{formatCurrency(item.totalAmount)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/70">
            <h2 className="text-lg font-bold text-slate-900">Быстрый расчёт</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Цена за кг</span>
                <input
                  type="number"
                  value={quickCalcPrice}
                  onChange={(event) => setQuickCalcPrice(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Количество кг</span>
                <input
                  type="number"
                  value={quickCalcQuantity}
                  onChange={(event) => setQuickCalcQuantity(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                />
              </label>
            </div>
            <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-brand-700">Итог</p>
              <p className="mt-1 text-2xl font-bold text-brand-900">
                {formatCurrency(quickCalcTotal)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {toNumber(quickCalcPrice).toLocaleString('ru-RU')} × {toNumber(quickCalcQuantity).toLocaleString('ru-RU')} кг
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuickCalcPrice('')
                setQuickCalcQuantity('')
              }}
              className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Очистить
            </button>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between gap-3 sm:hidden">
          <p className="text-sm font-semibold text-slate-700">Найдено заказов: {filteredOrders.length}</p>
          {isOwner && (
          <button
            type="button"
            onClick={handleCreateOrderButton}
            disabled={productsLoading || availableProducts.length === 0}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-4 w-4" />
            Создать
          </button>
          )}
        </div>

        <div className="mb-4 hidden rounded-3xl bg-white p-4 shadow-xl shadow-slate-200/60 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm text-slate-600">Найдено заказов: {filteredOrders.length}</p>
          {isOwner && (
            <button
              type="button"
              onClick={handleCreateOrderButton}
              disabled={productsLoading || availableProducts.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Создать заказ
            </button>
          )}
        </div>

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
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {formatAdminDate(order.created_at)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h2 className="text-lg font-bold text-slate-900">
                          {order.customer_name || 'Без имени'}
                        </h2>
                        <a
                          href={`https://wa.me/${normalizePhone(order.customer_phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-bold text-brand-700 hover:underline"
                        >
                          {formatPhoneForDisplay(normalizePhone(order.customer_phone))}
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getAdminStatusClass(order.status)}`}
                      >
                        {ADMIN_STATUS_LABELS[order.status]}
                      </span>
                      {order.archived_at && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          <Archive className="h-3.5 w-3.5" />
                          Архив
                        </span>
                      )}
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
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/${normalizePhone(order.customer_phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1ebe5d]"
                    >
                      WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyOrderToClipboard(order)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      {copiedOrderId === order.id ? 'Скопировано' : 'Скопировать заказ'}
                    </button>
                    {isOwner && (order.archived_at ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void restoreOrder(order.id)}
                          disabled={archivingOrderId === order.id || deletingOrderId === order.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Восстановить
                        </button>
                        {showArchivedOrders && (
                          <button
                            type="button"
                            onClick={() => void deleteArchivedOrderForever(order.id)}
                            disabled={deletingOrderId === order.id || archivingOrderId === order.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-70"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingOrderId === order.id ? 'Удаляем...' : 'Удалить навсегда'}
                          </button>
                        )}
                      </>
                    ) : (
                      (order.status === 'completed' || order.status === 'cancelled') && (
                        <button
                          type="button"
                          onClick={() => void archiveOrder(order.id)}
                          disabled={archivingOrderId === order.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-100 disabled:cursor-wait disabled:opacity-70"
                        >
                          <Archive className="h-4 w-4" />
                          В архив
                        </button>
                      )
                    ))}
                  </div>

                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Тип клиента
                      </dt>
                      <dd className="font-semibold text-slate-800">{normalizeClientTypeLabel(order.client_type)}</dd>
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
                    {order.delivery_address && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Адрес доставки
                        </dt>
                        <dd className="font-semibold text-slate-800">
                          <CollapsibleText text={order.delivery_address} />
                        </dd>
                      </div>
                    )}
                    {order.comment && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Комментарий
                        </dt>
                        <dd className="font-semibold text-slate-800">
                          <CollapsibleText text={order.comment} />
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="border-b border-slate-100 px-5 py-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-bold text-slate-800">Заметка работника</h3>
                      {editingStaffNoteOrderId !== order.id && (
                        <button
                          type="button"
                          onClick={() => startEditStaffNote(order)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          {order.staff_note ? 'Редактировать заметку' : 'Добавить заметку'}
                        </button>
                      )}
                    </div>

                    {editingStaffNoteOrderId === order.id ? (
                      <div className="mt-3">
                        <textarea
                          value={staffNoteDraft}
                          maxLength={STAFF_NOTE_MAX_LENGTH}
                          onChange={(event) =>
                            setStaffNoteDraft(limitText(event.target.value, STAFF_NOTE_MAX_LENGTH))
                          }
                          rows={4}
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                          placeholder="Внутренняя заметка для работников"
                        />
                        <CharacterCounter value={staffNoteDraft} maxLength={STAFF_NOTE_MAX_LENGTH} />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void saveStaffNote(order.id)}
                            disabled={savingStaffNoteOrderId === order.id}
                            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70"
                          >
                            {savingStaffNoteOrderId === order.id ? 'Сохраняем...' : 'Сохранить'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditStaffNote}
                            disabled={savingStaffNoteOrderId === order.id}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : order.staff_note ? (
                      <div className="mt-3 rounded-xl bg-white px-3 py-3">
                        <CollapsibleText
                          text={order.staff_note}
                          className="text-sm font-medium leading-relaxed text-slate-700"
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Заметки пока нет.</p>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
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

                  <h3 className="mb-2 text-sm font-bold text-slate-800">Товары заказа</h3>
                  {order.items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      Позиции заказа не найдены.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
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
          </>
        ) : activeAdminTab === 'products' ? (
          <AdminProductsPanel canManageProducts={isOwner} />
        ) : (
          <AdminClientsPanel
            canDeleteClients={isOwner}
            canEditClientNotes={isOwner}
            canEditClientStatus={isOwner}
          />
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
  const [onlyLowStock, setOnlyLowStock] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [isB2B, setIsB2B] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const cartSheetRef = useRef<HTMLDivElement | null>(null)
  const dragStartYRef = useRef<number | null>(null)
  const [cartDragOffset, setCartDragOffset] = useState(0)
  const [isCartDragging, setIsCartDragging] = useState(false)
  const productDetailsSheetRef = useRef<HTMLDivElement | null>(null)
  const productDetailsDragStartYRef = useRef<number | null>(null)
  const [productDetailsDragOffset, setProductDetailsDragOffset] = useState(0)
  const [isProductDetailsDragging, setIsProductDetailsDragging] = useState(false)
  const clientOrdersSheetRef = useRef<HTMLDivElement | null>(null)
  const clientOrdersDragStartYRef = useRef<number | null>(null)
  const [clientOrdersDragOffset, setClientOrdersDragOffset] = useState(0)
  const [isClientOrdersDragging, setIsClientOrdersDragging] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
  const [repeatedOrderId, setRepeatedOrderId] = useState<string | null>(null)
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const [analyticsOpenId, setAnalyticsOpenId] = useState<string | null>(null)
  const [cart, setCart] = useState<Cart>({})
  const [cartRestored, setCartRestored] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(() =>
    createCheckoutForm(true),
  )
  useEffect(() => {
    setCheckoutForm((prev) => ({
      ...prev,
      orderType: isB2B ? 'wholesale' : 'retail',
    }))
  }, [isB2B])
  const [checkoutErrors, setCheckoutErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({})
  const [checkoutSubmitError, setCheckoutSubmitError] = useState<string | null>(null)
  const [checkoutSuccessMessage, setCheckoutSuccessMessage] = useState<string | null>(null)
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details'>('cart')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [lastOrder, setLastOrder] = useState<SavedOrder | null>(null)
  const [orderHistory, setOrderHistory] = useState<SavedOrder[]>([])
  const [showMyOrders, setShowMyOrders] = useState(false)
  const [clientOrdersOpen, setClientOrdersOpen] = useState(false)
  const [clientOrders, setClientOrders] = useState<AdminOrder[]>([])
  const [clientOrdersError, setClientOrdersError] = useState<string | null>(null)
  const [clientOrdersSuccess, setClientOrdersSuccess] = useState<string | null>(null)
  const [cancellingClientOrderId, setCancellingClientOrderId] = useState<string | null>(null)
  const [hasSearchedClientOrders, setHasSearchedClientOrders] = useState(false)
  const [isLoadingClientOrders, setIsLoadingClientOrders] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [volumes, setVolumes] = useState<Record<string, ProductVolume>>(() =>
    Object.fromEntries(fallbackProducts.map((p) => [p.id, p.defaultVolume])),
  )

  const handleCartTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.touches[0].clientY
    setIsCartDragging(true)
  }

  const handleCartTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return

    const deltaY = event.touches[0].clientY - dragStartYRef.current

    if (deltaY <= 0) {
      setCartDragOffset(0)
      return
    }

    setCartDragOffset(Math.min(deltaY, 240))
  }

  const resetCartDrag = () => {
    dragStartYRef.current = null
    setCartDragOffset(0)
    setIsCartDragging(false)
  }

  const handleCartTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return

    const endY = event.changedTouches[0].clientY
    const deltaY = endY - dragStartYRef.current
    const shouldClose = deltaY > 100

    resetCartDrag()
    if (shouldClose) {
      setCartOpen(false)
    }
  }

  const handleCartTouchCancel = () => resetCartDrag()

  const handleProductDetailsTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    productDetailsDragStartYRef.current = event.touches[0].clientY
    setIsProductDetailsDragging(true)
  }

  const handleProductDetailsTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (productDetailsDragStartYRef.current === null) return

    const deltaY = event.touches[0].clientY - productDetailsDragStartYRef.current

    if (deltaY <= 0) {
      setProductDetailsDragOffset(0)
      return
    }

    setProductDetailsDragOffset(Math.min(deltaY, 240))
  }

  const resetProductDetailsDrag = () => {
    productDetailsDragStartYRef.current = null
    setProductDetailsDragOffset(0)
    setIsProductDetailsDragging(false)
  }

  const handleProductDetailsTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (productDetailsDragStartYRef.current === null) return

    const endY = event.changedTouches[0].clientY
    const deltaY = endY - productDetailsDragStartYRef.current
    const shouldClose = deltaY > 100

    resetProductDetailsDrag()
    if (shouldClose) {
      setAnalyticsOpenId(null)
    }
  }

  const handleProductDetailsTouchCancel = () => resetProductDetailsDrag()

  const handleClientOrdersTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    clientOrdersDragStartYRef.current = event.touches[0].clientY
    setIsClientOrdersDragging(true)
  }

  const handleClientOrdersTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (clientOrdersDragStartYRef.current === null) return

    const deltaY = event.touches[0].clientY - clientOrdersDragStartYRef.current

    if (deltaY <= 0) {
      setClientOrdersDragOffset(0)
      return
    }

    setClientOrdersDragOffset(Math.min(deltaY, 240))
  }

  const resetClientOrdersDrag = () => {
    clientOrdersDragStartYRef.current = null
    setClientOrdersDragOffset(0)
    setIsClientOrdersDragging(false)
  }

  const handleClientOrdersTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (clientOrdersDragStartYRef.current === null) return

    const endY = event.changedTouches[0].clientY
    const deltaY = endY - clientOrdersDragStartYRef.current
    const shouldClose = deltaY > 100

    resetClientOrdersDrag()
    if (shouldClose) {
      setClientOrdersOpen(false)
    }
  }

  const handleClientOrdersTouchCancel = () => resetClientOrdersDrag()

  useEffect(() => {
    if (!cartOpen) return

    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    const element = cartSheetRef.current

    const handleNativeTouchMove = (event: TouchEvent) => {
      if (dragStartYRef.current === null) return
      const deltaY = event.touches[0]?.clientY - dragStartYRef.current
      if (deltaY > 0) {
        event.preventDefault()
      }
    }

    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    if (element) {
      element.addEventListener('touchmove', handleNativeTouchMove, {
        passive: false,
      })
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction

      if (element) {
        element.removeEventListener('touchmove', handleNativeTouchMove)
      }
    }
  }, [cartOpen])

  useEffect(() => {
    if (!analyticsOpenId) return

    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    const element = productDetailsSheetRef.current

    const handleNativeTouchMove = (event: TouchEvent) => {
      if (productDetailsDragStartYRef.current === null) return
      const deltaY = event.touches[0]?.clientY - productDetailsDragStartYRef.current
      if (deltaY > 0) {
        event.preventDefault()
      }
    }

    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    if (element) {
      element.addEventListener('touchmove', handleNativeTouchMove, {
        passive: false,
      })
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
      resetProductDetailsDrag()

      if (element) {
        element.removeEventListener('touchmove', handleNativeTouchMove)
      }
    }
  }, [analyticsOpenId])

  useEffect(() => {
    if (!clientOrdersOpen) return

    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    const element = clientOrdersSheetRef.current

    const handleNativeTouchMove = (event: TouchEvent) => {
      if (clientOrdersDragStartYRef.current === null) return
      const deltaY = event.touches[0]?.clientY - clientOrdersDragStartYRef.current
      if (deltaY > 0) {
        event.preventDefault()
      }
    }

    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    if (element) {
      element.addEventListener('touchmove', handleNativeTouchMove, {
        passive: false,
      })
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
      resetClientOrdersDrag()

      if (element) {
        element.removeEventListener('touchmove', handleNativeTouchMove)
      }
    }
  }, [clientOrdersOpen])

  useEffect(() => {
    if (!cartOpen) {
      setCheckoutStep('cart')
      setCheckoutSuccessMessage(null)
    }
  }, [cartOpen])

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

    if (productsLoading || productsError) return

    const sanitizeCart = (nextCart: Cart) =>
      Object.fromEntries(
        Object.entries(nextCart).flatMap(([productId, volume]) => {
          const product = products.find((p) => p.id === productId)
          if (!product || !canOrderProduct(product, isB2B)) return []

          const nextVolume = snapVolume(volume, product, isB2B)
          return nextVolume > 0 ? [[productId, nextVolume]] : []
        }),
      )

    if (!cartRestored) {
      setCart(sanitizeCart(getSavedCart()))
      setCartRestored(true)
      return
    }

    setCart((prev) => sanitizeCart(prev))
  }, [cartRestored, isB2B, products, productsError, productsLoading])

  useEffect(() => {
    if (!cartRestored) return
    saveCartToLocalStorage(cart)
  }, [cart, cartRestored])

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const lowStockCount = useMemo(
    () => products.filter((product) => {
      const stock = getAvailableStockKg(product)
      return stock > 0 && stock <= 50
    }).length,
    [products],
  )

  const filteredProducts = useMemo(() => {
    const list = products.filter(
      (p) =>
        matchesTab(p, activeTab) &&
        matchesSearch(p, normalizedSearch) &&
        matchesWarehouse(p, warehouseFilter) &&
        matchesInStockOnly(p, onlyInStock) &&
        matchesLowStock(p, onlyLowStock),
    )
    return sortProducts(list, sortBy)
  }, [activeTab, normalizedSearch, warehouseFilter, onlyInStock, onlyLowStock, products, sortBy])

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
    onlyLowStock ||
    sortBy !== 'default'

  const setProductVolume = (product: Product, raw: number) => {
    const maxQuantity = getMaxOrderQuantityKg(product)
    if (maxQuantity && raw > maxQuantity) {
      setCartError(getStockLimitError(product))
    }

    setVolumes((prev) => ({
      ...prev,
      [product.id]: snapVolume(raw, product, isB2B),
    }))
  }

  const setProductVolumeInput = (product: Product, raw: string) => {
    setCartError(null)
    setVolumes((prev) => ({
      ...prev,
      [product.id]: sanitizeQuantityInput(raw),
    }))
  }

  const normalizeProductVolumeInput = (product: Product) => {
    const current = volumes[product.id]
    const minOrder = getMinimumOrderKg(isB2B)
    const maxQuantity = getMaxOrderQuantityKg(product)
    if (isB2B && current !== '' && Number.isFinite(current) && current > 0 && current < minOrder) {
      setCartError('Минимальный оптовый заказ — 25 кг')
    }
    if (maxQuantity && current !== '' && Number.isFinite(current) && current > maxQuantity) {
      setCartError(getStockLimitError(product))
    }

    setVolumes((prev) => {
      const current = prev[product.id]
      return {
        ...prev,
        [product.id]: snapVolume(getSafeProductVolume(current, product, isB2B), product, isB2B),
      }
    })
  }

  const decreaseProductVolume = (product: Product, currentVolume: number, step: number) => {
    setProductVolume(product, currentVolume - step)
  }

  const increaseProductVolume = (product: Product, rawVolume: ProductVolume, currentVolume: number, step: number) => {
    const maxQuantity = getMaxOrderQuantityKg(product)

    if (maxQuantity && rawVolume !== '' && currentVolume >= maxQuantity) {
      setCartError(getStockLimitError(product))
      setProductVolume(product, maxQuantity)
      return
    }

    setProductVolume(product, rawVolume === '' ? getMinimumOrderKg(isB2B) : currentVolume + step)
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
    if (selected === '' || !Number.isFinite(selected) || selected <= 0) {
      setCartError(`Укажите количество от ${formatStockAmount(minOrder)}.`)
      return
    }

    const maxQuantity = getMaxOrderQuantityKg(product)
    if (maxQuantity && selected > maxQuantity) {
      setCartError(getStockLimitError(product))
      return
    }

    if (selected < minOrder && isB2B) {
      setCartError('Минимальный оптовый заказ — 25 кг')
      return
    }

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

      if (maxQuantity && current + selected > maxQuantity) {
        setCartError(getStockLimitError(product))
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
      [product.id]: snapVolume(order.volume, product, isB2B),
    }))
    setProfileOpen(false)
    setCheckoutOpen(false)
    setCheckoutStep('cart')
    setCartOpen(true)
    setCartError('Товары добавлены в корзину')
    setRepeatedOrderId(order.id)
    window.setTimeout(() => setRepeatedOrderId(null), 1800)
  }

  const toggleAnalytics = (productId: string) => {
    setAnalyticsOpenId((current) => (current === productId ? null : productId))
  }

  const clearCart = () => {
    setCartError(null)
    setCart({})
    localStorage.removeItem(LOCAL_STORAGE_CART)
    setCheckoutOpen(false)
    setCheckoutErrors({})
    setCheckoutSubmitError(null)
    setCheckoutSuccessMessage(null)
    setCheckoutStep('cart')
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
      nextErrors.phone = 'Введите номер Казахстана в формате +7 700 000 00 00'
    }
    // order type and customer type are determined automatically by site mode (isB2B)
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
    setCheckoutSuccessMessage(null)
    setCheckoutForm((prev) => ({
      ...prev,
      orderType: isB2B ? 'wholesale' : 'retail',
    }))
    setCartOpen(false)
    setCheckoutStep('details')
    setCheckoutOpen(true)
  }

  const saveCheckoutOrderToSupabase = async (normalizedPhone: string) => {
    const customerName = checkoutForm.name.trim()
    if (!isValidNormalizedPhone(normalizedPhone)) {
      throw new Error('Введите корректный номер телефона перед сохранением заказа.')
    }

    const linesWithoutProductId = cartLines.filter(
      (line) => !String(line.product.id ?? '').trim(),
    )
    if (linesWithoutProductId.length > 0) {
      throw new Error('У товара нет id. Обновите страницу и добавьте товар заново.')
    }

    const productIds = Array.from(
      new Set(cartLines.map((line) => String(line.product.id))),
    )

    console.log('Cart lines before checkout:', cartLines)
    console.log('Cart product ids:', productIds)

    const { data: existingProducts, error: productsError } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)

    if (productsError) {
      throw new Error(`Не удалось проверить товары в корзине: ${productsError.message}`)
    }

    console.log('Existing product ids from Supabase:', existingProducts)
    const existingIds = new Set((existingProducts ?? []).map((product) => String(product.id)))
    const missingItems = cartLines.filter((line) => !existingIds.has(String(line.product.id)))

    if (missingItems.length > 0) {
      throw new Error('Товар в корзине устарел. Очистите корзину и добавьте товар заново.')
    }

    const clientType = isB2B ? CUSTOMER_TYPE_LABELS['wholesale'] : CUSTOMER_TYPE_LABELS['retail']
    const orderType = isB2B ? ORDER_TYPE_LABELS['wholesale'] : ORDER_TYPE_LABELS['retail']
    const receivingType = FULFILLMENT_LABELS[checkoutForm.fulfillment as FulfillmentType]
    const deliveryAddress =
      checkoutForm.fulfillment === 'delivery'
        ? limitText(checkoutForm.address.trim(), DELIVERY_ADDRESS_MAX_LENGTH) || null
        : null
    const comment = limitText(checkoutForm.comment.trim(), CUSTOMER_COMMENT_MAX_LENGTH) || null
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
        product_id: String(line.product.id),
        product_name: line.product.name,
        quantity_kg: line.volume,
        price_per_kg: pricePerKg,
        total_amount: line.total,
      }
    })

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

    if (itemsError) {
      const { error: cleanupError } = await supabase.from('orders').delete().eq('id', order.id)
      const cleanupMessage = cleanupError
        ? ` Пустой заказ не удалось удалить автоматически: ${cleanupError.message}`
        : ''
      throw new Error(`Не удалось сохранить товары заказа. Заказ отменён.${cleanupMessage} Ошибка: ${itemsError.message}`)
    }

    return String(order.id)
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
        phone: 'Введите номер Казахстана в формате +7 700 000 00 00',
      }))
      return
    }

    setCartError(null)
    setCheckoutSubmitError(null)
    setIsSubmittingOrder(true)

    try {
      const createdOrderId = await saveCheckoutOrderToSupabase(normalizedPhone)
      saveOrderIdToLocalStorage(createdOrderId)

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
      setCheckoutSuccessMessage('Заказ создан. Сейчас откроется WhatsApp.')
      setCart({})
      localStorage.removeItem(LOCAL_STORAGE_CART)
      setCartError(null)
      setCheckoutErrors({})
      setCheckoutSubmitError(null)

      window.setTimeout(() => {
        window.location.href = whatsappUrl
      }, 500)
    } catch (error) {
      setCheckoutSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  const mapClientOrderItem = (item: Record<string, unknown>): AdminOrderItem => ({
    id: String(item.id),
    order_id: String(item.order_id),
    product_id: item.product_id === null || item.product_id === undefined ? null : toNumber(item.product_id),
    product_name: String(item.product_name ?? 'Товар'),
    quantity_kg: toNumber(item.quantity_kg),
    price_per_kg: toNumber(item.price_per_kg),
    total_amount: toNumber(item.total_amount),
    created_at: typeof item.created_at === 'string' ? item.created_at : null,
  })

  const mapClientOrder = (
    order: Record<string, unknown>,
    itemsByOrder: Map<string, AdminOrderItem[]>,
  ): AdminOrder => ({
    id: String(order.id),
    client_id: order.client_id ? String(order.client_id) : null,
    customer_name: String(order.customer_name ?? ''),
    customer_phone: String(order.customer_phone ?? ''),
    client_type: String(order.client_type ?? ''),
    order_type: String(order.order_type ?? ''),
    receiving_type: String(order.receiving_type ?? ''),
    delivery_address: typeof order.delivery_address === 'string' ? order.delivery_address : null,
    comment: typeof order.comment === 'string' ? order.comment : null,
    total_weight_kg: toNumber(order.total_weight_kg),
    total_amount: toNumber(order.total_amount),
    status: normalizeAdminStatus(order.status),
    archived_at: typeof order.archived_at === 'string' ? order.archived_at : null,
    created_at: String(order.created_at ?? ''),
    items: itemsByOrder.get(String(order.id)) ?? [],
  })

  const loadClientOrders = async () => {
    const storedOrderIds = getStoredOrderIds()

    if (storedOrderIds.length === 0) {
      setClientOrders([])
      setClientOrdersError(null)
      setClientOrdersSuccess(null)
      setHasSearchedClientOrders(true)
      return
    }

    setIsLoadingClientOrders(true)
    setClientOrdersError(null)
    setClientOrdersSuccess(null)
    setHasSearchedClientOrders(true)

    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('id', storedOrderIds)
        .order('created_at', { ascending: false })

      if (ordersError) {
        throw new Error(`Не удалось загрузить заказы с этого устройства: ${ordersError.message}`)
      }

      const uniqueOrders = ((ordersData ?? []) as Record<string, unknown>[]).sort((a, b) => {
        const aTime = new Date(String(a.created_at ?? '')).getTime()
        const bTime = new Date(String(b.created_at ?? '')).getTime()
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
      })
      setStoredOrderIds(uniqueOrders.map((order) => String(order.id)))

      const orderIds = uniqueOrders.map((order) => String(order.id))
      const { data: itemsData, error: itemsError } =
        orderIds.length > 0
          ? await supabase.from('order_items').select('*').in('order_id', orderIds)
          : { data: [], error: null }

      if (itemsError) {
        throw new Error(`Не удалось загрузить товары заказов: ${itemsError.message}`)
      }

      const itemsByOrder = new Map<string, AdminOrderItem[]>()
      ;((itemsData ?? []) as Record<string, unknown>[]).forEach((item) => {
        const orderId = String(item.order_id)
        itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), mapClientOrderItem(item)])
      })

      setClientOrders(uniqueOrders.map((order) => mapClientOrder(order, itemsByOrder)))
    } catch (error) {
      setClientOrders([])
      setClientOrdersError(getErrorMessage(error))
    } finally {
      setIsLoadingClientOrders(false)
    }
  }

  const cancelClientOrder = async (order: AdminOrder) => {
    if (order.archived_at || (order.status !== 'new' && order.status !== 'processing')) return

    const storedOrderIds = getStoredOrderIds()
    if (!storedOrderIds.includes(order.id)) {
      setClientOrdersError('Не удалось отменить заказ. Попробуйте ещё раз.')
      return
    }

    const confirmed = window.confirm('Вы уверены, что хотите отменить заказ?')
    if (!confirmed) return

    setCancellingClientOrderId(order.id)
    setClientOrdersError(null)
    setClientOrdersSuccess(null)

    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .in('status', ['new', 'processing'])
        .is('archived_at', null)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data?.id) {
        throw new Error('Не удалось отменить заказ. Попробуйте ещё раз.')
      }

      setClientOrders((prev) =>
        prev.map((clientOrder) =>
          clientOrder.id === order.id ? { ...clientOrder, status: 'cancelled' } : clientOrder,
        ),
      )
      setClientOrdersSuccess('Заказ отменён')
    } catch (error) {
      setClientOrdersError(getErrorMessage(error) || 'Не удалось отменить заказ. Попробуйте ещё раз.')
    } finally {
      setCancellingClientOrderId(null)
    }
  }

  const repeatClientOrder = (order: AdminOrder) => {
    const nextCart: Cart = {}
    const targetIsB2B =
      order.order_type === ORDER_TYPE_LABELS.wholesale ||
      normalizeClientTypeLabel(order.client_type) === CUSTOMER_TYPE_LABELS.wholesale

    order.items.forEach((item) => {
      if (item.product_id === null) return

      const product = products.find((product) => String(product.id) === String(item.product_id))
      if (!product || !canOrderProduct(product, targetIsB2B)) return

      nextCart[product.id] = snapVolume(item.quantity_kg, product, targetIsB2B)
    })

    if (Object.keys(nextCart).length === 0) {
      setClientOrdersError('Не удалось повторить заказ: товары больше недоступны.')
      return
    }

    setIsB2B(targetIsB2B)
    setCart(nextCart)
    setCheckoutOpen(false)
    setCheckoutStep('cart')
    setClientOrdersOpen(false)
    setCartOpen(true)
    setCartError('Товары добавлены в корзину')
  }

  const handleRepeatLastOrder = () => {
    if (!lastOrder) return
    const nextCart: Cart = {}
    lastOrder.items.forEach((item) => {
      nextCart[item.productId] = item.volume
    })
    setCart(nextCart)
    setCheckoutOpen(false)
    setCheckoutStep('cart')
    setCartOpen(true)
    setCartError('Товары добавлены в корзину')
  }

  const popularProducts = useMemo(() => {
    const availableProducts = products.filter(
      (product) => product.is_active !== false && canOrderProduct(product, isB2B),
    )
    const flaggedProducts = availableProducts.filter((product) => product.is_popular)

    return (flaggedProducts.length > 0 ? flaggedProducts : availableProducts).slice(0, 5)
  }, [isB2B, products])
  const detailProduct = analyticsOpenId
    ? products.find((product) => product.id === analyticsOpenId) ?? null
    : null
  const detailProductConfig = detailProduct ? getProductDisplayConfig(detailProduct, isB2B) : null
  const detailProductRawVolume = detailProduct
    ? volumes[detailProduct.id] ?? detailProductConfig?.defaultVolume ?? 0
    : 0
  const detailProductVolume = detailProduct
    ? getSafeProductVolume(detailProductRawVolume, detailProduct, isB2B)
    : 0
  const detailProductPricing = detailProduct
    ? calcPricing(detailProduct, detailProductVolume, isB2B)
    : { discount: 0, pricePerKg: 0, total: 0 }
  const detailSecondaryPrice = detailProduct
    ? isB2B
      ? detailProduct.retail_price ?? detailProduct.basePrice + RETAIL_MARKUP
      : detailProduct.wholesale_price ?? detailProduct.basePrice
    : 0
  const detailPrimaryPriceLabel = isB2B ? 'Оптовая цена' : 'Розничная цена'
  const detailSecondaryPriceLabel = isB2B ? 'Розница' : 'Опт'
  const detailProductStockDisplay = detailProduct ? getStockDisplay(detailProduct) : null

  return (
    <div className="min-h-dvh bg-slate-100 pb-28 lg:pb-10">
      <div className="relative border-b border-slate-200 bg-white shadow-sm">
        <header className="border-b border-brand-800/20 bg-brand-900 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white lg:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                URALSK VEG OPI
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                ОПТ ОВОЩИ УРАЛЬСК
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-emerald-100/90 sm:text-base">
                Овощи оптом и в розницу в Уральске
              </p>
            </div>

            <div className="mt-2 flex items-center gap-2 sm:mt-0 sm:flex-wrap sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setClientOrdersOpen(true)
                  void loadClientOrders()
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 active:scale-95"
                aria-label="Заказы"
              >
                <Package className="h-4 w-4" strokeWidth={2} />
                <span className="text-xs font-semibold whitespace-nowrap">Заказы</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckoutStep('cart')
                  setCartOpen(true)
                }}
                className="relative inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-400 active:scale-95"
                aria-label={`Корзина: ${cartCount} позиций`}
              >
                <ShoppingCart className="h-4 w-4" strokeWidth={2} />
                <span className="text-xs font-semibold whitespace-nowrap">Корзина</span>
                {cartCount > 0 && (
                  <span className="absolute -right-2 -top-2 inline-flex items-center justify-center rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-white/10 p-1 text-sm text-white sm:max-w-md" role="tablist" aria-label="Тип покупателя">
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
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              aria-label="Поиск овощей"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                aria-label="Очистить поиск"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-700/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyLowStock((value) => !value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                onlyLowStock
                  ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-700/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              aria-pressed={onlyLowStock}
            >
              Мало остатка{lowStockCount > 0 ? ` (${lowStockCount})` : ''}
            </button>
          </div>

          <div className="mt-4 grid gap-3 rounded-3xl bg-emerald-50/90 p-4 text-sm text-emerald-950 shadow-sm sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-3xl bg-white p-3 shadow-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="font-semibold">Цены и остатки актуальны</p>
                <p className="mt-1 text-xs text-emerald-800/80">Мы обновляем данные ежедневно</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-3xl bg-white p-3 shadow-sm">
              <ShoppingCart className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="font-semibold">Заказ через WhatsApp</p>
                <p className="mt-1 text-xs text-emerald-800/80">Удобно оформить заказ одним сообщением</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-3xl bg-white p-3 shadow-sm">
              <Truck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="font-semibold">Самовывоз или доставка</p>
                <p className="mt-1 text-xs text-emerald-800/80">Выберите удобный способ получения</p>
              </div>
            </div>
          </div>

          {popularProducts.length > 0 && (
            <section className="mt-5 lg:hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">Популярные овощи</p>
                  <p className="mt-1 text-sm text-slate-500">Лучшие предложения сегодня</p>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Смотреть все
                </button>
              </div>
              <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
                <div className="flex w-max gap-3 snap-x snap-mandatory touch-pan-x">
                  {popularProducts.map((product) => {
                    const productImage = product.image_url || product.image
                    const stockDisplay = getStockDisplay(product)
                    const isProductInStock = product.in_stock !== false
                    const pricing = calcPricing(
                      product,
                      getProductDisplayConfig(product, isB2B).defaultVolume,
                      isB2B,
                    )
                    const cannotOrderProduct = !canOrderProduct(product, isB2B)
                    const justAdded = addedProductId === product.id

                    return (
                      <article
                        key={product.id}
                        className="flex h-[350px] w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="relative h-[140px] w-full overflow-hidden rounded-t-2xl bg-white p-2">
                          <ProductImage
                            src={productImage}
                            alt={product.name}
                            className="h-full w-full"
                            imgClassName="block h-full w-full object-contain object-center"
                            fallbackClassName="flex h-full items-center justify-center text-sm font-semibold text-slate-500"
                          />
                        </div>
                        <div className="space-y-1.5 overflow-hidden p-3">
                          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {product.category ?? product.subtitle}
                          </p>
                          <h3 className="line-clamp-2 min-h-9 text-sm font-bold leading-tight text-slate-900">{product.name}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusToneClass[product.statusTone]}`}>
                              {product.is_in_transit ? 'В пути' : isProductInStock ? 'В наличии' : 'Нет в наличии'}
                            </span>
                          </div>
                          <p className="truncate text-[11px] font-semibold text-slate-500">{stockDisplay.label}</p>
                          <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{isB2B ? 'Опт' : 'Розница'}</p>
                            <p className="mt-1 font-bold text-slate-900">{formatCurrency(pricing.pricePerKg)}/кг</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            disabled={cannotOrderProduct}
                            className={`mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold text-white transition active:scale-[0.98] ${
                              cannotOrderProduct
                                ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                                : justAdded
                                  ? 'bg-emerald-700'
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">
                              {cannotOrderProduct ? 'Недоступно' : justAdded ? 'Добавлено' : 'В корзину'}
                            </span>
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          <div
            className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50/90 p-2.5 md:flex md:items-center md:gap-3 md:space-y-0"
            aria-label="Расширенные фильтры"
          >
            <div className="flex items-center gap-2 md:min-w-[17rem]">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value as WarehouseFilterId)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
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
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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
          <div id="product-grid" className="grid gap-4 pb-32 md:grid-cols-2 md:pb-0 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const rawVolume = volumes[product.id] ?? getProductDisplayConfig(product, isB2B).defaultVolume
              const volume = getSafeProductVolume(rawVolume, product, isB2B)
                          const { pricePerKg } = calcPricing(product, volume, isB2B)
                          const inCart = product.id in cart
                          const justAdded = addedProductId === product.id
              const cannotOrderProduct = !canOrderProduct(product, isB2B)
              const productImage = product.image_url || product.image
              const secondaryPrice = isB2B
                ? product.retail_price ?? product.basePrice + RETAIL_MARKUP
                : product.wholesale_price ?? product.basePrice
              const primaryPriceLabel = isB2B ? 'Оптовая цена' : 'Розничная цена'
              const secondaryPriceLabel = isB2B ? 'Розница' : 'Опт'
              const isProductInStock = product.in_stock !== false
              const mobilePrimaryPriceLabel = isB2B ? 'Опт' : 'Розница'
              const mobilePrimaryPrice = isB2B
                ? product.wholesale_price ?? product.basePrice
                : product.retail_price ?? product.basePrice + RETAIL_MARKUP
              const mobileSecondaryPriceLabel = isB2B ? 'Розница' : 'Опт'
              const mobileSecondaryPrice = isB2B
                ? product.retail_price ?? product.basePrice + RETAIL_MARKUP
                : product.wholesale_price ?? product.basePrice
              const isUnavailable = product.in_stock === false && product.is_in_transit !== true
              const compactMeta = [product.variant, product.origin, product.subtitle].filter(Boolean).join(' · ')
              const cfg = getProductDisplayConfig(product, isB2B)
              const step = isB2B ? 25 : 1
              const canDecrease = volume > cfg.sliderMin

              return (
                <article
                  key={product.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md lg:rounded-3xl lg:border-0"
                >
                  <div className="relative h-[250px] w-full overflow-hidden rounded-t-2xl bg-white p-3 lg:h-52 lg:rounded-t-3xl lg:p-4">
                    <ProductImage
                      src={productImage}
                      alt={product.name}
                      className="h-full w-full"
                      imgClassName="block h-full w-full object-contain object-center"
                      fallbackClassName="flex h-full items-center justify-center text-sm font-semibold text-slate-500"
                    />
                    {inCart && (
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                        В корзине
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5 p-3 lg:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {product.category ?? product.subtitle}
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-base font-bold leading-tight text-slate-900">
                          {product.name}
                        </h3>
                        {compactMeta && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                            {compactMeta}
                          </p>
                        )}
                      </div>
                      <span className={`ml-2 max-w-[5.75rem] shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${statusToneClass[product.statusTone]}`}>
                        {product.is_in_transit ? 'В пути' : isProductInStock ? 'В наличии' : 'Нет в наличии'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleAnalytics(product.id)}
                      className="w-fit text-xs font-semibold text-brand-700 underline-offset-2 hover:underline"
                    >
                      Подробнее о товаре
                    </button>

                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-base font-bold leading-tight text-brand-800">
                        {mobilePrimaryPriceLabel}: {formatCurrency(mobilePrimaryPrice)}/кг
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {mobileSecondaryPriceLabel}: {formatCurrency(mobileSecondaryPrice)}/кг
                      </p>
                      <div className="hidden">
                      <p className="text-base font-bold leading-tight text-brand-800">
                        Опт: {formatCurrency(isB2B ? pricePerKg : secondaryPrice)}/кг
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        Розница: {formatCurrency(isB2B ? secondaryPrice : pricePerKg)}/кг
                      </p>
                      <div className="hidden">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{primaryPriceLabel}</p>
                        <p className="mt-1 text-lg font-bold text-brand-900">{formatCurrency(pricePerKg)}/кг</p>
                      </div>
                      <p className="text-xs text-slate-500">{secondaryPriceLabel}: {formatCurrency(secondaryPrice)}/кг</p>
                    </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="inline-flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-1">
                        <button
                          type="button"
                          onClick={() => decreaseProductVolume(product, volume, step)}
                          disabled={!canDecrease}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          aria-label={`Уменьшить количество ${product.name}`}
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <div className="flex min-w-[7rem] items-center justify-center gap-1 px-1 text-sm font-bold text-slate-900">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={QUANTITY_INPUT_MAX_LENGTH}
                            value={rawVolume === '' ? '' : String(rawVolume)}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => setProductVolumeInput(product, event.target.value)}
                            onBlur={() => normalizeProductVolumeInput(product)}
                            disabled={cannotOrderProduct}
                            className="h-8 w-20 max-w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-bold text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:text-slate-300"
                            aria-label={`Количество ${product.name} в кг`}
                          />
                          <span>кг</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => increaseProductVolume(product, rawVolume, volume, step)}
                          disabled={cannotOrderProduct}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          aria-label={`Увеличить количество ${product.name}`}
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      </div>

                      <div className="flex w-full min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={cannotOrderProduct}
                          className={`flex h-12 w-full min-w-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl px-3 text-[0] font-semibold text-white transition active:scale-[0.98] ${
                            cannotOrderProduct
                              ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                              : justAdded
                              ? 'bg-emerald-700 shadow-emerald-700/20'
                              : 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700'
                          }`}
                        >
                          <Plus className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate text-sm">
                            {cannotOrderProduct ? (isUnavailable ? 'Нет' : 'Мало') : (justAdded ? 'Добавлено' : 'В корзину')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAnalytics(product.id)}
                          className="hidden"
                        >
                          Подробнее
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="hidden lg:flex flex-1 flex-col space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                          {product.category ?? product.subtitle}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900 truncate">
                          {product.name}
                        </h2>
                        {compactMeta && (
                          <p className="mt-1 text-sm text-slate-500 truncate">
                            {compactMeta}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusToneClass[product.statusTone]}`}>
                        {product.is_in_transit ? 'В пути' : isProductInStock ? 'В наличии' : 'Нет в наличии'}
                      </span>
                    </div>

                    <div className="rounded-[28px] bg-slate-50 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                            {primaryPriceLabel}
                          </p>
                          <p className="mt-1 text-2xl font-bold text-brand-900">
                            {formatCurrency(pricePerKg)}/кг
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {secondaryPriceLabel}: {formatCurrency(secondaryPrice)}/кг
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => decreaseProductVolume(product, volume, step)}
                          disabled={!canDecrease}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          aria-label={`Уменьшить количество ${product.name}`}
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <div className="min-w-[7.5rem] text-center">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={QUANTITY_INPUT_MAX_LENGTH}
                              value={rawVolume === '' ? '' : String(rawVolume)}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) => setProductVolumeInput(product, event.target.value)}
                              onBlur={() => normalizeProductVolumeInput(product)}
                              disabled={cannotOrderProduct}
                              className="h-9 w-20 max-w-20 overflow-hidden rounded-xl border border-slate-200 bg-white text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:text-slate-300"
                              aria-label={`Количество ${product.name} в кг`}
                            />
                            <span className="text-sm font-semibold text-slate-900">кг</span>
                          </div>
                          <p className="text-[11px] text-slate-500">количество</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => increaseProductVolume(product, rawVolume, volume, step)}
                          disabled={cannotOrderProduct}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                          aria-label={`Увеличить количество ${product.name}`}
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={cannotOrderProduct}
                        className={`flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition active:scale-[0.98] ${
                          cannotOrderProduct
                            ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                            : justAdded
                            ? 'bg-emerald-700 shadow-emerald-700/20'
                            : 'bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700'
                        }`}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        {cannotOrderProduct
                          ? isUnavailable
                            ? 'Нет в наличии'
                            : 'Недостаточно остатка'
                          : justAdded
                            ? 'Добавлено'
                            : inCart
                              ? 'Добавить ещё'
                              : 'В корзину'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAnalytics(product.id)}
                        className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Подробнее
                      </button>
                    </div>
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
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
                    <ShoppingCart className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-800">Корзина пока пустая</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Выберите товар и нажмите «В корзину».
                  </p>
                </div>
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
        <div className="fixed inset-x-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 backdrop-blur-sm lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Корзина • {cartCount} {cartCount === 1 ? 'товар' : cartCount < 5 ? 'товара' : 'товаров'}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrency(cartGrandTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCheckoutStep('cart')
                setCartOpen(true)
              }}
              className="inline-flex min-w-[9rem] items-center justify-center rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-600 active:scale-[0.98]"
            >
              Оформить
            </button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] overscroll-contain touch-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-modal-title"
          onClick={() => setCartOpen(false)}
        >
          <div
            ref={cartSheetRef}
            className="flex max-h-[min(92dvh,720px)] w-full max-w-md animate-[slideUp_0.3s_ease-out] flex-col rounded-t-3xl bg-white shadow-2xl"
            style={
              cartDragOffset > 0 || isCartDragging
                ? {
                    transform: `translateY(${cartDragOffset}px)`,
                    transition: isCartDragging ? 'none' : 'transform 180ms ease-out',
                    touchAction: 'pan-y',
                  }
                : { touchAction: 'pan-y' }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex flex-col"
              onTouchStart={handleCartTouchStart}
              onTouchMove={handleCartTouchMove}
              onTouchEnd={handleCartTouchEnd}
              onTouchCancel={handleCartTouchCancel}
            >
              <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-200 cursor-grab active:cursor-grabbing" aria-hidden />
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
                  Продолжить оформление
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {analyticsOpenId && detailProduct && (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-black/50 p-4 overscroll-contain backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-details-title"
          onClick={() => setAnalyticsOpenId(null)}
        >
          <div
            ref={productDetailsSheetRef}
            className="flex max-h-[min(90dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            style={
              productDetailsDragOffset > 0 || isProductDetailsDragging
                ? {
                    transform: `translateY(${productDetailsDragOffset}px)`,
                    transition: isProductDetailsDragging ? 'none' : 'transform 180ms ease-out',
                    touchAction: 'pan-y',
                  }
                : { touchAction: 'pan-y' }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex flex-col"
              onTouchStart={handleProductDetailsTouchStart}
              onTouchMove={handleProductDetailsTouchMove}
              onTouchEnd={handleProductDetailsTouchEnd}
              onTouchCancel={handleProductDetailsTouchCancel}
            >
              <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-200 cursor-grab active:cursor-grabbing" aria-hidden />
            </div>
            <div className="relative h-56 shrink-0 overflow-hidden bg-white p-4">
              <ProductImage
                src={detailProduct.image_url || detailProduct.image}
                alt={detailProduct.name}
                className="h-full w-full"
                imgClassName="block h-full w-full object-contain object-center"
                fallbackClassName="flex h-full items-center justify-center text-sm font-semibold text-slate-500"
              />
              <button
                type="button"
                onClick={() => setAnalyticsOpenId(null)}
                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm transition hover:bg-white"
                aria-label="Закрыть детали товара"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                  {detailProduct.category ?? detailProduct.subtitle}
                </p>
                <h3 id="product-details-title" className="mt-2 text-2xl font-bold text-slate-900">
                  {detailProduct.name}
                </h3>
                {detailProduct.variant && (
                  <p className="mt-2 text-sm text-slate-600">{detailProduct.variant}</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Статус</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {detailProduct.is_in_transit
                      ? 'В пути'
                      : detailProduct.in_stock !== false
                        ? 'В наличии'
                        : 'Нет в наличии'}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Остаток</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {detailProductStockDisplay?.label}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Склад</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {detailProduct.location || '—'}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Мин. заказ</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {detailProductConfig?.sliderMin} кг
                  </p>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Описание</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {detailProduct.description || detailProduct.origin || detailProduct.location || 'Информация отсутствует.'}
                </p>
              </div>
              <div className="space-y-3">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Цены</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{detailPrimaryPriceLabel}</p>
                      <p className="mt-1 text-xl font-bold text-brand-900">{formatCurrency(detailProductPricing.pricePerKg)}/кг</p>
                    </div>
                    <p className="text-xs text-slate-500">{detailSecondaryPriceLabel}: {formatCurrency(detailSecondaryPrice)}/кг</p>
                  </div>
                </div>
                <QuantitySelector
                  product={detailProduct}
                  value={detailProductVolume}
                  isB2B={isB2B}
                  onChange={(nextVolume) => setProductVolume(detailProduct, nextVolume)}
                />
                <button
                  type="button"
                  onClick={() => {
                    addToCart(detailProduct)
                    setAnalyticsOpenId(null)
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  В корзину
                </button>
              </div>
            </div>
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
            <CheckoutFormContent
              checkoutStep={checkoutStep}
              checkoutForm={checkoutForm}
              checkoutErrors={checkoutErrors}
              checkoutSubmitError={checkoutSubmitError}
              checkoutSuccessMessage={checkoutSuccessMessage}
              isSubmittingOrder={isSubmittingOrder}
              cartCount={cartCount}
              cartGrandTotal={cartGrandTotal}
              isB2B={isB2B}
              cartLines={cartLines}
              updateCheckoutField={updateCheckoutField}
            />
          </form>
        </div>
      )}

      {clientOrdersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 overscroll-contain backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-orders-title"
          onClick={() => setClientOrdersOpen(false)}
        >
          <div
            ref={clientOrdersSheetRef}
            className="flex max-h-[min(90dvh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            style={
              clientOrdersDragOffset > 0 || isClientOrdersDragging
                ? {
                    transform: `translateY(${clientOrdersDragOffset}px)`,
                    transition: isClientOrdersDragging ? 'none' : 'transform 180ms ease-out',
                    touchAction: 'pan-y',
                  }
                : { touchAction: 'pan-y' }
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="shrink-0"
              onTouchStart={handleClientOrdersTouchStart}
              onTouchMove={handleClientOrdersTouchMove}
              onTouchEnd={handleClientOrdersTouchEnd}
              onTouchCancel={handleClientOrdersTouchCancel}
            >
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-200 cursor-grab active:cursor-grabbing" aria-hidden />
            <div className="flex items-start justify-between border-b border-slate-100 bg-white px-5 pb-4 pt-3">
              <div>
                <h3 id="client-orders-title" className="text-xl font-bold text-brand-900">
                  Мои заказы
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Здесь показаны заказы, оформленные с этого устройства.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClientOrdersOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            </div>

            <div
              className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <button
                type="button"
                onClick={() => void loadClientOrders()}
                disabled={isLoadingClientOrders}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-700 px-4 text-base font-bold text-white transition hover:bg-brand-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:text-sm"
              >
                {isLoadingClientOrders ? 'Ищем заказы...' : 'Обновить заказы'}
              </button>

              {clientOrdersError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {clientOrdersError}
                </div>
              )}

              {clientOrdersSuccess && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {clientOrdersSuccess}
                </div>
              )}

              {hasSearchedClientOrders && !isLoadingClientOrders && !clientOrdersError && clientOrders.length === 0 && (
                <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm font-medium text-slate-500">
                  На этом устройстве заказов пока нет. Оформите заказ, и он появится здесь.
                </p>
              )}

              {clientOrders.length > 0 && (
                <div className="space-y-3">
                  {clientOrders.map((order) => (
                    <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {formatAdminDate(order.created_at)}
                          </p>
                          <h4 className="mt-1 text-base font-bold text-slate-900">
                            Заказ #{order.id.slice(0, 8)}
                          </h4>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getAdminStatusClass(order.status)}`}>
                          {ADMIN_STATUS_LABELS[order.status]}
                        </span>
                      </div>

                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-semibold uppercase text-slate-400">Тип заказа</dt>
                          <dd className="font-semibold text-slate-800">{order.order_type || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-slate-400">Получение</dt>
                          <dd className="font-semibold text-slate-800">{order.receiving_type || '-'}</dd>
                        </div>
                        {order.delivery_address && (
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-semibold uppercase text-slate-400">Адрес</dt>
                            <dd className="font-semibold text-slate-800">{order.delivery_address}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs font-semibold uppercase text-slate-400">Общий вес</dt>
                          <dd className="font-semibold text-slate-800">
                            {formatVolumeLabel({} as Product, order.total_weight_kg)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase text-slate-400">Сумма</dt>
                          <dd className="font-bold text-brand-800">{formatCurrency(order.total_amount)}</dd>
                        </div>
                        {order.comment && (
                          <div className="sm:col-span-2">
                            <dt className="text-xs font-semibold uppercase text-slate-400">Комментарий</dt>
                            <dd className="font-semibold text-slate-800">{order.comment}</dd>
                          </div>
                        )}
                      </dl>

                      <div className="mt-3">
                        <p className="mb-2 text-sm font-bold text-slate-800">Товары</p>
                        {order.items.length === 0 ? (
                          <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                            Позиции заказа не найдены.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {order.items.map((item) => (
                              <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-900">{item.product_name}</p>
                                    <p className="mt-0.5 text-sm text-slate-600">
                                      {formatVolumeLabel({} as Product, item.quantity_kg)} · {formatCurrency(item.price_per_kg)}/кг
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
                      {(order.items.length > 0 ||
                        (!order.archived_at && (order.status === 'new' || order.status === 'processing'))) && (
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          {order.items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => repeatClientOrder(order)}
                              className="w-full rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-bold text-brand-800 transition hover:bg-brand-100 sm:w-auto"
                            >
                              Повторить заказ
                            </button>
                          )}
                          {!order.archived_at && (order.status === 'new' || order.status === 'processing') && (
                            <button
                              type="button"
                              onClick={() => void cancelClientOrder(order)}
                              disabled={cancellingClientOrderId === order.id}
                              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                            >
                              {cancellingClientOrderId === order.id ? 'Отменяем...' : 'Отменить заказ'}
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {false && profileOpen && (
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
                  Мои заказы
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
                  Профиль временно скрыт. Используйте раздел «Мои заказы».
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
