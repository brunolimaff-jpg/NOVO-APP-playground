# Segurança da API (explicação direta, sem jargão)

## Pergunta: "Tem como esconder a chave API sem backend?"

**Resposta curta: não.**

Se a chamada da IA acontece no frontend (navegador), a chave sempre pode ser descoberta.

## Por quê?

Porque o navegador precisa receber tudo para executar o app, incluindo o que for necessário para chamar a API.

## Então qual é o jeito certo?

Usar um backend (pode ser mínimo):

- Vercel Functions (`/api/*.ts`)
- Netlify Functions
- Cloudflare Workers

O frontend chama o backend, e o backend chama a IA com a chave guardada no servidor.

---

## Nível de proteção (resumo)

- **Frontend puro com chave:** inseguro
- **Frontend + serverless:** seguro para produção (quando bem configurado)

---

## O que fazer agora neste projeto

1. **Não commitar `.env`**.
2. Configurar variáveis no painel do deploy (ex.: Vercel).
3. Tratar `GEMINI_API_KEY` como segredo de servidor.
4. Usar o endpoint serverless dedicado já existente: `POST /api/gemini`.

---

## Paliativos (não são proteção total)

Se você ainda não conseguir migrar agora:

- limitar quota da chave;
- ativar alertas de uso;
- restringir por domínio/IP (se o provedor permitir).

Isso ajuda, mas não substitui backend.

---

## Linguagem simples para lembrar

> "Se está no navegador, não está escondido."
