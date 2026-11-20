-- Verläufe ohne Firma nachträglich über die Empfängeradresse (exakt oder Domain) zuordnen.
UPDATE public.lead_messages m SET tenant_id = s.tenant_id
FROM public.lead_mail_settings s
WHERE m.tenant_id IS NULL AND m.direction = 'in' AND s.sender_email IS NOT NULL
  AND (lower(m.to_email) = lower(s.sender_email)
       OR split_part(lower(m.to_email),'@',2) = split_part(lower(s.sender_email),'@',2)
       OR split_part(lower(m.to_email),'@',2) LIKE '%.' || split_part(lower(s.sender_email),'@',2)
       OR split_part(lower(s.sender_email),'@',2) LIKE '%.' || split_part(lower(m.to_email),'@',2));
