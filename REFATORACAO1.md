# Plano de Refatoração v1 - Multi-tenancy e Autenticação

## Sumário Executivo

Este documento detalha as mudanças necessárias para implementar:
1. **Multi-tenancy** - Isolamento de dados por workspace/empresa
2. **Autenticação** - Sistema de login com gestão de usuários (sem integração de email, processo manual)
3. **Nova UI** - Sidebar com navegação e changelog no rodapé

**Princípio fundamental:** Nenhuma funcionalidade existente deve ser afetada. O produto deve continuar funcionando exatamente como antes, apenas com camadas adicionais de segurança e organização.

---

## 1. Estrutura de Banco de Dados - Multi-tenancy

### 1.1 Novo Modelo: Workspace

```prisma
model Workspace {
  id          String   @id @default(cuid())
  name        String   // Nome da empresa
  slug        String   @unique // URL amigável (ex: "merx", "trading-abc")
  logo        String?  // URL do logo
  isActive    Boolean  @default(true)
  
  // Configurações do workspace
  settings    String?  // JSON com configurações específicas
  
  // Limites e quotas
  maxFields   Int      @default(100)
  maxUsers    Int      @default(10)
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relações
  users       User[]
  fields      Field[]
}
```

### 1.2 Novo Modelo: User

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  passwordHash    String
  
  // Status e controle
  isActive        Boolean   @default(true)
  role            UserRole  @default(VIEWER)
  mustChangePassword Boolean @default(true) // Força troca no primeiro login
  
  // Workspace
  workspaceId     String
  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  
  // Sessões
  lastLoginAt     DateTime?
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Audit trail
  createdFields   Field[]   @relation("CreatedBy")
  
  @@index([workspaceId])
  @@index([email])
}

enum UserRole {
  ADMIN       // Pode gerenciar usuários do workspace
  OPERATOR    // Pode criar/editar talhões
  VIEWER      // Apenas visualização
}
```

### 1.3 Alteração no Modelo Field

```prisma
model Field {
  id              String    @id @default(cuid())
  
  // ... campos existentes ...
  
  // NOVO: Relação com Workspace (obrigatório)
  workspaceId     String
  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  
  // NOVO: Quem criou
  createdById     String?
  createdBy       User?     @relation("CreatedBy", fields: [createdById], references: [id])
  
  @@index([workspaceId])
  @@index([workspaceId, status])
}
```

### 1.4 Migration Strategy

```
1. Criar tabelas Workspace e User
2. Criar workspace padrão "default" 
3. Adicionar workspaceId em Field (nullable inicialmente)
4. Migrar todos os Fields existentes para workspace "default"
5. Tornar workspaceId NOT NULL
6. Adicionar índices
```

---

## 2. Sistema de Autenticação

### 2.1 Fluxo de Criação de Usuário

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Admin     │────▶│  Cria User no   │────▶│  Comunica       │
│  do Sistema │     │  Sistema (com   │     │  credenciais    │
└─────────────┘     │  senha inicial) │     │  manualmente    │
                    └─────────────────┘     │  (WhatsApp/etc) │
                                            └───────┬─────────┘
                                                    │
                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌───────────────────┐
│   Usuário   │◀────│  Acessa     │◀────│   Usuário faz     │
│   Logado    │     │  Dashboard  │     │   login e troca   │
└─────────────┘     └─────────────┘     │   senha inicial   │
                                        └───────────────────┘
```

**Processo Manual:**
1. Admin cria usuário no sistema com senha temporária (ex: `Mudar@123`)
2. Admin comunica email + senha por WhatsApp, ligação ou email manual
3. Usuário acessa `/login` e faz login com credenciais
4. Sistema detecta `mustChangePassword = true` e redireciona para `/change-password`
5. Após trocar senha, usuário acessa o dashboard normalmente

### 2.2 Fluxo de Login

