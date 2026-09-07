- Migration: add_reconcile_failures_to_deal
-- Adds reconcileFailures integer field to Deal table.

ALTER TABLE "Deal"
  ADD COLUMN "reconcileFailures" INTEGER NOT NULL DEFAULT 0;
