-- Postfach: Anhänge an E-Mails (gesendet und empfangen).
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Privater Speicher; Zugriff nur serverseitig (Service-Rolle) über signierte Links.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('mail-attachments', 'mail-attachments', false, 15728640)
ON CONFLICT (id) DO UPDATE SET public = false;
