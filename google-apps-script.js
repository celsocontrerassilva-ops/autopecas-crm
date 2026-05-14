// ============================================================
//  GOOGLE APPS SCRIPT - Cole este código no script.google.com
//  Este script conecta o CRM com o Google Sheets
// ============================================================

// PASSO A PASSO:
// 1. Acesse https://script.google.com
// 2. Clique em "Novo projeto"
// 3. Apague o código de exemplo e cole TODO este arquivo
// 4. Clique em "Salvar" (ícone de disquete)
// 5. Clique em "Implantar" → "Novo deployment"
// 6. Tipo: "App da Web"
// 7. Executar como: "Eu"
// 8. Quem tem acesso: "Qualquer pessoa"
// 9. Clique em "Implantar"
// 10. Copie a URL gerada e cole nas Configurações do CRM

// ============================================================

const SHEET_NAME = 'Clientes';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('AutoPeças CRM');
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Create headers
    const headers = [
      'ID', 'Empresa', 'CNPJ', 'Contato', 'Telefone',
      'Email', 'WhatsApp', 'Observações',
      'Último Contato', 'Última Compra', 'Qtd Compras',
      'Criado Em', 'Histórico'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'save') {
      saveClients(data.clients);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', saved: data.clients.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const clients = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      const client = {};
      headers.forEach((h, j) => client[h] = row[j]);
      clients.push(client);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', clients }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function saveClients(clients) {
  const sheet = getOrCreateSheet();

  // Clear existing data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  if (!clients || clients.length === 0) return;

  const rows = clients.map(c => [
    c.id || '',
    c.empresa || '',
    c.cnpj || '',
    c.contato || '',
    c.telefone || '',
    c.email || '',
    c.whatsapp || '',
    c.obs || '',
    c.lastContact || '',
    c.lastPurchase || '',
    c.purchaseCount || 0,
    c.createdAt || '',
    JSON.stringify(c.history || [])
  ]);

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

  // Auto-resize columns
  sheet.autoResizeColumns(1, 13);
}

// ============================================================
// FUNÇÃO DE TESTE - Execute esta função manualmente para testar
// ============================================================
function testar() {
  const testClients = [
    {
      id: 'test1',
      empresa: 'Oficina Teste',
      cnpj: '12.345.678/0001-90',
      contato: 'João Silva',
      telefone: '(11) 99999-9999',
      email: 'teste@oficina.com',
      whatsapp: '5511999999999',
      obs: 'Cliente de teste',
      lastContact: '2025-01-15',
      lastPurchase: '2025-01-10',
      purchaseCount: 3,
      createdAt: '2024-12-01',
      history: [{ type: 'contact', date: '2025-01-15', label: 'Contatado' }]
    }
  ];
  saveClients(testClients);
  Logger.log('✅ Teste executado com sucesso! Verifique a aba "Clientes" na planilha.');
}