```
1. Usuário acessa /login
2. Insere email e senha
3. Sistema valida credenciais
4. SE mustChangePassword = true:
   - Redireciona para /change-password
   - Após trocar, seta mustChangePassword = false
5. SENÃO:
   - Cria sessão JWT
   - Redireciona para /dashboard
6. Todas as requisições incluem workspaceId do usuário
```

### 2.3 Endpoints de Autenticação

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/login` | POST | Login com email/senha |
| `/api/auth/logout` | POST | Encerrar sessão |
| `/api/auth/change-password` | POST | Trocar senha |
| `/api/auth/me` | GET | Dados do usuário logado |
| `/api/admin/users` | GET/POST | CRUD de usuários (admin do workspace) |
| `/api/admin/users/[id]` | GET/PUT/DELETE | Gestão de usuário |
| `/api/admin/workspaces` | GET/POST | CRUD de workspaces (super admin) |
| `/api/admin/users/[id]/reset-password` | POST | Reset de senha (admin define nova senha temp) |

**Nota:** Não há fluxo de "esqueci minha senha" automatizado. Se o usuário esquecer a senha, o admin do workspace reseta manualmente e comunica a nova senha temporária.

### 2.4 Middleware de Autenticação

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')
  
  // Rotas públicas
  if (request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next()
  }
  
  // Rotas protegidas
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Validar token e extrair workspaceId
  const payload = verifyToken(token)
  
  // Injetar workspaceId nos headers
  const response = NextResponse.next()
  response.headers.set('x-workspace-id', payload.workspaceId)
  response.headers.set('x-user-id', payload.userId)
  
  return response
}
```

### 2.5 Isolamento de Dados

**REGRA CRÍTICA:** Toda query ao banco DEVE incluir filtro por workspaceId.

```typescript
// ANTES (inseguro)
const fields = await prisma.field.findMany()

// DEPOIS (seguro)
const fields = await prisma.field.findMany({
  where: { workspaceId: session.workspaceId }
})
```

Implementar via:
1. **Prisma Middleware** - Intercepta todas as queries
2. **Wrapper de Prisma** - Função helper que injeta workspaceId
3. **Validação em cada endpoint** - Redundância de segurança

```typescript
// lib/prisma-tenant.ts
export function getPrismaWithTenant(workspaceId: string) {
  return prisma.$extends({
    query: {
      field: {
        async findMany({ args, query }) {
          args.where = { ...args.where, workspaceId }
          return query(args)
        },
        // ... outros métodos
      }
    }
  })
}
```

---

## 3. Nova Interface - Sidebar e Layout

### 3.1 Estrutura de Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  TOPBAR (opcional - pode ser minimalista)                        │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                      │
│  SIDEBAR   │                    CONTENT                          │
│            │                                                      │
│  ┌──────┐  │                                                      │
│  │ Logo │  │                                                      │
│  └──────┘  │                                                      │
│            │                                                      │
│  Dashboard │                                                      │
│  Talhões   │                                                      │
│  Logística │                                                      │
│  Relatórios│                                                      │
│            │                                                      │
│  ────────  │                                                      │
│            │                                                      │
│  Usuários* │                                                      │
│  Config*   │                                                      │
│            │                                                      │
│            │                                                      │
├────────────┼─────────────────────────────────────────────────────┤
│  FOOTER    │                                                      │
│  V 0.3.0   │  [Changelog] [Docs]           Powered by Merx       │
└────────────┴─────────────────────────────────────────────────────┘

