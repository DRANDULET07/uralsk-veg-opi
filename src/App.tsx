import { useMemo, useState } from 'react'
import {
  CalendarCheck,
  Leaf,
  MapPin,
  Package,
  Scale,
  Truck,
} from 'lucide-react'

const WHATSAPP_PHONE = '77774681889'

type TabId = 'all' | 'warehouse' | 'transit'
type UnitMode = 'tons' | 'kg'

interface Product {
  id: string
  name: string
  subtitle: string
  image: string
  statusEmoji: string
  statusText: string
  statusTone: 'fresh' | 'stock' | 'transit'
  availability: 'warehouse' | 'transit'
  basePrice: number
  minOrder?: string
  location: string
  bookingNote?: string
  unitMode: UnitMode
  sliderMin: number
  sliderMax: number
  sliderStep: number
  defaultVolume: number
}

const PRODUCTS: Product[] = [
  {
    id: 'potato',
    name: 'Картофель',
    subtitle: 'Местный, КХ',
    image: '/products/potato.jpg',
    statusEmoji: '🟢',
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
  },
  {
    id: 'onion',
    name: 'Лук репчатый',
    subtitle: 'Оптовая партия',
    image: '/products/onion.jpg',
    statusEmoji: '🟡',
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
  },
  {
    id: 'carrot',
    name: 'Морковь',
    subtitle: 'Мытая',
    image: '/products/carrot.jpg',
    statusEmoji: '🚚',
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
  },
  {
    id: 'tomato',
    name: 'Томаты',
    subtitle: 'Тепличные',
    image: '/products/tomato.jpg',
    statusEmoji: '🟢',
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
  },
  {
    id: 'cabbage',
    name: 'Капуста',
    subtitle: 'Белокочанная',
    image: '/products/cabbage.jpg',
    statusEmoji: '🟢',
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
  },
]

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'Все овощи' },
  { id: 'warehouse', label: 'В наличии на складе' },
  { id: 'transit', label: 'Товар в пути' },
]

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

function getMidpoint(min: number, max: number): number {
  return (min + max) / 2
}

function getDiscountPercent(volume: number, min: number, max: number): number {
  const mid = getMidpoint(min, max)
  if (volume <= mid) return 0
  const ratio = (volume - mid) / (max - mid)
  return 5 + ratio * 2
}

function getWeightKg(product: Product, volume: number): number {
  return product.unitMode === 'tons' ? volume * 1000 : volume
}

function formatVolumeLabel(product: Product, volume: number): string {
  if (product.unitMode === 'tons') {
    const label = Number.isInteger(volume) ? String(volume) : volume.toFixed(1)
    return `${label} ${volume === 1 ? 'тонна' : volume < 5 ? 'тонны' : 'тонн'}`
  }
  return `${formatMoney(volume)} кг`
}

function calcPricing(product: Product, volume: number) {
  const weightKg = getWeightKg(product, volume)
  const discount = getDiscountPercent(volume, product.sliderMin, product.sliderMax)
  const pricePerKg = product.basePrice * (1 - discount / 100)
  const total = weightKg * pricePerKg
  return { weightKg, discount, pricePerKg, total }
}

const statusToneClass: Record<Product['statusTone'], string> = {
  fresh: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  stock: 'bg-amber-50 text-amber-900 border-amber-200',
  transit: 'bg-sky-50 text-sky-900 border-sky-200',
}

