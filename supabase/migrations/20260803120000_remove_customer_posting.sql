-- ============================================================
-- Feed como catálogo: postagem feita SOMENTE pelo comerciante.
--
-- Remove os RPCs de criação/edição/exclusão de posts por cliente
-- (session-token anônimo). O comerciante continua publicando via
-- INSERT direto em posts (role authenticated, _authenticated.app.feed).
-- Interações (reactions/comentários) nos posts do comerciante e seus
-- mapeamentos permanecem intactos.
--
-- Nenhuma policy de storage anônima é removida aqui: os uploads do
-- cliente (avatar/comentário) já passam por createServerFn usando
-- supabaseAdmin (service role).
-- ============================================================

-- create_customer_post (overload 7 args, versão 20260708004807)
DROP FUNCTION IF EXISTS public.create_customer_post(uuid, uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS private.create_customer_post(uuid, uuid, uuid, text, text, text, text);

-- create_customer_post (overload 8 args com video_url, versão 20260715052216)
DROP FUNCTION IF EXISTS public.create_customer_post(uuid, uuid, uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS private.create_customer_post(uuid, uuid, uuid, text, text, text, text, text);

-- update_customer_post (20260710100000 / 20260802015000)
DROP FUNCTION IF EXISTS public.update_customer_post(uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS private.update_customer_post(uuid, uuid, uuid, text, text);

-- delete_customer_post (20260710100000 / 20260802015000)
DROP FUNCTION IF EXISTS public.delete_customer_post(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS private.delete_customer_post(uuid, uuid, uuid);

-- Remove a policy anônima de INSERT em posts ("Anyone customer can post",
-- criada em 20260707220000): cliente não pode mais criar posts por INSERT
-- direto (nem via RPC, que já foi removido). O comerciante segue inserindo
-- com author_type = 'business'.
DROP POLICY IF EXISTS "Anyone customer can post" ON public.posts;
