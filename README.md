# SaaS Agendamento

Sistema genérico de agendamento e gestão para prestadores de serviço.  
Arquitetura: **Flask (Python) + React + Vite + Supabase**.

Dois demos pré-configurados prontos para testar com clientes:

| Demo | Comando | Acento | Terminologia |
|------|---------|--------|--------------|
| Barbearia | `npm run dev:barbearia` | Dourado | Corte, Barba, Serviço |
| Tatuador | `npm run dev:tatuador` | Roxo | Sessão, Briefing, Tattoo |

---

## Índice

- [Arquitetura](#arquitetura)
- [Setup completo](#setup-completo)
- [Rodar localmente](#rodar-localmente)
- [Configurar um novo cliente](#configurar-um-novo-cliente)
- [Referência da API](#referência-da-api)
- [Estrutura de arquivos](#estrutura-de-arquivos)
- [Segurança](#segurança)
- [Supabase — passo a passo](#supabase--passo-a-passo)
- [Deploy](#deploy)
- [Roadmap](#roadmap)

---

## Arquitetura

```
Browser (React)
      │
      │  JWT em sessionStorage
      │  axios → http://localhost:5000
      ▼
Flask API (Python)          ← único lugar com a service_role key
      │
      │  supabase-py (service_role)
      ▼
Supabase (PostgreSQL)
  RLS: anon key bloqueada via deny_all policies
```

**Por que Flask na frente do Supabase?**

- A `service_role key` (acesso total ao banco) nunca sai do servidor — o browser nunca a vê.
- Rate limiting, brute force protection e headers de segurança ficam centralizados.
- Qualquer lógica de negócio fica no backend, não exposta no bundle JS.
- A `anon key` do Supabase foi bloqueada via RLS: mesmo que alguém a descubra, não acessa nada.

---

## Setup completo

### Pré-requisitos

- Python 3.11+
- Node.js 18+
- Conta no [Supabase](https://supabase.com) (free tier funciona)

---

### 1. Supabase — criar as tabelas

1. Abra seu projeto no Supabase → **SQL Editor**
2. Copie o conteúdo de `sql/setup.sql` e execute
3. Vai criar: todas as tabelas, RLS policies, função `decrementar_estoque`, dados de exemplo (serviços e produtos)

> Se quiser dados de tatuador ao invés de barbearia, descomente o bloco "TATUADOR" e comente o bloco "BARBEARIA" no arquivo SQL antes de executar.

---

### 2. Supabase — pegar as credenciais

No painel Supabase → **Settings → API**:

- Copie a **Project URL** → vai para `SUPABASE_URL`
- Copie a **service_role** secret → vai para `SUPABASE_SERVICE_ROLE_KEY`  
  _(NÃO use a anon key aqui — use a service_role)_

---

### 3. Backend — configurar e instalar

```bash
cd saas-agendamento/backend

# Copiar o arquivo de variáveis
cp .env.example .env
```

Edite o `.env` e preencha:

```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...    # a chave service_role

# Gere um JWT_SECRET seguro com o comando abaixo:
# python3 -c "import secrets; print(secrets.token_hex(64))"
JWT_SECRET=cole_aqui_o_resultado

FRONTEND_URL=http://localhost:5173
FLASK_ENV=development
DEBUG=true
```

Instalar dependências e criar o admin:

```bash
# Criar ambiente virtual (recomendado)
python3 -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# Instalar
pip install -r requirements.txt

# Criar o usuário administrador
# Troque "admin" e "suaSenha123" pelos valores que quiser
python create_admin.py admin suaSenha123
```

---

### 4. Frontend — instalar

```bash
cd saas-agendamento/frontend
npm install
```

---

## Rodar localmente

Abra dois terminais:

**Terminal 1 — Backend:**
```bash
cd saas-agendamento/backend
source venv/bin/activate
python app.py
# → rodando em http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd saas-agendamento/frontend

# Demo barbearia:
npm run dev:barbearia

# OU demo tatuador:
npm run dev:tatuador

# → abre em http://localhost:5173
```

Acesse `http://localhost:5173` no browser.  
Painel admin: `http://localhost:5173/admin/login`

---

## Configurar um novo cliente

Todo o comportamento visual e textual de um negócio específico fica em um único arquivo de config.

### Passo 1 — Criar o arquivo de config

Crie `frontend/src/config/meu-cliente.js` baseado em um dos existentes:

```js
const meuCliente = {
  // Identidade
  nome: 'NOME DO NEGÓCIO',
  tagline: 'Slogan aqui',
  icone: '✂',   // emoji ou símbolo

  // Cores (qualquer cor CSS válida)
  cores: {
    acento:       '#c9a84c',   // cor principal
    acentoClaro:  '#e8c97a',   // hover/destaque
    acentoEscuro: '#8a6f2e',   // gradient escuro
    sombraAcento: 'rgba(201,168,76,0.25)',
    bgAcento:     'rgba(201,168,76,0.04)',
  },

  // Textos da UI
  termos: {
    servico:           'serviço',
    Servico:           'Serviço',
    servicos:          'serviços',
    Servicos:          'Serviços',
    agendar:           'Agendar horário',
    notas_placeholder: 'Observações (opcional)',
    notas_label:       'Observações',
    historico_titulo:  'Meu histórico',
    home_titulo:       'O que vamos fazer?',
    home_subtitulo:    'Escolha uma opção',
  },

  // false = sem campos extras no booking
  // true  = mostra campos adicionais (como tattoo)
  camposExtras: false,

  // Duração padrão ao sugerir horários no admin
  duracaoPadrao: 30,

  // Horários de funcionamento (para sugestão no painel admin)
  horariosFuncionamento: {
    inicio: '09:00',
    fim: '19:00',
    intervalos: 30,   // minutos entre cada slot
  },
}

export default meuCliente
```

### Passo 2 — Registrar no index

Em `frontend/src/config/index.js`, adicione o novo config:

```js
import barbearia from './barbearia.js'
import tatuador  from './tatuador.js'
import meuCliente from './meu-cliente.js'    // ← adicione

const configs = { barbearia, tatuador, 'meu-cliente': meuCliente }  // ← adicione
```

### Passo 3 — Criar o arquivo .env

```bash
# frontend/.env.meu-cliente
VITE_API_URL=http://localhost:5000
VITE_BUSINESS_MODE=meu-cliente
```

### Passo 4 — Adicionar script no package.json (opcional)

```json
"dev:meu-cliente": "vite --mode meu-cliente",
"build:meu-cliente": "vite build --mode meu-cliente"
```

### Passo 5 — Popular os serviços no banco

No Supabase SQL Editor, insira os serviços do cliente:

```sql
INSERT INTO servicos (nome, descricao, preco, duracao_minutos, categoria) VALUES
  ('Nome do serviço', 'Descrição', 100.00, 60, 'categoria');
```

Ou faça isso pelo painel admin em `/admin/servicos`.

---

## Referência da API

Base URL: `http://localhost:5000`

### Autenticação

Todas as rotas protegidas exigem:
```
Authorization: Bearer <jwt_token>
```

---

### Auth — `/api/auth`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/register` | Nenhuma | Cria conta de cliente |
| POST | `/api/auth/login` | Nenhuma | Login do cliente (retorna JWT) |
| POST | `/api/auth/admin/login` | Nenhuma | Login do admin (retorna JWT) |

**POST /api/auth/register**
```json
{ "nome": "João Silva", "telefone": "11999999999", "senha": "minimo6" }
```
Retorna: `{ "token": "...", "cliente": { "id": "...", "nome": "...", "telefone": "..." } }`

**POST /api/auth/login**
```json
{ "telefone": "11999999999", "senha": "minimo6" }
```

**POST /api/auth/admin/login**
```json
{ "usuario": "admin", "senha": "suaSenha" }
```

---

### Serviços — `/api/services`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/services` | Nenhuma | Lista serviços ativos |
| POST | `/api/services` | Admin | Cria serviço |
| PUT | `/api/services/:id` | Admin | Atualiza serviço |
| DELETE | `/api/services/:id` | Admin | Desativa serviço |

**POST/PUT body:**
```json
{
  "nome": "Corte simples",
  "descricao": "Opcional",
  "preco": 35.00,
  "duracao_minutos": 30,
  "categoria": "corte"
}
```

---

### Agendamentos — `/api/appointments`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/appointments/slots?date=YYYY-MM-DD` | Nenhuma | Horários disponíveis |
| POST | `/api/appointments/slots` | Admin | Adiciona horários disponíveis |
| DELETE | `/api/appointments/slots/:id` | Admin | Remove um horário disponível |
| POST | `/api/appointments` | Cliente | Cria agendamento |
| GET | `/api/appointments/mine` | Cliente | Histórico do cliente |
| GET | `/api/appointments/day?date=YYYY-MM-DD` | Admin | Agenda do dia |
| PUT | `/api/appointments/:id/status` | Admin | Atualiza status |
| DELETE | `/api/appointments/:id` | Cliente | Cancela agendamento próprio |

**POST /api/appointments/slots** (admin adiciona horários para um dia):
```json
{ "data": "2025-06-15", "horas": ["09:00", "09:30", "10:00", "14:00"] }
```

**POST /api/appointments** (cliente cria agendamento):
```json
{
  "servico_id": "uuid",
  "data": "2025-06-15",
  "hora": "09:00",
  "notas": "Observação opcional"
}
```

**PUT /api/appointments/:id/status** (admin):
```json
{ "status": "confirmado" }
// Valores válidos: pendente | confirmado | concluido | cancelado
```

---

### Produtos — `/api/products`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/products` | Nenhuma | Lista produtos ativos |
| POST | `/api/products` | Admin | Cria produto |
| PUT | `/api/products/:id` | Admin | Atualiza produto |
| PUT | `/api/products/:id/stock` | Admin | Atualiza só a quantidade |
| DELETE | `/api/products/:id` | Admin | Desativa produto |

**PUT /api/products/:id/stock:**
```json
{ "quantidade": 15 }
```

---

### Pedidos — `/api/orders`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/orders` | Cliente | Cria pedido |
| GET | `/api/orders` | Admin | Lista todos os pedidos |
| PUT | `/api/orders/:id/confirm` | Admin | Confirma pagamento |

**POST /api/orders:**
```json
{
  "agendamento_id": "uuid ou null",
  "itens": [
    { "produto_id": "uuid", "quantidade": 2, "preco_unitario": 6.00 }
  ],
  "total": 12.00,
  "metodo_pagamento": "pix"
}
```

---

### Admin — `/api/admin`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/admin/dashboard` | Admin | Stats do dia + receita 7 dias |
| GET | `/api/admin/clients` | Admin | Lista todos os clientes |
| PUT | `/api/admin/clients/:id/notes` | Admin | Salva nota sobre o cliente |
| PUT | `/api/admin/clients/:id/toggle` | Admin | Ativa/bloqueia cliente |

---

### Export — `/api/admin/export`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/admin/export/csv` | Admin | Baixa ZIP com 4 CSVs |

O ZIP contém:
- `clientes_YYYYMMDD_HHMM.csv`
- `agendamentos_YYYYMMDD_HHMM.csv`
- `financeiro_YYYYMMDD_HHMM.csv`
- `estoque_YYYYMMDD_HHMM.csv`

---

## Estrutura de arquivos

```
saas-agendamento/
│
├── sql/
│   └── setup.sql               Schema do banco + RLS + dados de exemplo
│
├── backend/
│   ├── .env.example            Template de variáveis de ambiente
│   ├── requirements.txt        Dependências Python
│   ├── app.py                  Entry point Flask — registra blueprints e middleware
│   ├── config.py               Lê todas as env vars em um lugar só
│   ├── database.py             Singleton do cliente Supabase (service_role)
│   ├── create_admin.py         Script CLI para criar/atualizar o admin
│   │
│   ├── middleware/
│   │   ├── auth.py             Decorators @require_client e @require_admin (JWT)
│   │   └── security.py        Headers de segurança injetados em todas as respostas
│   │
│   └── routes/
│       ├── auth.py             /api/auth/* — register, login, admin/login
│       ├── services.py         /api/services — CRUD de serviços
│       ├── appointments.py     /api/appointments — slots + agendamentos
│       ├── products.py         /api/products — CRUD de produtos + estoque
│       ├── orders.py           /api/orders — pedidos + confirmação de pagamento
│       ├── admin.py            /api/admin — dashboard, clientes, notas
│       └── export.py           /api/admin/export — download CSV/ZIP
│
└── frontend/
    ├── .env.example            Template
    ├── .env.barbearia          Config de ambiente para demo barbearia
    ├── .env.tatuador           Config de ambiente para demo tatuador
    ├── package.json            Scripts npm + dependências
    ├── vite.config.js          Injeta __BUSINESS_MODE__ no bundle
    ├── index.html
    │
    └── src/
        ├── main.jsx            Entry point — chama applyTheme() antes de renderizar
        ├── App.jsx             Rotas (React Router)
        │
        ├── config/
        │   ├── index.js        Carrega o config certo + applyTheme()
        │   ├── barbearia.js    Config completa: cores, nome, terminologia, horários
        │   └── tatuador.js     Config completa para estúdio de tatuagem
        │
        ├── services/
        │   └── api.js          Axios instance + todos os endpoints organizados por domínio
        │                       (authAPI, servicesAPI, appointmentsAPI, productsAPI, ordersAPI, adminAPI)
        │
        ├── contexts/
        │   ├── AuthContext.jsx  Estado de auth global — cliente e admin, JWT em sessionStorage
        │   └── CartContext.jsx  Carrinho de produtos em memória
        │
        ├── components/
        │   ├── guards/
        │   │   └── RouteGuard.jsx   ClienteGuard e AdminGuard (redirect se não autenticado)
        │   └── layout/
        │       └── BottomNav.jsx    Navegação inferior do cliente (config-aware)
        │
        ├── pages/
        │   ├── Welcome.jsx     Tela inicial — logo do negócio + botões entrar/registrar
        │   ├── Login.jsx       Login do cliente por telefone + senha
        │   ├── Register.jsx    Cadastro de novo cliente
        │   ├── ClientHome.jsx  Home do cliente — próximo agendamento + menu rápido
        │   ├── Booking.jsx     Agendamento em etapas (2 ou 3 etapas dependendo do config)
        │   ├── Products.jsx    Lista de produtos com carrinho inline
        │   ├── Payment.jsx     Resumo do pedido + escolha de método de pagamento
        │   ├── History.jsx     Histórico de agendamentos + opção de cancelar
        │   │
        │   └── admin/
        │       ├── AdminLogin.jsx      Login do admin
        │       ├── AdminDashboard.jsx  Dashboard com stats + navegação admin
        │       ├── AdminSchedule.jsx   Agenda do dia + gerenciar slots disponíveis
        │       ├── AdminClients.jsx    Lista de clientes + notas + bloquear/reativar
        │       ├── AdminServices.jsx   CRUD de serviços
        │       ├── AdminStock.jsx      Estoque + alertas de mínimo
        │       ├── AdminFinancial.jsx  Pedidos + confirmação de pagamento
        │       └── AdminExport.jsx     Download de backup CSV
        │
        └── styles/
            └── global.css      Design system completo — tokens via CSS custom properties
```

---

## Segurança

### O que está implementado

**Backend:**

| Camada | O que faz |
|--------|-----------|
| `service_role key` no servidor | A chave de acesso total ao banco nunca chega no browser |
| RLS deny_all no Supabase | Anon key bloqueada — inútil mesmo que seja descoberta |
| Rate limiting (Flask-Limiter) | 5 tentativas de login/min por IP, 200 req/min geral |
| Brute force protection | Bloqueia IP por 15 min após 10 falhas consecutivas |
| JWT com expiração | Cliente: 7 dias · Admin: 8 horas |
| Validação com Pydantic | Todos os inputs são validados antes de tocar o banco |
| Audit log | Logins admin (sucesso e falha) registrados na tabela `audit_log` |
| Security headers | CSP, X-Frame-Options DENY, X-Content-Type-Options, HSTS (produção), Referrer-Policy |
| CORS estrito | Só aceita a URL do frontend configurada em `FRONTEND_URL` |

**Frontend:**

| Camada | O que faz |
|--------|-----------|
| JWT em `sessionStorage` | Limpa automaticamente quando o browser fecha |
| Sem Supabase client | O frontend nunca se conecta diretamente ao Supabase |
| Validação de expiração | Verifica o `exp` do JWT ao restaurar sessão |
| Route guards | Redireciona para login se não autenticado |

### O que fazer antes de ir para produção

- [ ] Trocar `DEBUG=false` no `.env` do backend
- [ ] Configurar `FLASK_ENV=production`
- [ ] Usar HTTPS (o HSTS só ativa com `DEBUG=false`)
- [ ] Trocar a senha do admin pelo `create_admin.py`
- [ ] Usar Redis no Flask-Limiter ao invés de `memory://` (para múltiplas instâncias)
- [ ] Configurar CORS com a URL real de produção (`FRONTEND_URL`)
- [ ] Ativar os logs do Flask em arquivo para auditoria

---

## Supabase — passo a passo

### Criar o projeto

1. Acesse [supabase.com](https://supabase.com) → New Project
2. Escolha uma senha forte para o banco
3. Aguarde a inicialização (~2 min)

### Executar o SQL de setup

1. No menu esquerdo: **SQL Editor**
2. Clique em **New query**
3. Cole o conteúdo de `sql/setup.sql`
4. Clique **Run**

### Pegar as credenciais

1. No menu: **Settings → API**
2. Copie:
   - **Project URL** → `SUPABASE_URL` no `.env` do backend
   - **service_role** (em "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

> A `anon` key NÃO é usada nesta arquitetura. Deixe ela onde está.

### Verificar se o SQL rodou certo

No menu **Table Editor**, você deve ver as tabelas:
- `clientes`, `servicos`, `agendamentos`, `produtos`, `pedidos`, `pedido_itens`, `admin`, `audit_log`, `login_tentativas`

### Verificar o RLS

1. Clique em qualquer tabela → **Auth policies**
2. As tabelas sensíveis devem ter uma policy `deny_all` para `anon`
3. `servicos` e `produtos` devem ter `public_read` para `anon`

---

## Deploy

### Backend — Render (gratuito para começar)

1. Crie uma conta em [render.com](https://render.com)
2. New → **Web Service** → conecte o repositório
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `gunicorn app:app`
5. Adicione as variáveis de ambiente (as mesmas do `.env`)
6. Anote a URL gerada (ex: `https://seu-app.onrender.com`)

```bash
# Adicionar gunicorn ao requirements.txt antes do deploy:
echo "gunicorn==21.2.0" >> backend/requirements.txt
```

### Frontend — Vercel (gratuito)

1. Crie conta em [vercel.com](https://vercel.com)
2. Import do repositório
3. **Root Directory:** `frontend`
4. **Build Command:** `npm run build:barbearia` (ou tatuador)
5. Variáveis de ambiente:
   - `VITE_API_URL` = URL do seu backend no Render
   - `VITE_BUSINESS_MODE` = `barbearia` ou `tatuador`

### Para múltiplos clientes no Vercel

Crie um projeto separado no Vercel para cada cliente, apontando para o mesmo repositório mas com variáveis de ambiente diferentes (nome do negócio, modo, URL do backend do cliente).

---

## Roadmap

Funcionalidades planejadas para versões futuras:

### Alta prioridade
- [ ] **Notificações WhatsApp** via Evolution API — confirmação de agendamento automática
- [ ] **Upload de foto de referência** no booking do tatuador (Supabase Storage)
- [ ] **Reagendamento** pelo cliente (mudar data/hora de um agendamento existente)
- [ ] **Múltiplos profissionais** — mais de um barbeiro/tatuador por negócio

### Média prioridade
- [ ] **Gráfico de receita** no dashboard admin (últimos 30 dias)
- [ ] **Página de perfil do cliente** — trocar nome/telefone/senha
- [ ] **Modo offline básico** — PWA com service worker para funcionar sem internet
- [ ] **Horários recorrentes** — admin configura grade semanal de uma vez (ex: seg–sex 9h–19h)
- [ ] **Depósito/sinal** para tatuadores — valor parcial na hora do agendamento

### Baixa prioridade / Nice to have
- [ ] **Avaliação pós-atendimento** — cliente deixa uma nota (1–5 estrelas)
- [ ] **Relatório mensal em PDF** gerado pelo backend
- [ ] **Login social** — Google ou WhatsApp ao invés de telefone/senha
- [ ] **Multi-idioma** — i18n via config
- [ ] **Dark/light theme toggle** — atualmente só dark

---

## Fluxo de desenvolvimento recomendado

Para adicionar uma nova funcionalidade:

1. **SQL** — Se precisar de nova tabela/coluna, adicione ao `sql/setup.sql` e rode no Supabase
2. **Backend** — Crie ou edite a rota em `backend/routes/` com validação Pydantic
3. **API service** — Adicione a chamada em `frontend/src/services/api.js`
4. **Página/componente** — Crie ou edite em `frontend/src/pages/`
5. **Config** — Se for feature dependente de negócio, adicione nos arquivos de config

### Convenções

- Rotas de cliente usam o decorator `@require_client`
- Rotas de admin usam `@require_admin`
- Toda validação de input fica no backend via Pydantic
- CSS por página fica no arquivo `.css` ao lado do `.jsx`
- Tokens de design ficam em `global.css` como CSS custom properties
- Cores do negócio são sempre via `var(--cor-acento)` — nunca hardcoded

---

## Dependências

### Backend
```
flask              Framework web
flask-cors         CORS policy
flask-limiter      Rate limiting por IP
PyJWT              Geração e validação de tokens JWT
bcrypt             Hash de senhas (rounds=12)
supabase           Cliente Python do Supabase
pydantic           Validação de schemas de input
python-dotenv      Leitura do arquivo .env
```

### Frontend
```
react              UI library
react-dom          Renderer
react-router-dom   Roteamento client-side
axios              HTTP client com interceptors
vite               Build tool + dev server
```

---

## Variáveis de ambiente — referência completa

### Backend (`backend/.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave service_role (acesso total) |
| `JWT_SECRET` | Sim | Segredo para assinar tokens JWT (mín. 64 chars) |
| `FRONTEND_URL` | Sim | URL do frontend para CORS |
| `FLASK_ENV` | Não | `development` ou `production` |
| `DEBUG` | Não | `true` ou `false` |
| `RATE_LIMIT_DEFAULT` | Não | Padrão: `200 per minute` |
| `RATE_LIMIT_AUTH` | Não | Padrão: `5 per minute` |
| `RATE_LIMIT_ADMIN_AUTH` | Não | Padrão: `3 per minute` |
| `RATE_LIMIT_EXPORT` | Não | Padrão: `2 per minute` |

### Frontend (`frontend/.env`)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_URL` | Sim | URL base do backend Flask |
| `VITE_BUSINESS_MODE` | Sim | `barbearia` ou `tatuador` (ou chave do seu config) |