export default function App() {
  const today = useMemo(() => formatDateRu(new Date()), [])
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const [volumes, setVolumes] = useState<Record<string, number>>(() =>
    Object.fromEntries(PRODUCTS.map((p) => [p.id, p.defaultVolume])),
  )
  const filteredProducts = PRODUCTS.filter((p) => {
    if (activeTab === 'all') return true
    if (activeTab === 'warehouse') return p.availability === 'warehouse'
    return p.availability === 'transit'
  })

  const getWhatsAppUrl = (product: Product) => {
    const volume = volumes[product.id] ?? product.defaultVolume
    const volumeLabel = formatVolumeLabel(product, volume)
    const text = `Здравствуйте! Хочу забронировать: ${product.name}, объём ${volumeLabel}.`
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-slate-100 pb-8">
      <header className="sticky top-0 z-20 border-b border-brand-800/20 bg-brand-900 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-100/80">
              URALSK VEG OPI
            </p>
            <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight">
              ОПТ ОВОЩИ УРАЛЬСК
            </h1>
          </div>
          <Leaf className="mt-1 h-9 w-9 shrink-0 text-brand-100" strokeWidth={1.5} />
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-brand-50">
          <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden />
          <span>Цены и остатки актуальны на сегодня — {today}</span>
        </div>
      </header>

      <nav
        className="sticky top-[calc(5.5rem+env(safe-area-inset-top))] z-10 border-b border-slate-200 bg-white px-3 py-3 shadow-sm"
        aria-label="Фильтр ассортимента"
      >
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

      <main className="space-y-4 px-3 pt-4">
        {filteredProducts.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-slate-500">
            По выбранному фильтру позиций нет. Выберите другую вкладку.
          </p>
        )}

        {filteredProducts.map((product) => {
          const volume = volumes[product.id] ?? product.defaultVolume
          const { discount, pricePerKg, total } = calcPricing(product, volume)
          const hasDiscount = discount > 0

          return (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="group relative aspect-[16/10] w-full overflow-hidden bg-slate-200">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-xs font-medium text-white/90">{product.subtitle}</p>
                  <h2 className="text-2xl font-bold text-white">{product.name}</h2>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium ${statusToneClass[product.statusTone]}`}
                >
                  <span aria-hidden>{product.statusEmoji}</span>
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
                            {product.basePrice} ₸/кг
                          </span>
                          {Math.round(pricePerKg)} ₸/кг
                        </>
                      ) : (
                        <>{product.basePrice} ₸/кг</>
                      )}
                    </p>
                  </div>
                  {hasDiscount && (
                    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">
                      −{discount.toFixed(1)}% опт
                    </span>
                  )}
                </div>

                {product.minOrder && (
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Scale className="h-4 w-4 text-brand-600" aria-hidden />
                    {product.minOrder}
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

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">Объём закупки</span>
                    <span className="font-bold text-brand-800">
                      {formatVolumeLabel(product, volume)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={product.sliderMin}
                    max={product.sliderMax}
                    step={product.sliderStep}
                    value={volume}
                    onChange={(e) =>
                      setVolumes((prev) => ({
                        ...prev,
                        [product.id]: Number(e.target.value),
                      }))
                    }
                    aria-label={`Объём закупки: ${product.name}`}
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                    <span>
                      {product.unitMode === 'tons'
                        ? `${product.sliderMin} т`
                        : `${product.sliderMin} кг`}
                    </span>
                    <span>
                      {product.unitMode === 'tons'
                        ? `${product.sliderMax} т`
                        : `${product.sliderMax} кг`}
                    </span>
                  </div>
                  <p
                    className={`mt-3 text-center text-lg font-bold ${
                      hasDiscount ? 'text-brand-700' : 'text-slate-800'
                    }`}
                  >
                    Итого за {formatVolumeLabel(product, volume)}:{' '}
                    <span className="tabular-nums">{formatMoney(total)} ₸</span>
                  </p>
                  {hasDiscount && (
                    <p className="mt-1 text-center text-xs font-medium text-brand-600">
                      Прогрессивный опт: выгода {discount.toFixed(1)}% от базовой цены
                    </p>
                  )}
                </div>

                <a
                  href={getWhatsAppUrl(product)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-base font-bold text-white shadow-md transition active:scale-[0.98] hover:bg-[#1ebe5d]"
                >
                  Забронировать партию в WhatsApp
                </a>
              </div>
            </article>
          )
        })}
      </main>

      <footer className="px-4 pt-6 text-center text-xs text-slate-500">
        B2B-витрина · Уральск, Казахстан · Оптовые цены в тенге (₸)
      </footer>
    </div>
  )
}