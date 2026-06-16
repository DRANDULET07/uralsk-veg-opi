# Zelen Bazar Depo Backend

NestJS backend scaffold for future server-side logic. The current frontend and Supabase client logic remain unchanged.

## Install

```bash
cd backend
npm install
```

## Environment

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Required variables:

```bash
PORT=3001
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

Do not commit real keys. `backend/.env` is ignored by git.

`DATABASE_URL` should be a PostgreSQL connection string. For Supabase, use the database connection string from the Supabase project settings. SSL is enabled automatically for remote databases and disabled for localhost URLs.

## Run

```bash
npm run start:dev
```

Health check:

```bash
GET http://localhost:3001/api/health
```

Response:

```json
{
  "status": "ok",
  "service": "zelen-bazar-depo-backend"
}
```

Products:

```bash
GET http://localhost:3001/api/products
```

Returns the products from `public.products` ordered by newest `id` first.

Orders:

```bash
POST http://localhost:3001/api/orders
GET http://localhost:3001/api/orders
GET http://localhost:3001/api/orders/:id
PATCH http://localhost:3001/api/orders/:id/status
PATCH http://localhost:3001/api/orders/:id/archive
PATCH http://localhost:3001/api/orders/:id/unarchive
```

Returns orders from `public.orders`. The detail endpoint also returns matching rows from `public.order_items`.

Status update body:

```json
{
  "status": "processing"
}
```

Create order with PowerShell:

```powershell
$bodyObject = @{
  customer_name = "Тест Backend"
  customer_phone = "77000000001"
  client_type = "Оптовик"
  order_type = "Оптовый"
  receiving_type = "Самовывоз"
  delivery_address = $null
  comment = "Тестовый заказ через backend"
  total_weight_kg = 25
  total_amount = 2500
  items = @(
    @{
      product_id = $null
      product_name = "Тестовый товар"
      quantity_kg = 25
      price_per_kg = 100
      total_amount = 2500
    }
  )
}

$body = $bodyObject | ConvertTo-Json -Depth 5
$utf8Body = [System.Text.Encoding]::UTF8.GetBytes($body)

Invoke-RestMethod `
  -Uri "http://localhost:3001/api/orders" `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body $utf8Body
```

## Build

```bash
npm run build
```
