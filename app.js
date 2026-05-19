// ===========================
//   AUTOPECAS CRM - APP.JS
// ===========================

// ---- STATE ----
let clients = [];
let pendingDeleteId = null;
let editingClientId = null;
let importBuffer = [];
let SHEETS_URL = '';

// ---- EVOLUTION API CONFIG ----
const EVOLUTION_URL = 'https://evolution-api-production-da04e.up.railway.app';
const EVOLUTION_KEY = '8c862d27ead59faf3be57be501113debeb6c41a4ed87488d5e110ab7c93f38b4';
const EVOLUTION_INSTANCE = 'autopecas';

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  SHEETS_URL = localStorage.getItem('sheetsUrl') || '';
  if (document.getElementById('sheetsUrl')) {
    document.getElementById('sheetsUrl').value = SHEETS_URL;
  }

  const todayStr = new Date().toLocaleDateString('pt-BR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  document.getElementById('dashDate').textContent = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  // Import file listener
  const dropZone = document.getElementById('dropZone');
  const importFile = document.getElementById('importFile');
  dropZone.addEventListener('click', () => importFile.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleImportFile(e.dataTransfer.files[0]); });
  importFile.addEventListener('change', e => handleImportFile(e.target.files[0]));

  // CNPJ mask
  document.getElementById('f_cnpj').addEventListener('input', function() {
    this.value = cnpjMask(this.value);
  });

  // Load data: try Sheets first, fallback to localStorage
  await loadData();

  renderDashboard();
  renderContactsDay();
  renderClients();
  renderRanking();
  checkWppSidebarStatus();

  setTimeout(() => {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }, 600);
});

// ---- STORAGE ----
async function loadData() {
  if (SHEETS_URL) {
    // Se tem Sheets configurado, SEMPRE busca de lá primeiro
    document.querySelector('.loading-content p').textContent = '🔄 Sincronizando com Google Sheets...';
    try {
      const res = await fetch(SHEETS_URL, { method: 'GET' });
      const json = await res.json();
      if (json.status === 'ok' && Array.isArray(json.clients)) {
        // Normaliza history de cada cliente (pode vir como string do Sheets)
        clients = json.clients.map((c, idx) => {
          // Garante que o ID existe
          if (!c.id) c.id = 'client_' + idx;
          c.id = String(c.id).trim();
          // Converte history de string para array
          if (typeof c.history === 'string') {
            try { c.history = JSON.parse(c.history); } catch(e) { c.history = []; }
          }
          if (!Array.isArray(c.history)) c.history = [];
          return c;
        });
        localStorage.setItem('crm_clients', JSON.stringify(clients));
        return; // sucesso, não precisa do local
      }
    } catch (e) {
      // Sheets falhou, usa local como fallback
      loadFromStorage();
    }
  } else {
    // Sem Sheets, usa localStorage
    loadFromStorage();
  }
}

function loadFromStorage() {
  try {
    clients = JSON.parse(localStorage.getItem('crm_clients') || '[]');
  } catch { clients = []; }
}

function saveToStorage() {
  localStorage.setItem('crm_clients', JSON.stringify(clients));
  syncToSheets();
}

async function syncToSheets() {
  if (!SHEETS_URL) return;
  try {
    const form = new FormData();
    form.append('action', 'save');
    form.append('clients', JSON.stringify(clients));
    await fetch(SHEETS_URL, { method: 'POST', body: form });
  } catch (e) { /* silent fail */ }
}

// ---- HELPERS ----
function today() {
  return new Date().toISOString().split("T")[0];
}

function normalizeDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (dateStr.toString().includes("T")) return dateStr.toString().split("T")[0];
  return dateStr.toString();
}

function daysSince(dateStr) {
  if (!dateStr) return 9999;
  const normalized = normalizeDate(dateStr);
  const start = new Date(normalized + "T12:00:00");
  const diff = new Date() - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getTemp(client) {
  const days = daysSince(client.lastContact);
  if (days <= 7) return "hot";
  if (days <= 15) return "warm";
  return "cold";
}

function getTempBadge(client) {
  const t = getTemp(client);
  if (!client.lastContact) return '<span class="temp-badge badge-new">🆕 Novo</span>';
  if (t === "hot") return '<span class="temp-badge badge-hot">🔥 Quente</span>';
  if (t === "warm") return '<span class="temp-badge badge-warm">🌤️ Morno</span>';
  return '<span class="temp-badge badge-cold">🧊 Frio</span>';
}

function formatDate(d) {
  if (!d) return "—";
  const normalized = normalizeDate(d);
  if (!normalized) return "—";
  const [y, m, day] = normalized.split("-");
  return `${day}/${m}/${y}`;
}

function cnpjMask(v) {
  v = v.replace(/\D/g, '').slice(0, 14);
  v = v.replace(/^(\d{2})(\d)/, '$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
  v = v.replace(/(\d{4})(\d)/, '$1-$2');
  return v;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ---- WHATSAPP SIDEBAR STATUS ----
async function checkWppSidebarStatus() {
  const el = document.getElementById('wppSidebarStatus');
  if (!el) return;
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { 'apikey': EVOLUTION_KEY }
    });
    const data = await res.json();
    const instance = Array.isArray(data) ? data.find(i => i.instance?.instanceName === EVOLUTION_INSTANCE) : null;
    if (instance?.instance?.state === 'open') {
      el.innerHTML = '🟢 WhatsApp conectado';
      el.style.color = '#22c55e';
    } else {
      el.innerHTML = '🔴 WhatsApp desconectado';
      el.style.color = '#ef4444';
    }
  } catch(e) {
    el.innerHTML = '🔴 WhatsApp desconectado';
    el.style.color = '#ef4444';
  }
}

// ---- SYNC NOW ----
async function syncNow() {
  const btn = document.getElementById('syncBtn');
  btn.textContent = '⏳ Sincronizando...';
  btn.disabled = true;
  await loadData();
  renderDashboard();
  renderContactsDay();
  renderClients();
  renderRanking();
  btn.textContent = '🔄 Atualizar';
  btn.disabled = false;
  showToast('✅ Dados atualizados!');
}

