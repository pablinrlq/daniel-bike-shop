# WhatsApp da Daniel Bike Shop — vendas e atendente IA

Cada CTA abre o WhatsApp da loja com uma mensagem contextual pronta. Depois que
o cliente envia a mensagem, o webhook da Meta entrega a conversa ao atendente
reativo no Supabase, que consulta FAQs, catálogo e dados da loja. Um vendedor
pode assumir o atendimento normalmente a qualquer momento.

## Configuração

1. Entre no painel administrativo.
2. Abra **Configurações → Contato**.
3. Informe o número oficial no campo **WhatsApp**.
4. Salve.

O número pode ser digitado como `(31) 99999-9999`, `31999999999` ou com o
código do Brasil (`5531999999999`). O site normaliza o link para o formato
internacional exigido pelo `wa.me`.

Se o campo estiver vazio ou inválido, o fallback atual é `(31) 99532-6386`.

## Pontos de contato

- Botão flutuante nas páginas públicas, com a URL de origem.
- Página de produto: disponibilidade, orçamento, parcelamento e vendedor.
- Cards do catálogo: atalho mobile e ação no hover do desktop.
- Carrinho: itens, quantidades, subtotal e origem.
- Rodapé: usa o mesmo número configurado, sem valor fixo duplicado.

## Mensagens de produto

As mensagens incluem:

- intenção do cliente;
- nome do produto;
- preço exibido no site;
- link direto da página do produto;
- pergunta curta para o vendedor responder.

Dados pessoais e dados de financiamento, como e-mail, telefone, CPF e renda,
não são colocados na URL. Se forem necessários, o cliente os envia diretamente
durante a conversa.

## Respostas automáticas

A migration `20260928061134_enable_reactive_whatsapp_ai.sql` reativa
`whatsapp_ai_enabled`, mantendo `whatsapp_followup_enabled` desligado. Portanto,
o robô responde perguntas recebidas, mas não inicia conversas nem envia lembretes
sozinho.

No painel, abra **Atendente IA** para ligar/desligar as respostas e cadastrar as
perguntas frequentes. Em **Configurações**, preencha endereço e horário de
funcionamento; o robô usa esses campos e não deve inventar informações ausentes.

Para funcionar em produção, a Meta Cloud API deve apontar o webhook para a Edge
Function `whatsapp-webhook`, com os secrets `WHATSAPP_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` e `ANTHROPIC_API_KEY`.

## Checklist rápido

1. Abra um produto no celular.
2. Toque em cada ação do WhatsApp.
3. Confirme o número da loja.
4. Confira produto, preço, link e intenção no texto preenchido.
5. Faça o mesmo no botão flutuante e no carrinho.