* Apenas para role ADMIN
```

### 3.2 Componentes de Layout

```
components/
├── layout/
│   ├── AppLayout.tsx        # Layout principal com sidebar
│   ├── Sidebar.tsx          # Sidebar com navegação
│   ├── SidebarItem.tsx      # Item de menu
│   ├── SidebarFooter.tsx    # Rodapé com versão e changelog
│   ├── TopBar.tsx           # Barra superior (opcional)
│   ├── UserMenu.tsx         # Menu do usuário (dropdown)
│   └── ChangelogModal.tsx   # Modal de changelog
```

### 3.3 Itens da Sidebar

| Item | Ícone | Rota | Roles |
|------|-------|------|-------|
| Dashboard | `LayoutDashboard` | `/` | ALL |
| Talhões | `Map` | `/fields` | ALL |
| Diagnóstico Logístico | `Truck` | `/dashboard/logistics` | ALL |
| Relatórios | `FileText` | `/reports` | ALL |
| --- | --- | --- | --- |
| Usuários | `Users` | `/admin/users` | ADMIN |
| Configurações | `Settings` | `/settings` | ADMIN |

### 3.4 Rodapé com Changelog

```tsx
// components/layout/SidebarFooter.tsx
export function SidebarFooter() {
  const [showChangelog, setShowChangelog] = useState(false)
  
  return (
    <div className="p-4 border-t border-slate-700">
      <button 
        onClick={() => setShowChangelog(true)}
        className="flex items-center gap-2 text-slate-400 hover:text-white"
      >
        <span className="text-xs font-mono bg-slate-700 px-2 py-0.5 rounded">
          v0.3.0
        </span>
        <span className="text-xs">O que mudou?</span>
      </button>
      
      <p className="text-[10px] text-slate-500 mt-2">
        Powered by Merx
      </p>
      
      <ChangelogModal 
        open={showChangelog} 
        onClose={() => setShowChangelog(false)} 
      />
    </div>
  )
}
```

### 3.5 Configuração de Versão

```typescript
// lib/version.ts
export const APP_VERSION = '0.3.0'
export const CHANGELOG = [
  {
    version: '0.3.0',
    date: '2026-01-29',
    title: 'Diagnóstico Logístico',
    changes: [
      'Novo módulo de diagnóstico logístico',
      'Curva de recebimento (bell curve)',
      'Status PARTIAL para dados incompletos',
      'Mapa de propriedades'
    ]
  },
  {
    version: '0.2.0',
    date: '2026-01-29',
    title: 'Visualizações NDVI',
    changes: [
      'Linhas de referência no gráfico',
      'Curvas históricas',
      'Projeção de colheita'
    ]
  }
]
```

---

## 4. Plano de Implementação

### Fase 1: Preparação (1-2 dias)
- [ ] Backup do banco de dados atual
- [ ] Criar branch `feature/multi-tenancy`
- [ ] Documentar estado atual das tabelas

### Fase 2: Schema de Banco (1 dia)
- [ ] Criar modelo Workspace
- [ ] Criar modelo User
- [ ] Adicionar workspaceId em Field
- [ ] Criar migration
- [ ] Criar workspace e usuário padrão para testes

### Fase 3: Autenticação Backend (2 dias)
- [ ] Implementar JWT custom (mais leve que NextAuth)
- [ ] Criar endpoints de auth
- [ ] Implementar middleware de proteção
- [ ] Implementar Prisma tenant middleware
- [ ] Testes de isolamento de dados
- [ ] Criar script para gerar usuário admin inicial

### Fase 4: Autenticação Frontend (1 dia)
- [ ] Página de login
- [ ] Página de troca de senha
- [ ] Context de autenticação
- [ ] Proteção de rotas

### Fase 5: Nova UI (2 dias)
- [ ] Componente AppLayout
- [ ] Componente Sidebar
- [ ] Migrar páginas existentes para novo layout
- [ ] Componente ChangelogModal
- [ ] Ajustes de responsividade

### Fase 6: Admin de Usuários (1 dia)
- [ ] Página de listagem de usuários
- [ ] Modal de criação de usuário
- [ ] Edição e desativação
- [ ] Validações de permissão

### Fase 7: Testes e Validação (1-2 dias)
- [ ] Teste de isolamento entre workspaces
- [ ] Teste de permissões por role
- [ ] Teste de fluxo de primeiro login
- [ ] Teste de funcionalidades existentes
- [ ] Code review

---

## 5. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Quebra de funcionalidades existentes | Alto | Testes extensivos, deploy gradual |
| Vazamento de dados entre workspaces | Crítico | Prisma middleware, code review |
| Performance com filtros adicionais | Médio | Índices otimizados, cache |
| Complexidade de migration | Médio | Backup, scripts de rollback |

---

## 6. Checklist de Segurança

### Antes do Deploy
- [ ] Todas as queries filtram por workspaceId
- [ ] Nenhum endpoint expõe dados de outros workspaces
- [ ] Senhas são hashadas com bcrypt (cost 12+)
- [ ] Tokens JWT têm expiração adequada
- [ ] Rate limiting em endpoints de auth
- [ ] Logs de auditoria para ações sensíveis

### Testes de Isolamento
```
1. Criar Workspace A com User A
2. Criar Workspace B com User B
3. User A cria Field X
4. User B tenta acessar Field X -> DEVE FALHAR
5. API retorna 404 (não 403, para não revelar existência)
```

---

## 7. Arquivos a Criar/Modificar

### Novos Arquivos
```
app/
├── login/page.tsx
├── change-password/page.tsx
├── admin/
│   └── users/
│       ├── page.tsx
│       └── [id]/page.tsx
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── logout/route.ts
│   │   ├── change-password/route.ts
│   │   └── me/route.ts
│   └── admin/
│       └── users/
│           ├── route.ts
│           └── [id]/route.ts

