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
POST http://localhost:3001/api/products
GET http://localhost:3001/api/products
PATCH http://localhost:3001/api/products/:id
PATCH http://localhost:3001/api/products/:id/stock
PATCH http://localhost:3001/api/products/:id/visibility
PATCH http://localhost:3001/api/products/:id/transit
```

Returns the products from `public.products` ordered by newest `id` first.

Create product with PowerShell:

```powershell
$bodyObject = @{
  name = "Тестовый товар"
  category = "Овощи"
  retail_price = 120
  wholesale_price = 100
  stock_amount = 50
  unit = "кг"
  status = "В наличии"
  is_in_transit = $false
  is_active = $true
  in_stock = $true
  min_order = 1
}

$body = $bodyObject | ConvertTo-Json -Depth 5
$utf8Body = [System.Text.Encoding]::UTF8.GetBytes($body)

Invoke-RestMethod `
  -Uri "http://localhost:3001/api/products" `
  -Method Post `
  -ContentType "application/json; charset=utf-8" `
  -Body $utf8Body
```

Update product with PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/products/42" `
  -Method Patch `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"name":"Товар обновлен","retail_price":130}'))
```

Update stock, visibility, and transit with PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/products/42/stock" `
  -Method Patch `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"stock_amount":75}'))

Invoke-RestMethod `
  -Uri "http://localhost:3001/api/products/42/visibility" `
  -Method Patch `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"is_visible":true}'))

Invoke-RestMethod `
  -Uri "http://localhost:3001/api/products/42/transit" `
  -Method Patch `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"is_in_transit":true,"delivery_eta":"Завтра"}'))
```

Clients:

```bash
GET http://localhost:3001/api/clients
GET http://localhost:3001/api/clients/:id
PATCH http://localhost:3001/api/clients/:id/status
PATCH http://localhost:3001/api/clients/:id/note
```

Check clients with PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/clients" `
  -Method Get

Invoke-RestMethod `
  -Uri "http://localhost:3001/api/clients/CLIENT_ID_HERE" `
  -Method Get
```

Update client status and note with PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/clients/CLIENT_ID_HERE/status" `
  -Method Patch `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"client_status":"vip"}'))

Invoke-RestMethod `
  -Uri "http://localhost:3001/api/clients/CLIENT_ID_HERE/note" `
  -Method Patch `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"note":"Позвонить перед доставкой"}'))
```

Client notes are saved to `client_note` when that column exists. Fallback columns are `note`, `staff_note`, and `worker_note`.

Orders:

```bash
POST http://localhost:3001/api/orders
GET http://localhost:3001/api/orders
GET http://localhost:3001/api/orders/:id
PATCH http://localhost:3001/api/orders/:id/status
PATCH http://localhost:3001/api/orders/:id/note
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

Update order note with PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/orders/42/note" `
  -Method Patch `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes('{"staff_note":"Проверить заказ перед отправкой"}'))
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
