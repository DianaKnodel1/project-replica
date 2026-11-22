-- APPLY MANUALLY via: bash scripts/deploy.sh (nach 20261122000000_caller_role.sql)
-- Caller sehen nur Personen mit applications.contact_marker = 'green'
-- (Bewerbung und daraus entstandenes Mitarbeiterkonto), deren Chat und Termine.

CREATE OR REPLACE FUNCTION public.is_caller(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'caller')
$$;
GRANT EXECUTE ON FUNCTION public.is_caller(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.caller_can_see_application(_user_id uuid, _app_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_caller(_user_id) AND EXISTS (
    SELECT 1 FROM public.applications a WHERE a.id = _app_id AND a.contact_marker = 'green')
$$;
GRANT EXECUTE ON FUNCTION public.caller_can_see_application(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.caller_can_see_user(_user_id uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_caller(_user_id) AND EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.contact_marker = 'green'
      AND (a.user_id = _target
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _target AND p.application_id = a.id)))
$$;
GRANT EXECUTE ON FUNCTION public.caller_can_see_user(uuid, uuid) TO authenticated;

-- Lesen/Antworten nur für zugewiesene Personen
DROP POLICY IF EXISTS "Caller read assigned applications" ON public.applications;
CREATE POLICY "Caller read assigned applications" ON public.applications FOR SELECT TO authenticated
  USING (public.is_caller(auth.uid()) AND contact_marker = 'green');

DROP POLICY IF EXISTS "Caller read assigned profiles" ON public.profiles;
CREATE POLICY "Caller read assigned profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.caller_can_see_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "Caller assigned conversations" ON public.chat_conversations;
CREATE POLICY "Caller assigned conversations" ON public.chat_conversations FOR ALL TO authenticated
  USING (public.caller_can_see_user(auth.uid(), user_id))
  WITH CHECK (public.caller_can_see_user(auth.uid(), user_id));

DROP POLICY IF EXISTS "Caller assigned messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Caller read assigned messages" ON public.chat_messages;
CREATE POLICY "Caller read assigned messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.caller_can_see_user(auth.uid(), sender_id) OR public.caller_can_see_user(auth.uid(), receiver_id));
DROP POLICY IF EXISTS "Caller update assigned messages" ON public.chat_messages;
CREATE POLICY "Caller update assigned messages" ON public.chat_messages FOR UPDATE TO authenticated
  USING (public.caller_can_see_user(auth.uid(), sender_id) OR public.caller_can_see_user(auth.uid(), receiver_id))
  WITH CHECK (public.caller_can_see_user(auth.uid(), sender_id) OR public.caller_can_see_user(auth.uid(), receiver_id));
DROP POLICY IF EXISTS "Caller send to assigned" ON public.chat_messages;
CREATE POLICY "Caller send to assigned" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.caller_can_see_user(auth.uid(), receiver_id));

DROP POLICY IF EXISTS "Caller read tenants" ON public.tenants;
CREATE POLICY "Caller read tenants" ON public.tenants FOR SELECT TO authenticated USING (public.is_caller(auth.uid()));
DROP POLICY IF EXISTS "Caller read roles" ON public.user_roles;
CREATE POLICY "Caller read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_caller(auth.uid()));

-- Postfach: Mails zu zugewiesenen Personen (über Bewerbung, Profil oder Adresse)
CREATE OR REPLACE FUNCTION public.caller_can_see_mail(_user_id uuid, _app_id uuid, _profile_id uuid, _peer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT public.is_caller(_user_id) AND EXISTS (
    SELECT 1 FROM public.applications a
    LEFT JOIN public.profiles p ON p.application_id = a.id OR (a.user_id IS NOT NULL AND p.user_id = a.user_id)
    LEFT JOIN auth.users u ON u.id = COALESCE(p.user_id, a.user_id)
    WHERE a.contact_marker = 'green'
      AND (a.id = _app_id
        OR (p.id IS NOT NULL AND p.id = _profile_id)
        OR (_peer IS NOT NULL AND (lower(a.email) = lower(_peer) OR lower(u.email) = lower(_peer)))))
$$;
GRANT EXECUTE ON FUNCTION public.caller_can_see_mail(uuid, uuid, uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Caller assigned lead_messages" ON public.lead_messages;
CREATE POLICY "Caller assigned lead_messages" ON public.lead_messages FOR SELECT TO authenticated
  USING (public.caller_can_see_mail(auth.uid(), application_id, profile_id, COALESCE(peer_email, CASE WHEN direction = 'in' THEN from_email ELSE to_email END)));
DROP POLICY IF EXISTS "Caller update assigned lead_messages" ON public.lead_messages;
CREATE POLICY "Caller update assigned lead_messages" ON public.lead_messages FOR UPDATE TO authenticated
  USING (public.caller_can_see_mail(auth.uid(), application_id, profile_id, COALESCE(peer_email, CASE WHEN direction = 'in' THEN from_email ELSE to_email END)))
  WITH CHECK (public.caller_can_see_mail(auth.uid(), application_id, profile_id, COALESCE(peer_email, CASE WHEN direction = 'in' THEN from_email ELSE to_email END)));

-- ── Anruf-Liste ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_status (
  application_id uuid PRIMARY KEY REFERENCES public.applications(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'neu'
    CHECK (status IN ('neu','termin','nicht_erreicht','rueckruf','interessiert','macht_mit','kein_interesse')),
  note text,
  last_call_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  caller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_log_app_idx ON public.call_log (application_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.call_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  note text,
  done boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_appointments_when_idx ON public.call_appointments (scheduled_at) WHERE done = false;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['call_status','call_log','call_appointments'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins manage" ON public.%I FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), ''admin''::public.app_role))
      WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Caller manage assigned" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Caller manage assigned" ON public.%I FOR ALL TO authenticated
      USING (public.caller_can_see_application(auth.uid(), application_id))
      WITH CHECK (public.caller_can_see_application(auth.uid(), application_id))', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
