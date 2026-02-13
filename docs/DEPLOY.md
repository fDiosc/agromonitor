# Guia de Deploy - MERX AGRO Monitor

Este documento descreve o processo de deploy do MERX AGRO Monitor no CapRover.

---

## Pré-requisitos

- CapRover instalado e configurado
- Acesso ao servidor CapRover
- CLI do CapRover instalada (`npm install -g caprover`)
- Repositório Git configurado

---

## Arquivos de Deploy

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile` | Imagem Docker multi-stage otimizada para Next.js |
| `captain-definition` | Configuração do CapRover |
| `.dockerignore` | Arquivos ignorados no build Docker |
| `next.config.js` | Configuração com `output: 'standalone'` |

---

## Variáveis de Ambiente

Configure as seguintes variáveis no painel do CapRover:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | ✅ | URL de conexão PostgreSQL (Neon) |
| `GEMINI_API_KEY` | ✅ | Chave da API Google Gemini |
| `MERX_API_URL` | ✅ | URL da API Merx |
| `JWT_SECRET` | ✅ | Chave secreta para tokens JWT |
| `CORS_PROXY_URL` | ❌ | URL do proxy CORS (opcional) |
| `S3_ACCESS_KEY_ID` | ❌* | AWS Access Key ID para armazenamento de imagens |
| `S3_SECRET_ACCESS_KEY` | ❌* | AWS Secret Access Key |
| `S3_BUCKET` | ❌* | Nome do bucket S3 (default: `pocs-merxlabs`) |
| `S3_REGION` | ❌* | Região AWS (default: `us-east-1`) |
| `S3_ENDPOINT` | ❌ | Endpoint customizado (apenas para R2/MinIO) |

> *Variáveis S3 são necessárias se a funcionalidade de persistência de imagens estiver habilitada.

### Exemplo de Configuração

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
GEMINI_API_KEY=AIzaSy...
MERX_API_URL=https://homolog.api.merx.tech/api/monitoramento
JWT_SECRET=sua-chave-secreta-muito-segura-aqui
CORS_PROXY_URL=https://corsproxy.io/?

# Armazenamento S3 (v0.0.34)
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=pocs-merxlabs
S3_REGION=us-east-1
```

> ⚠️ **IMPORTANTE**: Em produção, use uma `JWT_SECRET` forte e única!

---

## Processo de Deploy

### Opção 1: Deploy via CLI (Recomendado)

1. **Login no CapRover**
   ```bash
   caprover login
   ```

2. **Criar a aplicação no CapRover** (se ainda não existe)
   ```bash
   # Via painel web do CapRover ou:
   caprover api --path /user/apps/appDefinitions --method POST --data '{"appName":"merx-agro"}'
   ```

3. **Deploy**
   ```bash
   cd merx-agro-mvp
   caprover deploy
   ```

4. **Selecione a aplicação** quando solicitado

### Opção 2: Deploy via Git Push

1. **Adicionar remote do CapRover**
   ```bash
   git remote add caprover captain@SEU_SERVIDOR:merx-agro
   ```

2. **Push para deploy**
   ```bash
   git push caprover main
   ```

### Opção 3: Deploy via Tarball

1. **Criar tarball**
   ```bash
   tar -cvf deploy.tar --exclude='node_modules' --exclude='.git' --exclude='.next' .
   ```

2. **Upload via painel do CapRover**
   - Acesse o painel web
   - Vá para sua aplicação
   - Em "Deployment", faça upload do `deploy.tar`

---

## Configuração Pós-Deploy

### 1. Configurar Variáveis de Ambiente

No painel do CapRover:
1. Acesse a aplicação `merx-agro`
2. Vá para a aba "App Configs"
3. Adicione todas as variáveis listadas acima
4. Salve e aguarde o restart

### 2. Habilitar HTTPS

1. Vá para a aba "HTTP Settings"
2. Clique em "Enable HTTPS"
3. Marque "Force HTTPS"

### 3. Configurar Domínio (Opcional)

1. Vá para "HTTP Settings"
2. Adicione seu domínio customizado
3. Configure o DNS (CNAME ou A record)

---

## Migrations do Banco

As migrations do Prisma devem ser executadas manualmente na primeira vez:

1. **Acesse o terminal do container**
   ```bash
   # Via CapRover CLI
   caprover api --path /user/apps/appData/merx-agro --method GET
   # Ou via painel > App > Terminal
   ```

2. **Execute as migrations**
   ```bash
   npx prisma migrate deploy
   ```

> **Nota**: O `prisma generate` é executado automaticamente durante o build.

---

## Monitoramento

### Health Check

O Dockerfile inclui um health check que verifica:
- Endpoint: `GET /api/templates`
- Intervalo: 30s
- Timeout: 10s
- Retries: 3

### Logs

Via painel do CapRover:
- Acesse a aplicação
- Vá para "Deployment" > "View App Logs"

Via CLI:
```bash
caprover api --path /user/apps/appData/merx-agro/logs --method GET
```

---

## Troubleshooting

### Build falha com erro de Prisma

**Problema**: `prisma generate` falha durante o build.

**Solução**: Verifique se o `prisma/schema.prisma` está presente e correto.

### Aplicação não inicia

**Problema**: Container inicia mas aplicação não responde.

**Soluções**:
1. Verifique as variáveis de ambiente
2. Verifique se `DATABASE_URL` está acessível do servidor
3. Verifique os logs para erros específicos

### Erro de conexão com banco

**Problema**: Erro de conexão PostgreSQL.

**Soluções**:
1. Verifique se o IP do servidor CapRover está liberado no Neon
2. Verifique se `sslmode=require` está na connection string
3. Teste a conexão manualmente

### Erro 502 Bad Gateway

**Problema**: CapRover retorna 502.

**Soluções**:
1. Verifique se a porta 3000 está exposta no Dockerfile
2. Verifique se `HOSTNAME=0.0.0.0` está configurado
3. Aguarde alguns segundos após o deploy

---

## Estrutura do Dockerfile

```
┌─────────────────────────────────────────┐
│  Stage 1: deps                          │
│  - Instala node_modules                 │
│  - Copia prisma schema                  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Stage 2: builder                       │
│  - Copia código fonte                   │
│  - Gera Prisma client                   │
│  - Executa npm run build                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Stage 3: runner                        │
│  - Imagem final (slim)                  │
│  - Apenas arquivos necessários          │
│  - Usuário non-root (nextjs)            │
│  - Health check configurado             │
└─────────────────────────────────────────┘
```

---

## Checklist de Deploy

- [ ] Variáveis de ambiente configuradas no CapRover
- [ ] `JWT_SECRET` é uma string forte e única
- [ ] `DATABASE_URL` aponta para o banco correto
- [ ] IP do servidor liberado no Neon (se aplicável)
- [ ] HTTPS habilitado
- [ ] Migrations executadas (`prisma migrate deploy`)
- [ ] Health check passando
- [ ] Teste de login funcionando
- [ ] Teste de processamento de talhão funcionando
- [ ] Variáveis S3 configuradas (se usando persistência de imagens)
- [ ] Bucket S3 criado e acessível com as credenciais fornecidas

---

## Versão

| Item | Valor |
|------|-------|
| Versão do App | 0.0.8 (Alpha) |
| Node.js | 18 |
| Next.js | 14.2.18 |
| Prisma | 5.22.0 |
