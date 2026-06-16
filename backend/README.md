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

## Build

```bash
npm run build
```
