# WhatsApp da Daniel Bike Shop — click-to-chat

O site usa o WhatsApp como **canal de conversão humana**. Não é necessário
Meta Cloud API, webhook, n8n ou modelo de IA: cada CTA abre o WhatsApp da loja
com uma mensagem pronta, e um vendedor continua o atendimento normalmente.

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

## Sem respostas automáticas

A migration `20260927000000_disable_whatsapp_automation.sql` mantém
`whatsapp_ai_enabled` e `whatsapp_followup_enabled` desativados. A rota antiga
do painel do atendente automático não aparece mais no menu.

As Edge Functions antigas permanecem no repositório apenas como histórico e
não devem ser publicadas. Caso já tenham sido implantadas em um ambiente,
aplique as migrations mais recentes para garantir que os toggles fiquem
desligados.

## Checklist rápido

1. Abra um produto no celular.
2. Toque em cada ação do WhatsApp.
3. Confirme o número da loja.
4. Confira produto, preço, link e intenção no texto preenchido.
5. Faça o mesmo no botão flutuante e no carrinho.
