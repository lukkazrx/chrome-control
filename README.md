# ChromeControl 🚀

O **ChromeControl** é um sistema completo desenvolvido para controle de ponta a ponta dos empréstimos de notebooks (chromebooks), gestão de peças de reposição na TI de escolas e acompanhamento de saúde do parque de hardware em tempo real.

Trabalha com biometria (Leitura de código de barras), tem disparo de e-mails automatizados estilo recibo e possui um Centro de Controle (*Dashboard*) que funciona como "Olhos Biônicos" previnindo estagnamento de equipamentos com multas de SLA de horário na escola.

---

## 💻 Tecnologias
- **Frontend Interativo:** ReactJS + Vite + Custom Glassmorphism UI
- **Backend Analítico:** Node.js + Express
- **Banco de Dados (Portátil e Leve):** SQLite puro
- **Inteligência de E-mails:** Brevo API

---

## 🛠️ Como instalar em uma máquina
Por usar um setup inteligente, o servidor backend em Node.js é o único que precisa ficar rodando. Ele embutirá totalmente seu "site" na memória e o servirá para quem pedir. 

### Passo 1: Pré-requisitos
Tenha o [Node.js](https://nodejs.org/) instalado em seu computador (Recomendado versão LTS). 

### Passo 2: Empacotar o Frontend (Somente uma vez)
A primeira coisa a fazer é "traduzir" o código React para arquivos rápidos HTML/JS. 
1. Pelo terminal ou prompt de comando (CMD), entre na pasta `frontend-react`
2. Instale as dependências executando: `npm install`
3. Crie os arquivos de produção executando: `npm run build`

Você deve notar que isso vai criar uma pasta chamada `/dist` lá dentro.

### Passo 3: Configurar o Backend e o Banco
1. Volte uma pasta para fora e entre pelo terminal dentro da pasta `backend`: `cd ../backend`
2. Instale as dependências base do motor rodando: `npm install`
3. Na pasta `backend`, **crie um arquivo especial** chamado rigorosamente de `.env`. Ele que irá guardar suas variáveis ultra-secretas que não podem vazar. Dentro dele coloque as infos de e-mail:
```text
BREVO_API_KEY=xkeysib-sua-chave-gigante-aqui-gerada-na-brevo
EMAIL_FROM=seu_email@escola.com.br
EMAIL_FROM_NAME=TI Colégio - ChromeControl
```
*(As senhas do sistema ficam automaticamente amarradas no painel. O banco `banco.db` é criado e gerido de forma automatizada)*

### Passo 4: Rodar o Sistema
Ainda pelo terminal na pasta do Motor principal (`backend`), simplesmente rode:
```bash
npm start
```
Pronto! Se apareceu "ChromeControl backend rodando", o sistema foi injetado com sucesso no navegador! Acesse ele localmente por: `http://localhost:3000`

---

## 📡 Como acessar de outras máquinas usando o MODO SERVIDOR (Dentro da mesma Rede/Wi-Fi)

O ChromeControl foi desenhado para ser uma verdadeira aplicação unificada. Com o computador "Sede" mantendo o `npm start` ligado no CMD, **qualquer outro celular, tablet ou notebook dentro do mesmo roteador pode utilizá-lo sem instalar nada.**

Para isso é muito simples:
1. No computador sede, descubra o seu IP Local da rede:
   - Se for Windows, abra um novo CMD puro e digite `ipconfig`. Procure o "Endereço IPv4" da sua rede sem fio ou cabo (Costuma ser `192.168.1.XX` ou `10.0.0.XX`).
   - Se for Mac/Linux, digite `ifconfig`.
2. Tendo o IP memorizado, mande os outros colabores acessarem o Chrome pelo navegador e digitarem no topo: `http://SEU_IP_ESTUDADO:3000` (ex: `http://192.168.1.15:3000`).

🌟 **O Pulo do Gato:** As chamadas de tráfego, leitura de código de barras e envio de e-mails ocorrendo no celular da Coordenadora através dessa URL vão passar obrigatoriamente pela máquina que abriu o CMD no passo 4. O sistema entende imediatamente quem controla o banco de dados sem os bugs terríveis do CORS! 

> **Aviso Importante sobre Redes em TI:** Caso não conseguir acessar na máquina do "vizinho", verifique se o Windows Firewall (ou equivalente de Mac OSX) está **liberando o tráfego Entrante e Sainte da porta `3000` TCP**.