// ---- NAVIGATION ----
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  if (page === 'dashboard') renderDashboard();
  if (page === 'contacts-day') renderContactsDay();
  if (page === 'clients') renderClients();
  if (page === 'ranking') renderRanking();

  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ---- DASHBOARD ----
function renderDashboard() {
  const total = clients.length;
  const contactedToday = clients.filter(c => normalizeDate(c.lastContact) === today()).length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const boughtMonth = clients.filter(c => c.lastPurchase && normalizeDate(c.lastPurchase) && normalizeDate(c.lastPurchase).startsWith(thisMonth)).length;

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiToday').textContent = contactedToday;
  document.getElementById('kpiMonth').textContent = boughtMonth;

  const hot = clients.filter(c => getTemp(c) === 'hot').length;
  const warm = clients.filter(c => getTemp(c) === 'warm').length;
  const cold = clients.filter(c => getTemp(c) === 'cold').length;

  document.getElementById('hotCount').textContent = hot;

  // Termômetro de compras
  const buyHot = clients.filter(c => daysSince(c.lastPurchase) <= 7).length;
  const buyWarm = clients.filter(c => { const d = daysSince(c.lastPurchase); return d > 7 && d <= 30; }).length;
  const buyCold = clients.filter(c => daysSince(c.lastPurchase) > 30).length;
  if (document.getElementById('buyHotCount')) document.getElementById('buyHotCount').textContent = buyHot;
  if (document.getElementById('buyWarmCount')) document.getElementById('buyWarmCount').textContent = buyWarm;
  if (document.getElementById('buyColdCount')) document.getElementById('buyColdCount').textContent = buyCold;
  document.getElementById('warmCount').textContent = warm;
  document.getElementById('coldCount').textContent = cold;

  const noContact15 = clients.filter(c => daysSince(c.lastContact) > 10).length;
  const alertStrip = document.getElementById('alertStrip');
  if (noContact15 > 0) {
    alertStrip.style.display = 'block';
    document.getElementById('alertStripText').textContent = `${noContact15} cliente(s) sem contato há mais de 10 dias!`;
  } else {
    alertStrip.style.display = 'none';
  }
}

function filterByKpi(type) {
  navigate("clients");
  document.getElementById("filterTemp").value = type;
  renderClients();
}

function filterByPurchase(type) {
  navigate('clients');
  document.getElementById('filterTemp').value = 'purchase_' + type;
  renderClients();
}

function filterByTemp(temp) {
  navigate('clients');
  document.getElementById('filterTemp').value = temp;
  renderClients();
}

// ---- CONTACTS DAY ----
function resetDailyList() {
  const todayStr = today();
  localStorage.removeItem('daily_list_' + todayStr);
  renderContactsDay();
  showToast('🔄 Nova lista gerada!');
}

function getDailyList() {
  const todayStr = today();
  const storageKey = 'daily_list_' + todayStr;
  
  // Verifica se já tem lista gerada hoje
  let dailyIds = [];
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (stored.length > 0) dailyIds = stored;
  } catch {}

  // Se não tem lista hoje, gera uma nova
  if (dailyIds.length === 0) {
    const cold = clients.filter(c => getTemp(c) === 'cold');
    const warm = clients.filter(c => getTemp(c) === 'warm');
    const hot = clients.filter(c => getTemp(c) === 'hot');
    const pool = [...cold, ...warm, ...hot].slice(0, 30);
    dailyIds = pool.map(c => c.id);
    localStorage.setItem(storageKey, JSON.stringify(dailyIds));
  }

  return dailyIds;
}

