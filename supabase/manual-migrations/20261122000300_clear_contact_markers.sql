-- Alle bisherigen Kontakt-Markierungen (grün/blau) entfernen.
-- Achtung: Grün steuert die Caller-Sichtbarkeit (caller_can_see_*).
-- Nach diesem Update sieht der Caller niemanden mehr, bis neu zugewiesen wird.
-- APPLY MANUALLY via: bash scripts/migrate.sh
update public.applications
set contact_marker = null
where contact_marker is not null;