components/
├── layout/
│   ├── AppLayout.tsx
│   ├── Sidebar.tsx
│   ├── SidebarItem.tsx
│   ├── SidebarFooter.tsx
│   └── ChangelogModal.tsx
├── auth/
│   ├── LoginForm.tsx
│   └── ChangePasswordForm.tsx

lib/
├── auth.ts              # Utilitários de autenticação
├── prisma-tenant.ts     # Prisma com tenant isolation
├── version.ts           # Versão e changelog
└── middleware/
    └── auth.ts          # Middleware de auth

middleware.ts            # Middleware global Next.js
```

### Arquivos a Modificar
```
prisma/schema.prisma     # Novos modelos
app/layout.tsx           # Integrar AppLayout
app/page.tsx             # Proteger rota
app/api/fields/route.ts  # Filtrar por workspace
app/api/fields/[id]/*    # Filtrar por workspace
app/api/logistics/*      # Filtrar por workspace
components/layout/header.tsx # Substituir por Sidebar
```

---

## 8. Dependências a Adicionar

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "jose": "^5.2.0",          // JWT handling
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0"           // Validação
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6"
  }
}
```

---

## 9. Ordem de Execução Recomendada

```
1. ✅ Criar este documento de planejamento
2. ✅ Schema (Workspace, User adicionados)
3. ✅ Nova UI (Sidebar, AppLayout, Changelog)
4. ✅ Auth Backend (JWT, endpoints)
5. ✅ Auth Frontend (Login, Change Password)
6. ✅ Admin Usuários
7. ✅ Seed (workspace e admin padrão)
8. ✅ Migração de dados existentes
9. Deploy para ambiente de staging
10. Validação final
11. Deploy para produção
```

---

## 10. Status de Implementação

**Data:** 29/01/2026
**Status:** ✅ IMPLEMENTADO (v0.5.0)

### Credenciais de Acesso

```
Email: admin@merx.tech
Senha: Admin@123
Role: SUPER_ADMIN
(Será solicitada troca no primeiro login)
```

### Comandos para Setup

```bash
# Instalar dependências
npm install

# Aplicar schema no banco
npx prisma db push

# Criar workspace e admin
npm run db:seed

# Iniciar servidor
npm run dev
```

### Estrutura Final

```
app/
├── (authenticated)/          # Grupo de rotas autenticadas
│   ├── layout.tsx            # Layout com Sidebar
│   ├── page.tsx              # Dashboard principal
│   ├── admin/
│   │   ├── users/            # Gestão de usuários (ADMIN+)
│   │   └── workspaces/       # Gestão de workspaces (SUPER_ADMIN)
│   ├── dashboard/logistics/  # Diagnóstico logístico
│   ├── fields/new/           # Novo talhão
│   └── reports/[id]/         # Relatórios
├── login/                    # Página de login
├── change-password/          # Troca de senha
└── api/
    ├── auth/                 # Endpoints de autenticação
    └── admin/
        ├── users/            # CRUD de usuários
        └── workspaces/       # CRUD de workspaces (SUPER_ADMIN)
```

---

## 11. Funcionalidades Adicionais (v0.5.0)

### Gestão de Workspaces

Adicionada interface para SUPER_ADMIN gerenciar workspaces:

- **Listar workspaces**: Ver todos os clientes/empresas
- **Criar workspace**: Com opção de criar admin inicial junto
- **Configurar limites**: Máximo de usuários e talhões
- **Ativar/Desativar**: Toggle de status do workspace

### Fluxo de Criação de Empresa

```
1. SUPER_ADMIN acessa /admin/workspaces
2. Clica em "Novo Workspace"
3. Preenche dados da empresa:
   - Nome: "Trading ABC"
   - Slug: "trading-abc" (auto-gerado)
   - Limites de usuários/talhões
4. (Opcional) Preenche dados do admin inicial:
   - Nome, email, senha temporária
5. Clica em "Criar"
6. Comunica credenciais manualmente ao admin da empresa
7. Admin faz login, troca senha, começa a usar
```

### Hierarquia de Permissões

| Role | Workspaces | Usuários | Talhões |
|------|------------|----------|---------|
| SUPER_ADMIN | CRUD todos | CRUD todos | CRUD todos |
| ADMIN | Ver próprio | CRUD do workspace | CRUD do workspace |
| OPERATOR | Ver próprio | - | CRUD do workspace |
| VIEWER | Ver próprio | - | Ver do workspace |

---

## 12. Funcionalidades Adicionais (v0.6.0)

### Cadastro de Produtores

Nova entidade para gestão de produtores vinculados aos talhões:

```prisma
model Producer {
  id          String    @id @default(cuid())
  name        String    // Obrigatório
  cpf         String?   // Opcional
  workspaceId String
  workspace   Workspace @relation(...)
  fields      Field[]
}
```

**Endpoints:**
- `GET /api/producers` - Listar produtores do workspace
- `POST /api/producers` - Criar produtor
- `GET /api/producers/[id]` - Detalhes com talhões vinculados
- `PUT /api/producers/[id]` - Atualizar
- `DELETE /api/producers/[id]` - Excluir (se não tiver talhões)

**UI:** Nova página `/producers` acessível via sidebar

### Tipos de Cultura

Novo enum para diferenciar ciclos por cultura:

```prisma
enum CropType {
  SOJA   // Ciclo 120 dias, emergência 8 dias
  MILHO  // Ciclo 140 dias, emergência 7 dias
}
```

### Data de Plantio Informada

Campo opcional no cadastro de talhão:

```prisma
model Field {
  // ...
  plantingDateInput DateTime? // Informada pelo produtor
  cropType          CropType  @default(SOJA)
  producerId        String?
  producer          Producer?
}
```

**Comportamento:**
- Se informada, é usada como base 100% confiável
- SOS calculado: plantio + dias de emergência
- EOS projetado: plantio + ciclo da cultura
- +25 pontos no score de confiança

### Formulário de Talhão Atualizado

Novos campos:
- **Produtor Vinculado** (dropdown, opcional)
- **Cultura** (Soja/Milho, default Soja)
- **Data de Plantio** (opcional)

---

*Documento criado em: 29/01/2026*
*Versão: 1.3*
*Autor: Sistema*
*Última atualização: 30/01/2026 - Produtores e Culturas implementados (v0.6.0)*
