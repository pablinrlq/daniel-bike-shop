-- Número ENTREGÁVEL da conversa (formato com/sem o 9º dígito que a Meta aceita).
-- Importante: a coluna phone continua sendo o wa_id de ENTRADA (chave de lookup
-- das mensagens recebidas) e nunca deve ser sobrescrita — senão a próxima
-- mensagem do cliente cria conversa duplicada. O envio usa delivery_phone
-- quando existir; o retry do 9º dígito preenche este campo na primeira entrega.
alter table public.whatsapp_conversations
  add column if not exists delivery_phone text;
