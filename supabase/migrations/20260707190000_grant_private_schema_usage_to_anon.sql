
-- Concede USAGE no schema private para anon e authenticated
-- As public wrappers de RPC são SECURITY INVOKER e delegam para
-- funções SECURITY DEFINER em private. Sem USAGE, o invocador
-- (anon ou authenticated) não consegue resolver os nomes das
-- funções no schema private, gerando "permission denied for schema private".
GRANT USAGE ON SCHEMA private TO anon;
GRANT USAGE ON SCHEMA private TO authenticated;
