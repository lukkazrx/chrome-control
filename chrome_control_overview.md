# ChromeControl — Visão Geral do Projeto

## O que é

Sistema de **gestão de empréstimo de Chromebooks** para escolas. Controla quem pegou qual equipamento, quando deve devolver, envia e-mails de lembrete e comprovante, e registra um histórico completo com auditorias.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Node.js + Express |
| **Banco de dados** | SQLite (`banco.db`) — arquivo local, zero infra externa |
| **Frontend** | React 19 + Vite |
| **Estilo** | CSS puro (`style.css` monolítico ~47KB) |
| **Autenticação** | JWT (jsonwebtoken + bcryptjs) — token salvo no `localStorage` |
| **E-mail** | Brevo (API REST via axios) |
| **PDF** | jsPDF + autotable |
| **Ícones** | Lucide React |
| **Gráficos** | Recharts |
| **QR Code** | html5-qrcode + qrcode.react |
| **Planilhas** | xlsx |

---

## Estrutura de Pastas

```
chrome-control/
├── backend/
│   ├── server.js          ← Entrada principal (Express)
│   ├── database.js        ← Setup SQLite + helpers de query
│   ├── banco.db           ← Arquivo do banco de dados
│   ├── .env               ← Secrets (JWT, Brevo, email)
│   ├── middleware/
│   │   └── auth.js        ← autenticar() + apenasAdmin()
│   └── routes/
│       ├── auth.js        ← Login, usuários, senhas
│       ├── chromebooks.js ← CRUD de equipamentos
│       ├── professores.js ← CRUD de responsáveis
│       ├── emprestimos.js ← Operações de empréstimo
│       ├── email.js       ← Envio de e-mails (Brevo)
│       ├── auditorias.js  ← Inventários físicos
│       ├── logs.js        ← Logs de ações dos usuários
│       └── configuracoes.js ← Config white-label (banco)
└── frontend-react/
    └── src/
        ├── App.jsx        ← Estado global + roteamento de páginas
        ├── api.js         ← Fetch wrapper (GET/POST/PUT/DEL)
        ├── style.css      ← CSS global único
        ├── utils/
        │   ├── toast.js        ← Sistema de notificações
        │   ├── confirm.js      ← Modal de confirmação
        │   └── pdfGenerator.js ← Geração de PDFs
        └── components/
            ├── Header.jsx        ← Navbar + drawer mobile + menus
            ├── Dashboard.jsx     ← Visão geral + empréstimos ativos
            ├── Emprestimos.jsx   ← Tela de novo empréstimo + leitor QR
            ├── Chromebooks.jsx   ← Cadastro de equipamentos
            ├── Professores.jsx   ← Cadastro de responsáveis
            ├── Historico.jsx     ← Histórico + Auditorias (abas)
            ├── Usuarios.jsx      ← Gestão de usuários do sistema
            ├── Logs.jsx          ← Logs de ações (só admin)
            ├── Configuracoes.jsx ← Configurações white-label (só admin)
            ├── LoginScreen.jsx   ← Tela de login
            ├── ConfirmModal.jsx  ← Modal de confirmação global
            └── ToastContainer.jsx ← Container de toasts
```

---

## Banco de Dados — Tabelas

### `usuarios`
| Campo | Tipo | Desc |
|-------|------|------|
| id | TEXT PK | Timestamp como ID |
| nome | TEXT | Nome exibido |
| login | TEXT UNIQUE | Login de acesso |
| senha_hash | TEXT | Bcrypt hash |
| perfil | TEXT | `'admin'` ou `'operador'` |

### `chromebooks`
| Campo | Tipo | Desc |
|-------|------|------|
| id | TEXT PK | |
| patrimonio | TEXT UNIQUE | Nº de patrimônio |
| numero | TEXT | Nº interno (ex: "01") |
| cor | TEXT | Cor do equipamento |
| obs | TEXT | Observações |
| status | TEXT | `'disponivel'` ou `'emprestado'` |

### `professores` (= responsáveis)
| Campo | Tipo | Desc |
|-------|------|------|
| id | TEXT PK | |
| nome | TEXT | |
| turma | TEXT | Turma que leciona |
| email | TEXT | Para envio de e-mails |
| tipo | TEXT | `'Matéria'`, `'Titular'`, `'Coordenador'`, etc. |
| materia | TEXT | Quando tipo = 'Matéria' |
| codigo_barras | TEXT | Para leitura via scanner |

### `emprestimos`
| Campo | Tipo | Desc |
|-------|------|------|
| id | TEXT PK | |
| professor_id/nome/turma/tipo/materia | TEXT | Snapshot do responsável |
| acessorios | TEXT | JSON array de acessórios |
| obs | TEXT | Observações |
| data_retirada | TEXT | Data/hora da saída |
| data_devolucao | TEXT | Data/hora da volta (null se ativo) |
| status | TEXT | `'ativo'` ou `'devolvido'` |
| registrado_por | TEXT | Nome do operador |
| devolvido_por | TEXT | Nome do operador |

### `emprestimo_chromebooks` (relação N:N)
Vincula quais chromebooks estão em cada empréstimo, com snapshot do patrimônio e cor.

### `auditorias`
Inventários físicos registrados — salva arrays JSON dos equipamentos esperados, encontrados e pendentes.

### `logs_sistema`
Registro de todas as ações relevantes (criação, edição, exclusão, login, etc.).