function renderContactsDay() {
  const todayStr = today();
  const dailyIds = getDailyList();

  // Filtra: está na lista do dia E não foi contatado hoje
  const suggested = dailyIds
    .map(id => clients.find(c => c.id === id))
    .filter(c => c && normalizeDate(c.lastContact) !== todayStr);

  const container = document.getElementById('contactsDayList');

  if (suggested.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>🎉 Todos os contatos do dia foram realizados!</p></div>';
    return;
  }

  // Mostra contador
  const total = getDailyList().length;
  const done = total - suggested.length;
  container.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:0.75rem 1.25rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between">
      <span>📋 Progresso do dia</span>
      <strong style="color:var(--accent)">${done}/${total} contatados</strong>
    </div>
  ` + suggested.map(c => renderClientCard(c, true)).join('');
}

// ---- CLIENTS LIST ----
function renderClients() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filter = document.getElementById('filterTemp')?.value || 'all';

  let filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.empresa.toLowerCase().includes(search) ||
      (c.contato || '').toLowerCase().includes(search) ||
      (c.cnpj || '').includes(search);

    const temp = getTemp(c);
    const days = daysSince(c.lastContact);
    const matchFilter =
      filter === 'all' ? true :
      filter === 'hot' ? temp === 'hot' :
      filter === 'warm' ? temp === 'warm' :
      filter === 'cold' ? temp === 'cold' :
      filter === 'nocontact' ? days > 10 :
      filter === 'today' ? normalizeDate(c.lastContact) === today() :
      filter === 'month' ? (c.lastPurchase && normalizeDate(c.lastPurchase) && normalizeDate(c.lastPurchase).startsWith(new Date().toISOString().slice(0,7))) :
      filter === 'purchase_recent' ? daysSince(c.lastPurchase) <= 7 :
      filter === 'purchase_medium' ? (daysSince(c.lastPurchase) > 7 && daysSince(c.lastPurchase) <= 30) :
      filter === 'purchase_old' ? daysSince(c.lastPurchase) > 30 : true;

    return matchSearch && matchFilter;
  });

  // Sort: no contact first, then by days since contact desc
  filtered.sort((a, b) => daysSince(a.lastContact) - daysSince(b.lastContact) > 0 ? -1 : 1);

  const container = document.getElementById('clientsList');
  const empty = document.getElementById('emptyState');

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    container.innerHTML = filtered.map(c => renderClientCard(c, false)).join('');
  }
}

// ---- RENDER CLIENT CARD ----
function renderClientCard(c, compact) {
  const days = daysSince(c.lastContact);
  const alertClass = days > 15 ? 'alert-contact' : '';

  return `
  <div class="client-card ${alertClass}" id="card-${c.id}">
    <div class="client-top">
      <div>
        <div class="client-name">${c.empresa}</div>
        <div class="client-meta">
          ${c.contato ? `👤 ${c.contato}` : ''}
          ${c.telefone ? ` · 📞 ${c.telefone}` : ''}
          ${c.cnpj ? ` · 🏢 ${c.cnpj}` : ''}
        </div>
      </div>
      ${getTempBadge(c)}
    </div>
    <div class="client-dates">
      <span>📞 Último contato: <strong>${formatDate(c.lastContact)}</strong>${days < 9999 ? ` (${days}d)` : ''}</span>
      <span>🛒 Última compra: <strong>${formatDate(c.lastPurchase)}</strong></span>
      <span>🛍️ Compras: <strong>${c.purchaseCount || 0}</strong></span>
    </div>
    <div class="client-actions">
      <button class="btn btn-success" onclick="markContacted('${c.id}')">✅ Contatei</button>
      <button class="btn btn-purchase" onclick="markPurchased('${c.id}')">🛒 Comprou</button>
      ${c.whatsapp ? `<button class="btn btn-whatsapp" onclick="openWhatsApp('${c.whatsapp}', '${c.empresa.replace(/'/g,"\\'")}')">💬 WhatsApp</button>` : ''}
      <button class="btn btn-history" onclick="showHistory('${c.id}')">📅 Histórico</button>
      <button class="btn btn-edit" onclick="openEditModal('${c.id}')" data-id="${c.id}">✏️ Editar</button>
      <button class="btn btn-danger" onclick="openDeleteModal('${c.id}')">🗑️</button>
    </div>
    <div class="client-obs">
      <textarea placeholder="📝 Observações..." onblur="saveObs('${c.id}', this.value)">${c.obs || ''}</textarea>
    </div>
  </div>`;
}

// ---- ACTIONS ----
function markContacted(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  const t = today();
  c.lastContact = t;
  if (!c.history) c.history = [];
  c.history.unshift({ type: 'contact', date: t, label: 'Contatado' });
  saveToStorage();
  renderDashboard();
  renderContactsDay();
  renderClients();
  showToast(`✅ Contato registrado para ${c.empresa}`);
}

function markPurchased(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  const t = today();
  c.lastContact = t;
  c.lastPurchase = t;
  c.purchaseCount = (c.purchaseCount || 0) + 1;
  if (!c.history) c.history = [];
  c.history.unshift({ type: 'purchase', date: t, label: 'Compra realizada' });
  // Adiciona nas observações
  const obsLine = `🛒 Compra registrada em ${formatDate(t)}`;
  c.obs = c.obs ? c.obs + '\n' + obsLine : obsLine;
  saveToStorage();
  renderDashboard();
  renderContactsDay();
  renderClients();
  renderRanking();
  showToast(`🛒 Compra registrada para ${c.empresa}!`);
}

function saveObs(id, value) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  c.obs = value;
  saveToStorage();
}

function openWhatsApp(number, name) {
  const clean = String(number || '').replace(/\D/g, '');
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  
  const msgs = [
    `${saudacao}! Aqui é o Celso, da Toyota T-line 🔧 Tudo bem por aí? Passando pra saber se precisam de alguma peça essa semana. Tenho algumas novidades chegando e queria oferecer pra vocês antes! Me fala o que está precisando 😊`,
    `${saudacao}! Celso aqui da Toyota T-line, tudo certo? 😄 Vim dar um alô e ver se está precisando de algo — filtros, freios, suspensão... qualquer coisa que precisar tô aqui! O que está faltando?`,
    `${saudacao}! É o Celso da T-line 👋 Estava pensando em vocês aqui — faz um tempo que não conversamos! Tem alguma peça precisando ou estoque pra repor? Essa semana estou com condições bem interessantes pra clientes antigos 😊`,
    `${saudacao}! Celso da Toyota T-line por aqui 🔧 Só passando pra checar se está tudo certo com o estoque de vocês. Às vezes aparece aquela peça que some e a gente não lembra de pedir — me fala o que está precisando que eu resolvo!`,
    `${saudacao}! Aqui é o Celso da T-line 😊 Vim dar um alô rápido — tem alguma novidade aí na oficina? Alguma peça que está girando mais ou algo que está difícil de achar? Me conta que vejo o que posso fazer por vocês!`,
    `${saudacao}! É o Celso aqui, da Toyota T-line 👋 Passando pra não sumir! rsrs Alguma peça precisando essa semana? Estou com alguns itens em promoção e pensei em vocês. Me fala o que precisar 😊`,
  ];
  
  // Sorteia uma mensagem diferente cada vez
  const msg = encodeURIComponent(msgs[Math.floor(Math.random() * msgs.length)]);
  window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
}

// ---- HISTORY ----
function showHistory(id) {
  const c = clients.find(x => x.id === id);
  if (!c) return;
  
  // Garante que history é array (pode vir como string do Sheets)
  let history = c.history || [];
  if (typeof history === 'string') {
    try { history = JSON.parse(history); } catch(e) { history = []; }
  }
  if (!Array.isArray(history)) history = [];

  const content = document.getElementById('historyContent');
  if (history.length === 0) {
    content.innerHTML = '<p style="color:var(--text2);text-align:center;padding:1rem">Nenhuma interação registrada ainda.</p>';
  } else {
    content.innerHTML = history.slice(0, 20).map(h => `
      <div class="history-item">
        <span>${h.type === 'purchase' ? '🛒' : '📞'}</span>
        <span>${h.label || 'Interação'}</span>
        <span class="history-date">${formatDate(h.date)}</span>
      </div>
    `).join('');
  }
  document.getElementById('historyModal').style.display = 'flex';
}

// ---- RANKING ----
function renderRanking() {
  const sorted = [...clients].sort((a, b) => (b.purchaseCount || 0) - (a.purchaseCount || 0));
  const container = document.getElementById('rankingList');
  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum cliente cadastrado ainda.</p></div>';
    return;
  }
  container.innerHTML = sorted.slice(0, 20).map((c, i) => {
    const pos = i + 1;
    const cls = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : '';
    const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
    return `
    <div class="ranking-item">
      <div class="ranking-pos ${cls}">${emoji}</div>
      <div class="ranking-info">
        <div class="ranking-name">${c.empresa}</div>
        <div class="ranking-detail">${c.contato || ''} ${c.telefone ? '· ' + c.telefone : ''}</div>
      </div>
      <div class="ranking-count">${c.purchaseCount || 0} compras</div>
    </div>`;
  }).join('');
}

// ---- CRUD MODALS ----
function openClientModal() {
  editingClientId = null;
  document.getElementById('clientModalTitle').textContent = '📇 Novo Cliente';
  ['f_empresa','f_cnpj','f_contato','f_telefone','f_email','f_whatsapp','f_endereco','f_obs'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('clientModal').style.display = 'flex';
}

function openEditModal(id) {
  // Tenta encontrar por id exato, depois por id como string
  let c = clients.find(x => x.id === id);
  if (!c) c = clients.find(x => String(x.id) === String(id));
  if (!c) { 
    showToast('❌ Cliente não encontrado', 'error'); 
    console.log('IDs disponíveis:', clients.slice(0,3).map(x => x.id));
    console.log('ID buscado:', id);
    return; 
  }
  editingClientId = id;
  
  const set = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.value = val || '';
  };
  
  document.getElementById('clientModalTitle').textContent = '✏️ Editar Cliente';
  set('f_empresa', c.empresa);
  set('f_cnpj', c.cnpj);
  set('f_contato', c.contato);
  set('f_telefone', c.telefone);
  set('f_email', c.email);
  set('f_whatsapp', c.whatsapp);
  set('f_endereco', c.endereco);
  set('f_obs', c.obs);
  document.getElementById('clientModal').style.display = 'flex';
}

function closeClientModal() {
  document.getElementById('clientModal').style.display = 'none';
}

function saveClient() {
  const empresa = document.getElementById('f_empresa').value.trim();
  if (!empresa) { showToast('⚠️ Nome da empresa é obrigatório!', 'error'); return; }

  if (editingClientId) {
    const c = clients.find(x => x.id === editingClientId);
    c.empresa = empresa;
    c.cnpj = document.getElementById('f_cnpj').value.trim();
    c.contato = document.getElementById('f_contato').value.trim();
    c.telefone = document.getElementById('f_telefone').value.trim();
    c.email = document.getElementById('f_email').value.trim();
    c.whatsapp = document.getElementById('f_whatsapp').value.trim();
    c.endereco = document.getElementById('f_endereco').value.trim();
    c.obs = document.getElementById('f_obs').value.trim();
    showToast(`✅ Cliente ${empresa} atualizado!`);
  } else {
    const newClient = {
      id: generateId(),
      empresa,
      cnpj: document.getElementById('f_cnpj').value.trim(),
      contato: document.getElementById('f_contato').value.trim(),
      telefone: document.getElementById('f_telefone').value.trim(),
      email: document.getElementById('f_email').value.trim(),
      whatsapp: document.getElementById('f_whatsapp').value.trim(),
      endereco: document.getElementById('f_endereco').value.trim(),
      obs: document.getElementById('f_obs').value.trim(),
      lastContact: null,
      lastPurchase: null,
      purchaseCount: 0,
      history: [],
      createdAt: today()
    };
    clients.push(newClient);
    showToast(`🎉 Cliente ${empresa} cadastrado!`);
  }

  saveToStorage();
  closeClientModal();
  renderDashboard();
  renderClients();
  renderContactsDay();
}

function openDeleteModal(id) {
  pendingDeleteId = id;
  const c = clients.find(x => x.id === id);
  document.getElementById('deleteModalText').textContent = `Deseja excluir "${c?.empresa}"? Esta ação não pode ser desfeita.`;
  document.getElementById('deleteModal').style.display = 'flex';
  document.getElementById('confirmDeleteBtn').onclick = () => confirmDelete();
}

function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  pendingDeleteId = null;
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  const c = clients.find(x => x.id === pendingDeleteId);
  clients = clients.filter(x => x.id !== pendingDeleteId);
  saveToStorage();
  closeDeleteModal();
  renderDashboard();
  renderClients();
  renderContactsDay();
  renderRanking();
  showToast(`🗑️ ${c?.empresa} excluído.`);
}

// ---- IMPORT ----
function openImportModal() {
  importBuffer = [];
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('importConfirmBtn').style.display = 'none';
  document.getElementById('importFile').value = '';
  document.getElementById('importModal').style.display = 'flex';
}

function closeImportModal() {
  document.getElementById('importModal').style.display = 'none';
  importBuffer = [];
}

function handleImportFile(file) {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(file, 'UTF-8');
  } else if (['xlsx','xls'].includes(ext)) {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_csv(ws);
      parseCSV(data);
    };
    reader.readAsArrayBuffer(file);
  } else {
    showToast('❌ Formato não suportado. Use .csv ou .xlsx', 'error');
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) { showToast('❌ Arquivo vazio ou inválido', 'error'); return; }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g,''));
  
  // Detecta se é formato completo (com id, lastContact, etc)
  const isFullFormat = headers.includes('id') && headers.includes('lastcontact');

  const colMap = {
    id: headers.findIndex(h => h === 'id'),
    empresa: headers.findIndex(h => h.includes('empres') || h.includes('razao') || h.includes('nome')),
    cnpj: headers.findIndex(h => h.includes('cnpj')),
    contato: headers.findIndex(h => h.includes('contato') || h.includes('responsavel')),
    telefone: headers.findIndex(h => h.includes('telefone') || h.includes('fone')),
    email: headers.findIndex(h => h.includes('email') || h.includes('mail')),
    whatsapp: headers.findIndex(h => h.includes('whatsapp') || h.includes('wpp')),
    obs: headers.findIndex(h => h === 'obs' || h.includes('observa')),
    lastContact: headers.findIndex(h => h.includes('lastcontact')),
    lastPurchase: headers.findIndex(h => h.includes('lastpurchase')),
    purchaseCount: headers.findIndex(h => h.includes('purchasecount')),
    createdAt: headers.findIndex(h => h.includes('createdat')),
    history: headers.findIndex(h => h.includes('history')),
    endereco: headers.findIndex(h => h.includes('endereco') || h.includes('endere'))
  };

  importBuffer = [];

  // Parse respeitando campos entre aspas
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Split respeitando aspas
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let c of line) {
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
      else { current += c; }
    }
    cols.push(current.trim());

    const empresa = colMap.empresa >= 0 ? cols[colMap.empresa] : '';
    if (!empresa || empresa === 'Empresa sem nome') continue;

    let history = [];
    if (colMap.history >= 0 && cols[colMap.history]) {
      try { history = JSON.parse(cols[colMap.history] || '[]'); } catch(e) { history = []; }
    }

    importBuffer.push({
      id: (colMap.id >= 0 && cols[colMap.id]) ? cols[colMap.id] : generateId(),
      empresa,
      cnpj: colMap.cnpj >= 0 ? cols[colMap.cnpj] || '' : '',
      contato: colMap.contato >= 0 ? cols[colMap.contato] || '' : '',
      telefone: colMap.telefone >= 0 ? cols[colMap.telefone] || '' : '',
      email: colMap.email >= 0 ? cols[colMap.email] || '' : '',
      whatsapp: colMap.whatsapp >= 0 ? cols[colMap.whatsapp] || '' : '',
      endereco: colMap.endereco >= 0 ? cols[colMap.endereco] || '' : '',
      obs: colMap.obs >= 0 ? cols[colMap.obs] || '' : '',
      lastContact: colMap.lastContact >= 0 ? normalizeDate(cols[colMap.lastContact]) || null : null,
      lastPurchase: colMap.lastPurchase >= 0 ? normalizeDate(cols[colMap.lastPurchase]) || null : null,
      purchaseCount: colMap.purchaseCount >= 0 ? parseInt(cols[colMap.purchaseCount]) || 0 : 0,
      createdAt: colMap.createdAt >= 0 ? normalizeDate(cols[colMap.createdAt]) || today() : today(),
      history
    });
  }

  document.getElementById('importCount').innerHTML = `<strong>${importBuffer.length}</strong> clientes encontrados no arquivo.`;
  document.getElementById('importPreview').style.display = 'block';
  document.getElementById('importConfirmBtn').style.display = 'inline-flex';
}

function confirmImport() {
  if (importBuffer.length === 0) return;
  clients = [...clients, ...importBuffer];
  saveToStorage();
  closeImportModal();
  renderDashboard();
  renderClients();
  renderContactsDay();
  showToast(`📥 ${importBuffer.length} clientes importados com sucesso!`);
}

// ---- DUPLICATAS ----
function checkDuplicates() {
  const seen = {};
  const dupes = [];

  clients.forEach(c => {
    const key = c.empresa.trim().toLowerCase();
    if (seen[key]) {
      dupes.push({ original: seen[key], duplicate: c });
    } else {
      seen[key] = c;
    }
  });

  // Check by CNPJ too
  const seenCnpj = {};
  clients.forEach(c => {
    if (!c.cnpj) return;
    const key = c.cnpj.replace(/\D/g, '');
    if (key.length < 11) return;
    if (seenCnpj[key]) {
      const already = dupes.find(d => d.duplicate.id === c.id || d.original.id === c.id);
      if (!already) dupes.push({ original: seenCnpj[key], duplicate: c });
    } else {
      seenCnpj[key] = c;
    }
  });

  const alertEl = document.getElementById('duplicatesAlert');

  if (dupes.length === 0) {
    alertEl.style.display = 'block';
    alertEl.innerHTML = '<p style="color:var(--success)">✅ Nenhum cliente duplicado encontrado!</p>';
    setTimeout(() => alertEl.style.display = 'none', 3000);
    return;
  }

  alertEl.style.display = 'block';
  alertEl.innerHTML = `
    <p style="color:#fde68a;font-weight:600;margin-bottom:0.75rem">⚠️ ${dupes.length} possível(is) duplicata(s) encontrada(s):</p>
    ${dupes.map(d => `
      <div style="background:var(--bg3);border-radius:8px;padding:0.75rem;margin-bottom:0.5rem;font-size:0.83rem">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
          <div>
            <strong>${d.original.empresa}</strong> vs <strong>${d.duplicate.empresa}</strong>
            ${d.original.cnpj ? `<br><small style="color:var(--text2)">CNPJ: ${d.original.cnpj}</small>` : ''}
          </div>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-outline" style="font-size:0.72rem" onclick="openEditModal('${d.original.id}')">✏️ Ver 1º</button>
            <button class="btn btn-outline" style="font-size:0.72rem" onclick="openEditModal('${d.duplicate.id}')">✏️ Ver 2º</button>
            <button class="btn btn-danger" style="font-size:0.72rem" onclick="openDeleteModal('${d.duplicate.id}')">🗑️ Excluir 2º</button>
          </div>
        </div>
      </div>
    `).join('')}
    <button class="btn btn-outline" style="font-size:0.78rem;margin-top:0.5rem" onclick="document.getElementById('duplicatesAlert').style.display='none'">Fechar</button>
  `;
}

// ---- RELATÓRIO ----
function openReport() {
  const modal = document.getElementById('reportModal');
  modal.style.display = 'flex';
  generateReport('today');
}

function generateReport(period) {
  const todayStr = today();
  const now = new Date();
  
  // Define período
  let startDate, periodLabel;
  if (period === 'today') {
    startDate = todayStr;
    periodLabel = 'Hoje — ' + new Date().toLocaleDateString('pt-BR');
  } else if (period === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split('T')[0];
    periodLabel = 'Últimos 7 dias';
  } else {
    startDate = now.toISOString().slice(0, 7);
    periodLabel = 'Este mês';
  }

  // Filtra contatos e compras no período
  const contacted = clients.filter(c => {
    const d = normalizeDate(c.lastContact);
    return d && d >= startDate;
  });

  const purchased = clients.filter(c => {
    const d = normalizeDate(c.lastPurchase);
    return d && d >= startDate;
  });

  // Histórico detalhado do período
  const allActions = [];
  clients.forEach(c => {
    (c.history || []).forEach(h => {
      if (normalizeDate(h.date) >= startDate) {
        allActions.push({ ...h, empresa: c.empresa, whatsapp: c.whatsapp });
      }
    });
  });
  allActions.sort((a, b) => b.date > a.date ? 1 : -1);

  const content = document.getElementById('reportContent');
  content.innerHTML = `
    <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
      <button class="btn ${period==='today'?'btn-primary':'btn-secondary'}" onclick="generateReport('today')">Hoje</button>
      <button class="btn ${period==='week'?'btn-primary':'btn-secondary'}" onclick="generateReport('week')">7 dias</button>
      <button class="btn ${period==='month'?'btn-primary':'btn-secondary'}" onclick="generateReport('month')">Este mês</button>
    </div>
    <h4 style="color:var(--text2);margin-bottom:1rem">📅 ${periodLabel}</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
      <div style="background:var(--bg3);border-radius:8px;padding:1rem;text-align:center">
        <div style="font-size:2rem;font-weight:700;color:var(--accent)">${contacted.length}</div>
        <div style="font-size:0.82rem;color:var(--text2)">📞 Clientes Contatados</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:1rem;text-align:center">
        <div style="font-size:2rem;font-weight:700;color:#22c55e">${purchased.length}</div>
        <div style="font-size:0.82rem;color:var(--text2)">🛒 Clientes que Compraram</div>
      </div>
    </div>
    <h4 style="margin-bottom:0.75rem;font-size:0.9rem;color:var(--text2)">📋 ATIVIDADES DO PERÍODO</h4>
    <div style="max-height:300px;overflow-y:auto">
      ${allActions.length === 0 
        ? '<p style="color:var(--text2);text-align:center;padding:1rem">Nenhuma atividade no período.</p>'
        : allActions.map(a => `
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--border);font-size:0.85rem">
            <span>${a.type === 'purchase' ? '🛒' : '📞'}</span>
            <span style="flex:1"><strong>${a.empresa}</strong> — ${a.label}</span>
            <span style="color:var(--text2);font-size:0.78rem">${formatDate(a.date)}</span>
          </div>`).join('')
      }
    </div>
    <div style="margin-top:1.25rem;text-align:right">
      <button class="btn btn-outline" onclick="exportReport('${period}')">📤 Exportar CSV</button>
    </div>
  `;
}

function exportReport(period) {
  const todayStr = today();
  const now = new Date();
  let startDate;
  if (period === 'today') startDate = todayStr;
  else if (period === 'week') { const d = new Date(); d.setDate(d.getDate()-7); startDate = d.toISOString().split('T')[0]; }
  else startDate = now.toISOString().slice(0,7);

  const rows = [['Empresa','Tipo','Data','Observação']];
  clients.forEach(c => {
    (c.history || []).forEach(h => {
      if (normalizeDate(h.date) >= startDate) {
        rows.push([c.empresa, h.type === 'purchase' ? 'Compra' : 'Contato', formatDate(h.date), c.obs || '']);
      }
    });
  });

  const csv = rows.map(r => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-${period}-${todayStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- WHATSAPP DISPATCH ----
let dispatchRunning = false;
let dispatchTimeout = null;
let dispatchQueue = [];
let dispatchIndex = 0;

function getDispatchList() {
  const todayStr = today();
  const dailyIds = getDailyList();
  return dailyIds
    .map(id => clients.find(c => c.id === id))
    .filter(c => c && normalizeDate(c.lastContact) !== todayStr);
}

function previewDispatch() {
  const list = getDispatchList();
  const withWpp = list.filter(c => c.whatsapp);
  const withoutWpp = list.filter(c => !c.whatsapp);

  // Mostra alerta dos sem WhatsApp
  const alertEl = document.getElementById('noWhatsappAlert');
  const listEl = document.getElementById('noWhatsappList');

  if (withoutWpp.length > 0) {
    alertEl.style.display = 'block';
    listEl.innerHTML = withoutWpp.map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid rgba(239,68,68,0.2);font-size:0.83rem">
        <span style="color:var(--text)">${c.empresa}</span>
        <button class="btn btn-outline" style="font-size:0.72rem;padding:0.25rem 0.5rem" onclick="openEditModal('${c.id}')">✏️ Corrigir</button>
      </div>
    `).join('');
  } else {
    alertEl.style.display = 'none';
  }

  document.getElementById('dispatchStatus').textContent = `✅ ${withWpp.length} prontos para enviar · ⚠️ ${withoutWpp.length} sem WhatsApp`;
  navigate('config');
  showToast(`📋 ${withWpp.length} clientes prontos, ${withoutWpp.length} sem WhatsApp`);
}

