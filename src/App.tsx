import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  CalendarCheck,
  CheckCircle2,
  Leaf,
  MapPin,
  Minus,
  Package,
  Plus,
  RotateCcw,
  Scale,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'
import { getErrorMessage, getProducts } from './services/products'
import type { Product } from './types/product'

const WHATSAPP_PHONE = '77774681889'
const PROFILE_PHONE = '+7 (707) XXX-XX-XX'

type TabId = 'all' | 'warehouse' | 'transit'
type WarehouseFilterId = 'all' | 'warehouse1' | 'warehouse2'
type SortOption = 'default' | 'price-asc' | 'price-desc'
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

const LOCAL_STORAGE_LAST_ORDER = 'last_vegetable_order'
const LOCAL_STORAGE_HISTORY = 'order_history'
const RETAIL_MARKUP = 90
const RETAIL_MIN_ORDER_KG = 5

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

function getWeightKg(product: Product, volume: number, isB2B = true): number {
  const displayUnit = isB2B ? product.unitMode : 'kg'
  return displayUnit === 'tons' ? volume * 1000 : volume
}

function getProductDisplayConfig(product: Product, isB2B: boolean) {
  if (isB2B) {
    return {
      unitMode: product.unitMode,
      sliderMin: product.sliderMin,
      sliderMax: product.sliderMax,
      sliderStep: product.sliderStep,
      defaultVolume: product.defaultVolume,
    }
  }

  return {
    unitMode: 'kg' as const,
    sliderMin: RETAIL_MIN_ORDER_KG,
    sliderMax: 50,
    sliderStep: 1,
    defaultVolume: 10,
  }
}

function getVolumeUnit(product: Product, isB2B = true): string {
  const unitMode = isB2B ? product.unitMode : 'kg'
  return unitMode === 'tons' ? 'т' : 'кг'
}

function snapVolume(value: number, product: Product, isB2B = true): number {
  const { sliderMin, sliderMax, sliderStep } = getProductDisplayConfig(product, isB2B)
  const clamped = Math.min(sliderMax, Math.max(sliderMin, value))
  const stepped =
    sliderMin + Math.round((clamped - sliderMin) / sliderStep) * sliderStep
  const decimals = sliderStep % 1 !== 0 ? 1 : 0
  return Number(stepped.toFixed(decimals))
}

function formatVolumeLabel(product: Product, volume: number, isB2B = true): string {
  const unitMode = isB2B ? product.unitMode : 'kg'
  if (unitMode === 'tons') {
    const label = Number.isInteger(volume) ? String(volume) : volume.toFixed(1)
    return `${label} ${volume === 1 ? 'тонна' : volume < 5 ? 'тонны' : 'тонн'}`
  }
  return `${formatMoney(volume)} кг`
}

function formatVolumeWhatsApp(product: Product, volume: number, isB2B = true): string {
  const unitMode = isB2B ? product.unitMode : 'kg'
  if (unitMode === 'tons') {
    const label = Number.isInteger(volume) ? String(volume) : volume.toFixed(1)
    return `${label} тонн`
  }
  return `${formatMoney(volume)} кг`
}

