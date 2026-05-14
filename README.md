# 🔧 AutoPeças CRM B2B

Sistema completo de gerenciamento de clientes para loja de auto peças B2B.

---

## 🚀 Como Usar (Passo a Passo para Leigos)

### OPÇÃO 1 — Usar pelo GitHub Pages (MAIS FÁCIL, gratuito)

1. **Crie uma conta no GitHub:** https://github.com (é grátis)
2. **Crie um novo repositório:**
   - Clique no botão verde "+ New" ou "Novo"
   - Nome: `autopecas-crm`
   - Deixe como "Public" (Público)
   - Clique em "Create repository"
3. **Faça upload dos arquivos:**
   - Clique em "uploading an existing file"
   - Arraste todos os arquivos desta pasta:
     - `index.html`
     - `style.css`
     - `app.js`
     - `google-apps-script.js`
     - `modelo-importacao.csv`
   - Clique em "Commit changes"
4. **Ative o GitHub Pages:**
   - Vá em "Settings" (Configurações) do repositório
   - No menu esquerdo, clique em "Pages"
   - Em "Source", selecione "Deploy from a branch"
   - Branch: `main`, pasta: `/ (root)`
   - Clique em "Save"
5. **Acesse seu CRM:**
   - Aguarde ~2 minutos
   - Seu site estará em: `https://SEU_USUARIO.github.io/autopecas-crm`
   - Salve este link no celular!

---

### OPÇÃO 2 — Conectar ao Google Sheets (salvar na nuvem)

Sem isso, os dados ficam só no navegador. Com o Google Sheets, ficam salvos para sempre.

**Passo a passo:**

1. Acesse **https://script.google.com**
2. Faça login com sua conta Google
3. Clique em **"Novo projeto"**
4. Apague o código que aparecer
5. Abra o arquivo `google-apps-script.js` deste pacote e copie TODO o conteúdo
6. Cole no editor do Google Apps Script
7. Clique em **"Salvar"** (ícone de disquete) e dê um nome ao projeto (ex: "CRM AutoPeças")
8. Clique em **"Implantar"** → **"Novo deployment"**
9. Clique no ícone de engrenagem ⚙️ ao lado de "Tipo" e selecione **"App da Web"**
10. Configure:
    - **Executar como:** Eu (seu e-mail)
    - **Quem tem acesso:** Qualquer pessoa
11. Clique em **"Implantar"**
12. **Copie a URL** que aparecer (começa com `https://script.google.com/macros/s/...`)
13. No CRM, vá em **⚙️ Configurações** e cole essa URL
14. Clique em **"Salvar Configuração"**

✅ Pronto! Agora os dados são salvos automaticamente no Google Sheets.

---

## 📱 Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🏠 Dashboard | Visão geral com totais e temperatura da carteira |
| 🎯 Contatos do Dia | 15 clientes sugeridos para contatar |
| 👥 Clientes | Lista completa com busca e filtros |
| 🏆 Ranking | Melhores clientes por número de compras |
| ⚙️ Configurações | Conexão com Google Sheets |

### Temperatura da Carteira
- 🔥 **QUENTE** (vermelho): contato nos últimos 7 dias
- 🌤️ **MORNO** (amarelo): sem contato entre 8 e 15 dias  
- 🧊 **FRIO** (azul): sem contato há mais de 30 dias

### Botões de Ação de Cada Cliente
- ✅ **Contatei** → Registra a data de hoje como último contato
- 🛒 **Comprou** → Registra compra e incrementa o contador
- 💬 **WhatsApp** → Abre conversa direta no WhatsApp
- 📅 **Histórico** → Mostra as últimas interações
- ✏️ **Editar** → Edita os dados do cliente
- 🗑️ **Excluir** → Remove o cliente (pede confirmação)

---

## 📥 Importar Clientes via Excel/CSV

1. Abra o arquivo `modelo-importacao.csv` no Excel
2. Preencha os dados dos seus clientes
3. Salve como `.csv` ou `.xlsx`
4. No CRM, clique em **"📥 Importar CSV"** (na barra lateral)
5. Arraste o arquivo ou clique para selecionar

**Colunas aceitas:** empresa, cnpj, contato, telefone, email, whatsapp, observacoes

---

## 💾 Backup dos Dados

Em **⚙️ Configurações** → **"📤 Exportar Backup"** para baixar todos os seus dados em formato JSON.

---

## ❓ Dúvidas Frequentes

**Os dados somem se eu fechar o navegador?**
Os dados ficam salvos no navegador (localStorage). Se conectar ao Google Sheets, ficam salvos na nuvem também.

**Posso usar no celular e no computador ao mesmo tempo?**
Sim! Com o Google Sheets conectado, os dados ficam sincronizados.

**Como acesso de qualquer lugar?**
Use o link do GitHub Pages. Ele funciona em qualquer celular ou computador com internet.

---

Desenvolvido com ❤️ para gestão de clientes B2B
