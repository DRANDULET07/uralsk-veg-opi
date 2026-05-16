DO $$
BEGIN
  CREATE TYPE "ProductAvailability" AS ENUM ('warehouse', 'transit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductStatusTone" AS ENUM ('fresh', 'stock', 'transit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProductUnitMode" AS ENUM ('tons', 'kg');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subtitle" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "statusEmoji" TEXT NOT NULL,
  "statusText" TEXT NOT NULL,
  "statusTone" "ProductStatusTone" NOT NULL,
  "availability" "ProductAvailability" NOT NULL,
  "basePrice" INTEGER NOT NULL,
  "minOrder" TEXT,
  "location" TEXT NOT NULL,
  "warehouseId" TEXT,
  "bookingNote" TEXT,
  "unitMode" "ProductUnitMode" NOT NULL,
  "sliderMin" DOUBLE PRECISION NOT NULL,
  "sliderMax" DOUBLE PRECISION NOT NULL,
  "sliderStep" DOUBLE PRECISION NOT NULL,
  "defaultVolume" DOUBLE PRECISION NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Product_availability_idx" ON "Product"("availability");

CREATE INDEX IF NOT EXISTS "Product_warehouseId_idx" ON "Product"("warehouseId");

CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");