function formatOrderVolume(product: Product, volume: number, isB2B = true): string {
  const unitMode = isB2B ? product.unitMode : 'kg'
  if (unitMode === 'tons') {
    const label = Number.isInteger(volume) ? String(volume) : volume.toFixed(1)
    return `${label} С‚`
  }
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

function getCartTotalTons(lines: CartLine[]): number {
  return lines.reduce((sum, line) => {
    if (line.product.unitMode === 'tons') return sum + line.volume
    return sum
  }, 0)
}

function buildCartWhatsAppMessage(lines: CartLine[], grandTotal: number, isB2B: boolean): string {
  const itemLines = lines.map(
    (line) =>
      `- ${line.product.name}: ${formatVolumeWhatsApp(line.product, line.volume, isB2B)} (Итого: ${formatCurrency(line.total)})`,
  )
  const totalTons = getCartTotalTons(lines)
  const tonsLabel =
    totalTons > 0
      ? `${Number.isInteger(totalTons) ? totalTons : totalTons.toFixed(1)} тонн`
      : null

  const summary = tonsLabel
    ? `Всего: ${tonsLabel} на общую сумму ${formatCurrency(grandTotal)}.`
    : `Общая сумма заказа: ${formatCurrency(grandTotal)}.`

  return [
    'Здравствуйте! Хочу забронировать овощи:',
    ...itemLines,
    summary,
    `Мой номер в системе: ${PROFILE_PHONE}`,
  ].join('\n')
}

function openCartWhatsApp(lines: CartLine[], grandTotal: number, isB2B: boolean) {
  const text = buildCartWhatsAppMessage(lines, grandTotal, isB2B)
  const url = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
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

interface RetailQuantityInputProps {
  value: number
  stock: number
  min?: number
  productName: string
  onChange: (value: number) => void
}

function normalizeRetailQuantity(value: number, min: number, stock: number): number {
  if (!Number.isFinite(value)) return Math.min(min, stock)
  const rounded = Math.round(value)
  return Math.min(stock, Math.max(min, rounded))
}

function RetailQuantityInput({
  value,
  stock,
  min = RETAIL_MIN_ORDER_KG,
  productName,
  onChange,
}: RetailQuantityInputProps) {
  const [draft, setDraft] = useState(String(value))
  const maxStock = Math.max(0, Math.floor(stock))
  const canDecrease = value > min
  const canIncrease = value < maxStock

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commitValue = (nextValue: number) => {
    const normalized = normalizeRetailQuantity(nextValue, min, maxStock)
    setDraft(String(normalized))
    onChange(normalized)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDraft = event.target.value.replace(/[^\d]/g, '')

    if (nextDraft === '') {
      setDraft('')
      return
    }

    const parsed = Number(nextDraft)
    if (parsed > maxStock) {
      commitValue(maxStock)
      return
    }

    setDraft(nextDraft)
    if (parsed >= min) {
      onChange(parsed)
    }
  }

  const handleBlur = () => {
    if (draft === '') {
      commitValue(min)
      return
    }

    commitValue(Number(draft))
  }

  return (
    <div className="grid grid-cols-[2.75rem_1fr_2.75rem] overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => commitValue(value - 1)}
        disabled={!canDecrease}
        className="flex h-12 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 active:scale-95"
        aria-label={`Уменьшить вес ${productName} на 1 кг`}
      >
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <label className="flex min-w-0 items-center justify-center border-x border-slate-200 px-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className="w-full bg-transparent text-center text-lg font-bold tabular-nums text-emerald-800 outline-none"
          aria-label={`Вес покупки в килограммах: ${productName}`}
        />
        <span className="ml-1 text-sm font-semibold text-slate-500">кг</span>
      </label>
      <button
        type="button"
        onClick={() => commitValue(value + 1)}
        disabled={!canIncrease}
        className="flex h-12 items-center justify-center text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 active:scale-95"
        aria-label={`Увеличить вес ${productName} на 1 кг`}
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <article className="mb-6 overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70">
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

export default function App() {
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
  const [repeatedOrderId, setRepeatedOrderId] = useState<string | null>(null)
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const [analyticsOpenId, setAnalyticsOpenId] = useState<string | null>(null)
  const [cart, setCart] = useState<Cart>({})
  const [orderName] = useState('')
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
        Object.entries(prev).map(([productId, volume]) => {
          const product = products.find((p) => p.id === productId)
          return [productId, product ? snapVolume(volume, product, isB2B) : volume]
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
    const selected = volumes[product.id] ?? getProductDisplayConfig(product, isB2B).defaultVolume
    setCart((prev) => {
      const current = prev[product.id] ?? 0
      const nextVolume = current > 0 ? current + selected : selected
      return {
        ...prev,
        [product.id]: snapVolume(nextVolume, product, isB2B),
      }
    })
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId(null), 1500)
  }

  const removeFromCart = (productId: string) => {
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
    setCart({})
  }

  const saveOrderToStorage = (order: SavedOrder) => {
    localStorage.setItem(LOCAL_STORAGE_LAST_ORDER, JSON.stringify(order))
    setLastOrder(order)
    const updatedHistory = [order, ...orderHistory].slice(0, 5)
    setOrderHistory(updatedHistory)
    localStorage.setItem(LOCAL_STORAGE_HISTORY, JSON.stringify(updatedHistory))
  }

  const handleBookCart = () => {
    if (cartLines.length === 0) return

    const order: SavedOrder = {
      userName: orderName.trim() || undefined,
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
    openCartWhatsApp(cartLines, cartGrandTotal, isB2B)
    clearCart()
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
    <div className="mx-auto min-h-dvh max-w-md bg-slate-100 pb-24">
      <div className="relative border-b border-slate-200 bg-white shadow-sm">
        <header className="border-b border-brand-800/20 bg-brand-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-100/80">
                URALSK VEG OPI
              </p>
              <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight">
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
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-white/10 p-1 text-sm text-white" role="tablist" aria-label="Тип покупателя">
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
        </header>

        <div className="bg-white px-3 py-3">
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
            className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50/90 p-2.5"
            aria-label="Расширенные фильтры"
          >
            <div className="flex items-center gap-2">
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

            <div className="flex flex-wrap items-center gap-2">
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

              <div className="flex min-w-0 flex-1 items-center gap-1.5">
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

      <main className="space-y-4 px-3 pt-4">
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
          <div className="space-y-4">
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
          filteredProducts.map((product) => {
          const volume = volumes[product.id] ?? getProductDisplayConfig(product, isB2B).defaultVolume
          const { discount, pricePerKg, total } = calcPricing(product, volume, isB2B)
          const hasDiscount = discount > 0
          const unit = getVolumeUnit(product, isB2B)
          const inCart = product.id in cart
          const justAdded = addedProductId === product.id
          const analyticsActionClass = 'bg-white text-emerald-700'

          return (
            <article
              key={product.id}
              className="mb-6 overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70"
            >
              <div className="group relative h-48 w-full overflow-hidden bg-slate-200">
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
                  <div className="flex h-full items-center justify-center bg-slate-100 px-8 text-center text-sm font-semibold text-slate-500">
                    Фото товара скоро будет добавлено
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4">
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

              <div className="space-y-4 p-5">
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

                {(product.minOrder || !isB2B) && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Scale className="h-4 w-4 text-brand-600" aria-hidden />
                    {isB2B ? product.minOrder : 'Розничный заказ от 5 кг, точный выбор по 1 кг'}
                  </p>
                )}
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

                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                  {isB2B ? (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-700">Объём закупки</span>
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const cfg = getProductDisplayConfig(product, true)
                            return (
                              <>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={cfg.sliderMin}
                                  max={cfg.sliderMax}
                                  step={cfg.sliderStep}
                                  value={volume}
                                  onChange={(e) => {
                                    const parsed = Number(e.target.value)
                                    if (!Number.isNaN(parsed)) {
                                      setProductVolume(product, parsed)
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const parsed = Number(e.target.value)
                                    if (Number.isNaN(parsed) || e.target.value === '') {
                                      setProductVolume(product, cfg.sliderMin)
                                    } else {
                                      setProductVolume(product, parsed)
                                    }
                                  }}
                                  className="w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm font-bold tabular-nums text-emerald-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                                  aria-label={`Объём закупки в ${unit}`}
                                />
                                <span className="text-sm font-semibold text-slate-500">{unit}</span>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                      {(() => {
                        const cfg = getProductDisplayConfig(product, true)
                        return (
                          <>
                            <input
                              type="range"
                              min={cfg.sliderMin}
                              max={cfg.sliderMax}
                              step={cfg.sliderStep}
                              value={volume}
                              onChange={(e) => setProductVolume(product, Number(e.target.value))}
                              className="w-full accent-emerald-600"
                              aria-label={`Ползунок объёма: ${product.name}`}
                            />
                            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                              <span>
                                {cfg.unitMode === 'tons' ? `${cfg.sliderMin} С‚` : `${cfg.sliderMin} кг`}
                              </span>
                              <span className="text-slate-500">{formatVolumeLabel(product, volume, true)}</span>
                              <span>
                                {cfg.unitMode === 'tons' ? `${cfg.sliderMax} С‚` : `${cfg.sliderMax} кг`}
                              </span>
                            </div>
                          </>
                        )
                      })()}
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-700">Вес покупки</span>
                        <span className="text-xs font-semibold text-slate-500">шаг 1 кг</span>
                      </div>
                      {(() => {
                        const cfg = getProductDisplayConfig(product, false)
                        return (
                          <RetailQuantityInput
                            value={volume}
                            min={cfg.sliderMin}
                            stock={product.retailStockKg ?? cfg.sliderMax}
                            productName={product.name}
                            onChange={(nextVolume) => {
                              setVolumes((prev) => ({
                                ...prev,
                                [product.id]: nextVolume,
                              }))
                            }}
                          />
                        )
                      })()}
                    </>
                  )}
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
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-bold shadow-md transition active:scale-[0.98] hover:shadow-lg ${
                    justAdded
                      ? 'bg-emerald-700 text-white shadow-emerald-700/20'
                      : inCart
                        ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700'
                        : 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700'
                  }`}
                >
                  <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  {justAdded ? 'Добавлено!' : inCart ? 'Добавить ещё в корзину' : 'Добавить в корзину'}
                </button>
              </div>
            </article>
          )
        }))}
      </main>

      <footer className="px-4 pt-6 text-center text-xs text-slate-500">
        Оптово-розничная витрина · Уральск, Казахстан · Цены в тенге
      </footer>

      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-xl transition hover:bg-brand-800 active:scale-95"
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
                      : `${order.volume} С‚`
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