async function startDispatch() {
  if (dispatchRunning) return;

  const list = getDispatchList().filter(c => c.whatsapp);
  const withoutWpp = getDispatchList().filter(c => !c.whatsapp);

  if (list.length === 0) {
    showToast('⚠️ Nenhum cliente com WhatsApp para enviar!', 'error');
    return;
  }

  // Mostra aviso dos sem WhatsApp
  if (withoutWpp.length > 0) {
    const alertEl = document.getElementById('noWhatsappAlert');
    const listEl = document.getElementById('noWhatsappList');
    alertEl.style.display = 'block';
    listEl.innerHTML = withoutWpp.map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid rgba(239,68,68,0.2);font-size:0.83rem">
        <span style="color:var(--text)">${c.empresa}</span>
        <button class="btn btn-outline" style="font-size:0.72rem;padding:0.25rem 0.5rem" onclick="openEditModal('${c.id}')">✏️ Corrigir</button>
      </div>
    `).join('');
  }

  window.failedDispatch = [];
  dispatchRunning = true;
  dispatchQueue = list;
  dispatchIndex = 0;

  document.getElementById('startDispatchBtn').style.display = 'none';
  document.getElementById('stopDispatchBtn').style.display = 'inline-flex';
  document.getElementById('dispatchProgress').style.display = 'block';

  await sendNextMessage();
}

async function sendNextMessage() {
  if (!dispatchRunning || dispatchIndex >= dispatchQueue.length) {
    finishDispatch();
    return;
  }

  const c = dispatchQueue[dispatchIndex];
  const total = dispatchQueue.length;
  const current = dispatchIndex + 1;

  // Atualiza progresso
  document.getElementById('progressLabel').textContent = `Enviando para ${c.empresa}...`;
  document.getElementById('progressCount').textContent = `${current}/${total}`;
  document.getElementById('progressBar').style.width = `${(current/total)*100}%`;
  document.getElementById('dispatchStatus').textContent = `📤 Enviando ${current}/${total} — ${c.empresa}`;

  // Monta mensagem
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const msgs = [
    `${saudacao}! Aqui é o Celso, da Toyota T-line 🔧 Tudo bem por aí? Passando pra saber se precisam de alguma peça essa semana. Tenho algumas novidades chegando e queria oferecer pra vocês antes! Me fala o que está precisando 😊`,
    `${saudacao}! Celso aqui da Toyota T-line, tudo certo? 😄 Vim dar um alô e ver se está precisando de algo — filtros, freios, suspensão... qualquer coisa que precisar tô aqui! O que está faltando?`,
    `${saudacao}! É o Celso da T-line 👋 Estava pensando em vocês aqui — faz um tempo que não conversamos! Tem alguma peça precisando ou estoque pra repor? Essa semana estou com condições bem interessantes pra clientes antigos 😊`,
    `${saudacao}! Celso da Toyota T-line por aqui 🔧 Só passando pra checar se está tudo certo com o estoque de vocês. Às vezes aparece aquela peça que some e a gente não lembra de pedir — me fala o que está precisando que eu resolvo!`,
    `${saudacao}! Aqui é o Celso da T-line 😊 Vim dar um alô rápido — tem alguma novidade aí na oficina? Alguma peça que está girando mais ou algo que está difícil de achar? Me conta que vejo o que posso fazer por vocês!`,
    `${saudacao}! É o Celso aqui, da Toyota T-line 👋 Passando pra não sumir! rsrs Alguma peça precisando essa semana? Estou com alguns itens em promoção e pensei em vocês. Me fala o que precisar 😊`,
  ];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  const clean = String(c.whatsapp || '').replace(/\D/g, '');

  // Envia via Evolution API — SEMPRE avança para o próximo independente do resultado
  try {
    const sendRes = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      mode: 'cors',
      headers: { 
        'Content-Type': 'application/json', 
        'apikey': EVOLUTION_KEY,
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        number: clean,
        text: msg,
        delay: 1000
      })
    });

    let sendData = {};
    try { sendData = await sendRes.json(); } catch(e) {}

    if (sendRes.ok || sendData.key || sendData.status === 'PENDING' || sendRes.status === 201) {
      // Sucesso — marca como contatado
      c.lastContact = today();
      if (!c.history) c.history = [];
      c.history.unshift({ type: 'contact', date: today(), label: 'Mensagem automática enviada' });
      const obsLine = `📤 Mensagem automática enviada em ${formatDate(today())}`;
      c.obs = c.obs ? c.obs + '\n' + obsLine : obsLine;
      saveToStorage();
      showToast(`✅ Enviado para ${c.empresa}`);
    } else {
      // Falhou — registra e pula
      if (!window.failedDispatch) window.failedDispatch = [];
      window.failedDispatch.push({ empresa: c.empresa, whatsapp: c.whatsapp, id: c.id });
      showToast(`⚠️ Pulando ${c.empresa}`, 'error');
    }

  } catch(e) {
    // Erro de rede — registra e pula
    if (!window.failedDispatch) window.failedDispatch = [];
    window.failedDispatch.push({ empresa: c.empresa, whatsapp: c.whatsapp, id: c.id });
    showToast(`⚠️ Pulando ${c.empresa} — erro`, 'error');
  }

  // SEMPRE avança para o próximo
  dispatchIndex++;

  if (!dispatchRunning) return;

  if (dispatchIndex < dispatchQueue.length) {
    const interval = (parseInt(document.getElementById('msgInterval')?.value) || 8) * 60 * 1000;
    document.getElementById('dispatchStatus').textContent = `⏳ Aguardando ${document.getElementById('msgInterval')?.value || 8} min para próxima mensagem...`;
    dispatchTimeout = setTimeout(sendNextMessage, interval);
  } else {
    finishDispatch();
  }
}

function stopDispatch() {
  dispatchRunning = false;
  if (dispatchTimeout) { clearTimeout(dispatchTimeout); dispatchTimeout = null; }
  document.getElementById('startDispatchBtn').style.display = 'inline-flex';
  document.getElementById('stopDispatchBtn').style.display = 'none';
  document.getElementById('dispatchStatus').textContent = `⏸️ Pausado em ${dispatchIndex}/${dispatchQueue.length}`;
  showToast('⏸️ Disparo pausado!');
}

function finishDispatch() {
  dispatchRunning = false;
  document.getElementById('startDispatchBtn').style.display = 'inline-flex';
  document.getElementById('stopDispatchBtn').style.display = 'none';
  document.getElementById('progressLabel').textContent = '✅ Concluído!';
  document.getElementById('progressBar').style.width = '100%';

  const failed = window.failedDispatch || [];
  const sent = dispatchQueue.length - failed.length;

  document.getElementById('dispatchStatus').textContent = `✅ ${sent} enviados · ⚠️ ${failed.length} com erro`;

  if (failed.length > 0) {
    const alertEl = document.getElementById('noWhatsappAlert');
    const listEl = document.getElementById('noWhatsappList');
    alertEl.style.display = 'block';
    alertEl.querySelector('p').textContent = `⚠️ ${failed.length} número(s) com erro — corrija e reenvie:`;
    listEl.innerHTML = failed.map(f => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid rgba(239,68,68,0.2);font-size:0.83rem">
        <span style="color:var(--text)">${f.empresa} — <small style="color:var(--text2)">${f.whatsapp}</small></span>
        <button class="btn btn-outline" style="font-size:0.72rem;padding:0.25rem 0.5rem" onclick="openEditModal('${f.id}')">✏️ Corrigir</button>
      </div>
    `).join('');
    showToast(`⚠️ ${failed.length} números com erro! Verifique a lista.`, 'error');
  } else {
    showToast(`🎉 Disparo concluído! ${sent} mensagens enviadas!`);
  }

  window.failedDispatch = [];
  renderDashboard();
  renderContactsDay();
}