### `configuracoes` (white-label, dinâmica)
| Chave | Valor padrão |
|-------|-------------|
| `escola_nome` | 'ChromeControl Escola Padrão' |
| `atraso_padrao_horas` | '4' |
| `brevo_api_key` | '' |
| `email_remetente` | 'noreply@chromecontrol.com.br' |
| `nome_remetente` | 'Biblioteca da Escola' |

---

## API — Rotas

### Públicas
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Autentica e retorna JWT |

### Protegidas (qualquer usuário autenticado)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/auth/me` | Dados do usuário logado |
| GET | `/api/auth/usuarios` | Lista usuários |
| PUT | `/api/auth/usuarios/:id` | Edita usuário (operador só edita a si mesmo) |
| PUT | `/api/auth/senha` | Troca senha (verifica senha atual) |
| GET | `/api/chromebooks` | Lista equipamentos |
| GET | `/api/professores` | Lista responsáveis |
| GET | `/api/emprestimos` | Lista empréstimos ativos |
| GET | `/api/emprestimos/historico` | Histórico completo |
| POST | `/api/emprestimos` | Registra novo empréstimo |
| PUT | `/api/emprestimos/:id/editar` | Edita empréstimo ativo |
| PUT | `/api/emprestimos/:id/devolver` | Devolução total ou parcial |
| POST | `/api/email/lembrete` | Envia lembrete por e-mail |
| POST | `/api/email/comprovante` | Envia comprovante de retirada/devolução |
| GET | `/api/email/status` | Verifica se Brevo está configurado |
| GET | `/api/auditorias` | Histórico de auditorias |
| POST | `/api/auditorias` | Registra nova auditoria |
| GET | `/api/logs` | Logs de ações |
| GET | `/api/configuracoes` | Lê configurações (API key protegida p/ operador) |

### Somente Admin
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/usuarios` | Cria usuário |
| DELETE | `/api/auth/usuarios/:id` | Exclui usuário |
| POST/PUT/DELETE | `/api/chromebooks` | CRUD de equipamentos |
| POST/PUT/DELETE | `/api/professores` | CRUD de responsáveis |
| DELETE | `/api/emprestimos/historico` | Limpa histórico |
| PUT | `/api/configuracoes` | Salva configurações white-label |

---

## Fluxo de Autenticação

```
LoginScreen → POST /api/auth/login
           ← { token, usuario }
           → token salvo no localStorage
           → GET /api/auth/me (valida token)
           → carregarTudo() (carrega tudo em paralelo)
```

- Token JWT expira em **8 horas**
- Se 401 → `clearToken()` + dispara evento `auth-error` → tela de login
- `carregarTudo()` é chamado a cada **5 segundos** para manter os dados frescos (polling)

---

## Sistema de Permissões

| Ação | Operador | Admin |
|------|----------|-------|
| Ver dados | ✅ | ✅ |
| Registrar empréstimo | ✅ | ✅ |
| Devolver empréstimo | ✅ | ✅ |
| Enviar e-mails | ✅ | ✅ |
| Criar/editar/excluir Chromebooks | ❌ | ✅ |
| Criar/editar/excluir Professores | ❌ | ✅ |
| Gerenciar usuários | ❌ | ✅ |
| Ver Logs de Ações | ❌ | ✅ |
| Alterar configurações | ❌ | ✅ |
| Ver API key do Brevo | ❌ | ✅ |

---

## Fluxo de Estado (Frontend)

O `App.jsx` é o único detentor do estado global:

```js
state = {
  chromebooks: [],    // todos os equipamentos
  professores: [],    // todos os responsáveis
  emprestimos: [],    // empréstimos ATIVOS
  historico: [],      // todos (ativos + devolvidos)
  auditorias: [],     // histórico de inventários
  configuracoes: {},  // mapa chave→valor do banco
}
```

- As operações "globais" (`editarEmprestimoGlobal`, `devolverEmprestimoGlobal`, `enviarLembreteGlobal`) ficam em `App.jsx` e são passadas como props para os componentes filhos
- Cada componente recebe `setState` e atualiza o estado local otimisticamente sem precisar re-buscar tudo na API

---

## Sistema de E-mail

- Usa **Brevo** (ex-Sendinblue) via API REST
- Config carregada dinamicamente do banco (`getEmailConfigs()`) a cada envio
- Fallback para variáveis de ambiente `.env` se banco estiver vazio
- Dois templates HTML inline:
  - **Lembrete**: avisa professor que tem chromebook pendente
  - **Comprovante**: recibo de retirada ou devolução

---

## Pontos Notáveis / Decisões Arquiteturais

1. **Banco SQLite local** — zero infraestrutura, portável, ideal para escolas menores
2. **Migrations manuais** — `database.js` tenta ler colunas e adiciona se não existir (compatibilidade retroativa)
3. **Snapshot de dados no empréstimo** — nome/turma/tipo do professor são copiados para a tabela de empréstimos, então histórico não é afetado por edições no cadastro do professor
4. **Devolução parcial** — suportada: cria um registro "devolvido" clonado para os chromebooks devolvidos, mantém o empréstimo ativo para os restantes
5. **Polling de 5s** — `carregarTudo()` roda a cada 5 segundos para multiusuário sem WebSocket
6. **API URL dinâmica** — usa `window.location.hostname` para funcionar tanto em localhost quanto na rede local (acesso pelo IP do servidor)
7. **Configurações white-label** — nome da escola, atraso padrão e config de e-mail ficam no banco, facilitando adaptar para outras escolas sem mexer no código
