-- APPLY MANUALLY via: bash scripts/deploy.sh
-- Neue Kontoart „Caller“ (sieht nur grün markierte Personen).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'caller';