// ---- WHATSAPP / EVOLUTION API ----

let qrCheckInterval = null;

async function openQRModal() {
  document.getElementById('qrModal').style.display = 'flex';
  document.getElementById('qrConnected').style.display = 'none';
  await generateQR();
}

function closeQRModal() {
  document.getElementById('qrModal').style.display = 'none';
  if (qrCheckInterval) { clearInterval(qrCheckInterval); qrCheckInterval = null; }
}

async function generateQR() {
  document.getElementById('qrStatus').textContent = '⏳ Gerando QR Code...';
  document.getElementById('qrCodeImg').innerHTML = '<span style="color:#666">⏳ Aguardando...</span>';
  
  try {
    // Tenta criar instância se não existir
    await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
      body: JSON.stringify({ instanceName: EVOLUTION_INSTANCE, qrcode: true })
    });
  } catch(e) {}

  await refreshQR();
}

async function refreshQR() {
  document.getElementById('qrStatus').textContent = '🔄 Buscando QR Code...';
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/connect/${EVOLUTION_INSTANCE}`, {
      headers: { 'apikey': EVOLUTION_KEY }
    });
    const data = await res.json();

    if (data.base64) {
      document.getElementById('qrCodeImg').innerHTML = `<img src="${data.base64}" style="width:220px;height:220px;border-radius:8px" />`;
      document.getElementById('qrStatus').textContent = '📱 Escaneie o QR Code com seu WhatsApp Business';
      
      // Fica verificando se conectou
      if (qrCheckInterval) clearInterval(qrCheckInterval);
      qrCheckInterval = setInterval(checkConnection, 5000);
    } else if (data.instance?.state === 'open') {
      showConnected();
    } else {
      document.getElementById('qrStatus').textContent = '⚠️ Não foi possível gerar o QR. Tente novamente.';
    }
  } catch(e) {
    document.getElementById('qrStatus').textContent = '❌ Erro ao conectar com a API. Verifique sua conexão.';
  }
}

async function checkConnection() {
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { 'apikey': EVOLUTION_KEY }
    });
    const data = await res.json();
    const instance = data.find ? data.find(i => i.instance?.instanceName === EVOLUTION_INSTANCE) : null;
    if (instance?.instance?.state === 'open') {
      showConnected();
    }
  } catch(e) {}
}

function showConnected() {
  if (qrCheckInterval) { clearInterval(qrCheckInterval); qrCheckInterval = null; }
  document.getElementById('qrCodeImg').innerHTML = '✅';
  document.getElementById('qrStatus').textContent = '';
  document.getElementById('qrConnected').style.display = 'block';
  document.getElementById('whatsappStatus').innerHTML = '<span style="color:var(--success)">✅ WhatsApp conectado!</span>';
  showToast('✅ WhatsApp conectado com sucesso!');
}

async function checkWhatsAppStatus() {
  const statusEl = document.getElementById('whatsappStatus');
  statusEl.innerHTML = '<span style="color:var(--text2)">🔍 Verificando...</span>';
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { 'apikey': EVOLUTION_KEY }
    });
    const data = await res.json();
    const instance = Array.isArray(data) ? data.find(i => i.instance?.instanceName === EVOLUTION_INSTANCE) : null;
    if (instance?.instance?.state === 'open') {
      statusEl.innerHTML = '<span style="color:var(--success)">✅ WhatsApp conectado!</span>';
    } else {
      statusEl.innerHTML = '<span style="color:var(--hot)">❌ WhatsApp desconectado</span>';
    }
  } catch(e) {
    statusEl.innerHTML = '<span style="color:var(--hot)">❌ Erro ao verificar status</span>';
  }
}

async function disconnectWhatsApp() {
  if (!confirm('Deseja desconectar o WhatsApp?')) return;
  try {
    await fetch(`${EVOLUTION_URL}/instance/logout/${EVOLUTION_INSTANCE}`, {
      method: 'DELETE',
      headers: { 'apikey': EVOLUTION_KEY }
    });
    document.getElementById('whatsappStatus').innerHTML = '<span style="color:var(--hot)">❌ WhatsApp desconectado</span>';
    showToast('WhatsApp desconectado!');
  } catch(e) {
    showToast('Erro ao desconectar', 'error');
  }
}

// ---- CONFIG ----
function saveConfig() {
  SHEETS_URL = document.getElementById('sheetsUrl').value.trim();
  localStorage.setItem('sheetsUrl', SHEETS_URL);
  document.getElementById('configStatus').innerHTML = '<span style="color:var(--success)">✅ URL salva! Os dados serão sincronizados automaticamente.</span>';
  showToast('✅ Configuração salva!');
}

function exportLocalData() {
  const data = JSON.stringify(clients, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-crm-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearAllData() {
  if (confirm('⚠️ Isso vai apagar TODOS os clientes. Tem certeza? Esta ação não pode ser desfeita!')) {
    clients = [];
    saveToStorage();
    renderDashboard();
    renderClients();
    renderContactsDay();
    renderRanking();
    showToast('🗑️ Todos os dados foram removidos.', 'error');
  }
}

// Close modals clicking outside
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.style.display = 'none';
    }
  });
});
