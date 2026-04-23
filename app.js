const STORAGE_KEY = 'beluv-sales-dashboard-v1';

const STAGES = [
  { value: 'dm_sent', label: 'DM sent' },
  { value: 'responded', label: 'Responded' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'booked', label: 'Call booked' },
  { value: 'showed', label: 'Call showed' },
  { value: 'closed_won', label: 'Closed' },
  { value: 'closed_lost', label: 'Failed' },
];

const SOURCES = {
  instagram_outbound: 'Instagram outbound',
  instagram_inbound: 'Instagram inbound',
  story_reply: 'Story reply',
  referral: 'Referral',
  other: 'Other',
};

const cloudStore = window.BeluvCloudStore || null;

const state = {
  leads: [],
  filters: {
    search: '',
    stage: 'all',
    source: 'all',
    sort: 'updated_desc',
  },
  dateRange: 'lifetime',
  auth: {
    configured: Boolean(cloudStore?.isConfigured?.()),
    user: null,
    busy: false,
  },
};

const leadForm = document.querySelector('#leadForm');
const leadEditId = document.querySelector('#leadEditId');
const saveLeadBtn = document.querySelector('#saveLeadBtn');
const cancelEditBtn = document.querySelector('#cancelEditBtn');
const leadsTableBody = document.querySelector('#leadsTableBody');
const leadRowTemplate = document.querySelector('#leadRowTemplate');
const stageBreakdown = document.querySelector('#stageBreakdown');
const objectionsList = document.querySelector('#objectionsList');
const insightsList = document.querySelector('#insightsList');
const sourceBreakdown = document.querySelector('#sourceBreakdown');
const clearAllBtn = document.querySelector('#clearAllBtn');
const exportBtn = document.querySelector('#exportBtn');
const importInput = document.querySelector('#importInput');
const seedDemoBtn = document.querySelector('#seedDemoBtn');
const searchInput = document.querySelector('#searchInput');
const stageFilter = document.querySelector('#stageFilter');
const sourceFilter = document.querySelector('#sourceFilter');
const sortSelect = document.querySelector('#sortSelect');
const dateRangeSelect = document.querySelector('#dateRangeSelect');
const panelToggles = document.querySelectorAll('.panel-toggle');
const authMessage = document.querySelector('#authMessage');
const authSignedOut = document.querySelector('#authSignedOut');
const authSignedIn = document.querySelector('#authSignedIn');
const authEmail = document.querySelector('#authEmail');
const authPassword = document.querySelector('#authPassword');
const signInBtn = document.querySelector('#signInBtn');
const signUpBtn = document.querySelector('#signUpBtn');
const signOutBtn = document.querySelector('#signOutBtn');
const currentUserEmail = document.querySelector('#currentUserEmail');
const syncModePill = document.querySelector('#syncModePill');
const syncStatus = document.querySelector('#syncStatus');

bindEvents();
init();

function bindEvents() {
  leadForm.addEventListener('submit', onLeadSubmit);
  leadForm.addEventListener('reset', resetFormState);
  clearAllBtn.addEventListener('click', clearAllData);
  exportBtn.addEventListener('click', exportData);
  importInput.addEventListener('change', importData);
  seedDemoBtn.addEventListener('click', seedDemoData);
  searchInput.addEventListener('input', onFilterChange);
  stageFilter.addEventListener('change', onFilterChange);
  sourceFilter.addEventListener('change', onFilterChange);
  sortSelect.addEventListener('change', onFilterChange);
  dateRangeSelect.addEventListener('change', onDateRangeChange);
  cancelEditBtn.addEventListener('click', resetFormState);
  signInBtn?.addEventListener('click', onSignIn);
  signUpBtn?.addEventListener('click', onSignUp);
  signOutBtn?.addEventListener('click', onSignOut);
  panelToggles.forEach((toggle) => toggle.addEventListener('click', () => togglePanel(toggle)));
}

async function init() {
  state.leads = loadLocalLeads();
  updateAuthUi();
  render();

  if (!state.auth.configured) {
    setAuthMessage('Supabase is not connected yet. Right now this still runs in local mode.');
    setSyncMode('local', 'saving to this browser only');
    return;
  }

  setAuthMessage('Supabase is connected. Sign in to sync your dashboard across devices.');

  cloudStore.onAuthStateChange(async (session) => {
    state.auth.user = session?.user || null;
    await refreshLeadsForCurrentMode();
    updateAuthUi();
    render();
  });

  const { session } = await cloudStore.getSession();
  state.auth.user = session?.user || null;
  await refreshLeadsForCurrentMode();
  updateAuthUi();
  render();
}

async function refreshLeadsForCurrentMode() {
  if (state.auth.user && state.auth.configured) {
    const cloudLeads = await cloudStore.listLeads(state.auth.user.id);
    const localLeads = loadLocalLeads();

    if (!cloudLeads.length && localLeads.length) {
      await cloudStore.replaceAllLeads(state.auth.user.id, localLeads);
      state.leads = localLeads;
      setSyncMode('cloud', 'local leads migrated into your account');
      setAuthMessage(`signed in as ${state.auth.user.email}. cloud sync is live.`);
      return;
    }

    state.leads = cloudLeads;
    setSyncMode('cloud', 'saving to your synced account');
    setAuthMessage(`signed in as ${state.auth.user.email}. cloud sync is live.`);
    return;
  }

  state.leads = loadLocalLeads();
  setSyncMode('local', 'saving to this browser only');
  if (state.auth.configured) {
    setAuthMessage('sign in to sync this dashboard across devices.');
  }
}

function loadLocalLeads() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

async function persist() {
  if (state.auth.user && state.auth.configured) {
    await cloudStore.replaceAllLeads(state.auth.user.id, state.leads);
    setSyncMode('cloud', `synced ${state.leads.length} lead${state.leads.length === 1 ? '' : 's'} to cloud`);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.leads));
  setSyncMode('local', `saved ${state.leads.length} lead${state.leads.length === 1 ? '' : 's'} in this browser`);
}

async function onLeadSubmit(event) {
  event.preventDefault();
  const formData = new FormData(leadForm);
  const editId = formData.get('editId');
  const timestamp = new Date().toISOString();
  const lead = {
    id: editId || makeId(),
    handle: String(formData.get('handle') || '').trim(),
    stage: formData.get('stage'),
    source: formData.get('source'),
    amount: Number(formData.get('amount') || 0),
    objection: String(formData.get('objection') || '').trim(),
    notes: String(formData.get('notes') || '').trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (!lead.handle) return;

  if (editId) {
    const existingLead = state.leads.find((item) => item.id === editId);
    if (existingLead) {
      lead.createdAt = existingLead.createdAt || existingLead.updatedAt || timestamp;
      Object.assign(existingLead, lead, { updatedAt: timestamp });
    }
  } else {
    state.leads.unshift(lead);
  }

  await persist();
  leadForm.reset();
  resetFormState();
  render();
}

function render() {
  renderMetrics();
  renderStageBreakdown();
  renderObjections();
  renderInsights();
  renderSourceBreakdown();
  renderLeadRows();
  updateAuthUi();
}

function renderMetrics() {
  const visibleLeads = getVisibleLeads();
  const total = visibleLeads.length;
  const responded = countByStages(['responded', 'qualified', 'booked', 'showed', 'closed_won', 'closed_lost'], visibleLeads);
  const booked = countByStages(['booked', 'showed', 'closed_won', 'closed_lost'], visibleLeads);
  const closed = countByStages(['closed_won'], visibleLeads);
  const cashCollected = visibleLeads
    .filter((lead) => lead.stage === 'closed_won')
    .reduce((sum, lead) => sum + (Number(lead.amount) || 0), 0);

  setText('#metricDmsSent', total);
  setText('#metricResponseRate', formatPercent(safeDivide(responded, total)));
  setText('#metricBookedRate', formatPercent(safeDivide(booked, responded)));
  setText('#metricCallsClosed', closed);
  setText('#metricCashCollected', formatMoney(cashCollected));
}

function renderStageBreakdown() {
  stageBreakdown.innerHTML = '';
  const visibleLeads = getVisibleLeads();
  const total = visibleLeads.length || 1;

  STAGES.forEach((stage) => {
    const count = visibleLeads.filter((lead) => lead.stage === stage.value).length;
    const percentage = safeDivide(count, total) * 100;

    const row = document.createElement('div');
    row.className = 'stage-row';
    row.innerHTML = `
      <div class="stage-row-top">
        <span>${stage.label}</span>
        <strong>${count}</strong>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${percentage}%"></div>
      </div>
    `;
    stageBreakdown.appendChild(row);
  });
}

function renderObjections() {
  const objectionCounts = getVisibleLeads().reduce((acc, lead) => {
    const key = lead.objection?.trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(objectionCounts).sort((a, b) => b[1] - a[1]);
  objectionsList.innerHTML = '';

  if (!sorted.length) {
    objectionsList.textContent = 'no objections logged yet.';
    objectionsList.classList.add('empty-state');
    return;
  }

  objectionsList.classList.remove('empty-state');
  sorted.slice(0, 8).forEach(([objection, count]) => {
    const item = document.createElement('div');
    item.className = 'objection-row';
    item.innerHTML = `<span>${escapeHtml(objection)}</span><strong>${count}</strong>`;
    objectionsList.appendChild(item);
  });
}

function renderLeadRows() {
  leadsTableBody.innerHTML = '';
  const filteredLeads = getFilteredLeads();

  if (!state.leads.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="7" class="empty-state">no leads yet. add your first one above.</td>';
    leadsTableBody.appendChild(emptyRow);
    return;
  }

  if (!filteredLeads.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="7" class="empty-state">no leads match the current filters.</td>';
    leadsTableBody.appendChild(emptyRow);
    return;
  }

  filteredLeads.forEach((lead) => {
    const row = leadRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = lead.id;
    row.querySelector('[data-field="handle"]').textContent = lead.handle;
    row.querySelector('[data-field="notes"]').textContent = lead.notes || 'no notes';
    const stagePill = row.querySelector('[data-field="stageLabel"]');
    stagePill.textContent = stageLabel(lead.stage);
    stagePill.dataset.stage = lead.stage;
    row.querySelector('[data-field="sourceLabel"]').textContent = SOURCES[lead.source] || lead.source;
    row.querySelector('[data-field="objection"]').textContent = lead.objection || '—';
    row.querySelector('[data-field="amount"]').textContent = formatMoney(Number(lead.amount) || 0);
    row.querySelector('[data-field="updatedAt"]').textContent = formatDate(lead.updatedAt);

    row.querySelector('[data-action="edit"]').addEventListener('click', () => startEditingLead(lead.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteLead(lead.id));

    leadsTableBody.appendChild(row);
  });
}

function renderInsights() {
  insightsList.innerHTML = '';
  const visibleLeads = getVisibleLeads();

  if (!visibleLeads.length) {
    insightsList.textContent = 'add some leads to get recommendations.';
    insightsList.classList.add('empty-state');
    return;
  }

  const total = visibleLeads.length;
  const responded = countByStages(['responded', 'qualified', 'booked', 'showed', 'closed_won', 'closed_lost'], visibleLeads);
  const qualified = countByStages(['qualified', 'booked', 'showed', 'closed_won', 'closed_lost'], visibleLeads);
  const booked = countByStages(['booked', 'showed', 'closed_won', 'closed_lost'], visibleLeads);
  const showed = countByStages(['showed', 'closed_won', 'closed_lost'], visibleLeads);
  const won = countByStages(['closed_won'], visibleLeads);
  const responseRate = safeDivide(responded, total);
  const qualificationRate = safeDivide(qualified, responded);
  const bookedRate = safeDivide(booked, responded);
  const closeRate = safeDivide(won, booked);
  const showRate = safeDivide(showed, booked);

  const insights = [
    { title: 'reply bottleneck', body: diagnosticMessage('reply', responseRate) },
    { title: 'qualification bottleneck', body: diagnosticMessage('qualification', qualificationRate) },
    { title: 'booking bottleneck', body: diagnosticMessage('booking', bookedRate) },
    { title: 'close bottleneck', body: diagnosticMessage('close', closeRate) },
    { title: 'show rate', body: diagnosticMessage('show', showRate) },
  ];

  insightsList.classList.remove('empty-state');
  insights.forEach((insight) => {
    const item = document.createElement('div');
    item.className = 'insight-row';
    item.innerHTML = `<strong>${insight.title}</strong><small>${insight.body}</small>`;
    insightsList.appendChild(item);
  });
}

function renderSourceBreakdown() {
  sourceBreakdown.innerHTML = '';
  const counts = getVisibleLeads().reduce((acc, lead) => {
    acc[lead.source] = (acc[lead.source] || 0) + 1;
    return acc;
  }, {});
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!sorted.length) {
    sourceBreakdown.textContent = 'no sources yet.';
    sourceBreakdown.classList.add('empty-state');
    return;
  }

  sourceBreakdown.classList.remove('empty-state');
  sorted.forEach(([source, count]) => {
    const item = document.createElement('div');
    item.className = 'source-row';
    item.innerHTML = `<span>${SOURCES[source] || source}</span><small>${count} lead${count === 1 ? '' : 's'}</small>`;
    sourceBreakdown.appendChild(item);
  });
}

function onFilterChange() {
  state.filters.search = searchInput.value.trim().toLowerCase();
  state.filters.stage = stageFilter.value;
  state.filters.source = sourceFilter.value;
  state.filters.sort = sortSelect.value;
  renderLeadRows();
}

function onDateRangeChange() {
  state.dateRange = dateRangeSelect.value;
  render();
}

function getFilteredLeads() {
  const filtered = getVisibleLeads().filter((lead) => {
    const matchesSearch = !state.filters.search || [lead.handle, lead.notes, lead.objection]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(state.filters.search));
    const matchesStage = state.filters.stage === 'all' || lead.stage === state.filters.stage;
    const matchesSource = state.filters.source === 'all' || lead.source === state.filters.source;
    return matchesSearch && matchesStage && matchesSource;
  });

  return filtered.sort((a, b) => {
    if (state.filters.sort === 'updated_asc') return new Date(a.updatedAt) - new Date(b.updatedAt);
    if (state.filters.sort === 'cash_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
    if (state.filters.sort === 'cash_asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function getVisibleLeads() {
  const now = new Date();
  return state.leads.filter((lead) => {
    const createdAt = new Date(lead.createdAt || lead.updatedAt);
    if (state.dateRange === 'lifetime') return true;
    if (state.dateRange === 'today') return createdAt.toDateString() === now.toDateString();

    const diffMs = now.getTime() - createdAt.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    if (state.dateRange === 'week') return diffMs <= 7 * dayMs;
    if (state.dateRange === 'month') return diffMs <= 30 * dayMs;
    if (state.dateRange === 'three_months') return diffMs <= 90 * dayMs;
    return true;
  });
}

function advanceLead(id) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  const currentIndex = STAGES.findIndex((stage) => stage.value === lead.stage);
  if (currentIndex === -1 || currentIndex === STAGES.length - 1) return;
  lead.stage = STAGES[currentIndex + 1].value;
  lead.updatedAt = new Date().toISOString();
  persist().then(render).catch(handleError);
}

async function deleteLead(id) {
  state.leads = state.leads.filter((lead) => lead.id !== id);
  await persist();
  render();
}

function startEditingLead(id) {
  const lead = state.leads.find((item) => item.id === id);
  if (!lead) return;
  leadEditId.value = lead.id;
  leadForm.handle.value = lead.handle;
  leadForm.stage.value = lead.stage;
  leadForm.source.value = lead.source;
  leadForm.amount.value = lead.amount || '';
  leadForm.objection.value = lead.objection || '';
  leadForm.notes.value = lead.notes || '';
  saveLeadBtn.textContent = 'update lead';
  cancelEditBtn.style.display = 'inline-flex';
  leadForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFormState() {
  leadEditId.value = '';
  saveLeadBtn.textContent = 'save lead';
  cancelEditBtn.style.display = 'none';
}

async function clearAllData() {
  const message = state.auth.user
    ? 'clear the whole dashboard? this removes all synced data for this account.'
    : 'clear the whole dashboard? this deletes all local data in the browser.';
  if (!confirm(message)) return;
  state.leads = [];
  await persist();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.leads, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `beluv-sales-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) throw new Error('invalid data');
      state.leads = parsed;
      await persist();
      render();
      event.target.value = '';
    } catch {
      alert('could not import that json file.');
    }
  };
  reader.readAsText(file);
}

async function seedDemoData() {
  const sampleLeads = [
    demoLead('@rnbnova', 'closed_won', 'instagram_outbound', 2500, '', 'closed from outbound', 0),
    demoLead('@midnightrae', 'booked', 'story_reply', 0, 'needs to think about timing', 'booked yesterday', 1),
    demoLead('@soul.szn', 'responded', 'instagram_inbound', 0, 'price', 'fresh reply today', 0),
    demoLead('@testvoice', 'qualified', 'instagram_outbound', 0, 'needs better timing', 'qualified this week', 4),
    demoLead('@late.night', 'dm_sent', 'instagram_outbound', 0, '', 'sent this week', 6),
    demoLead('@velvetloop', 'closed_lost', 'referral', 0, 'not ready', 'lost this month', 12),
    demoLead('@oceanharmonies', 'showed', 'instagram_outbound', 0, '', 'showed this month', 18),
    demoLead('@moonsetrnb', 'booked', 'instagram_outbound', 0, 'schedule conflict', 'older month lead', 42),
    demoLead('@cocoverse', 'responded', 'story_reply', 0, 'budget', '2 months back', 71),
    demoLead('@archive.wav', 'closed_won', 'instagram_inbound', 1800, '', '3 months back', 95),
  ];

  state.leads = [...sampleLeads];
  await persist();
  render();
}

async function onSignIn() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    setAuthMessage('enter your email and password first.');
    return;
  }

  try {
    setBusy(true);
    const { error } = await cloudStore.signIn(email, password);
    if (error) throw error;
    setAuthMessage('signed in. loading your synced dashboard...');
  } catch (error) {
    handleError(error, 'could not sign in.');
  } finally {
    setBusy(false);
  }
}

async function onSignUp() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) {
    setAuthMessage('enter an email and password to create your account.');
    return;
  }

  try {
    setBusy(true);
    const { data, error } = await cloudStore.signUp(email, password);
    if (error) throw error;
    if (data?.session) {
      setAuthMessage('account created. you are signed in and cloud sync is ready.');
    } else {
      setAuthMessage('account created. if Supabase email confirmation is on, check your inbox first.');
    }
  } catch (error) {
    handleError(error, 'could not create the account.');
  } finally {
    setBusy(false);
  }
}

async function onSignOut() {
  try {
    setBusy(true);
    const { error } = await cloudStore.signOut();
    if (error) throw error;
    state.auth.user = null;
    await refreshLeadsForCurrentMode();
    updateAuthUi();
    render();
  } catch (error) {
    handleError(error, 'could not sign out.');
  } finally {
    setBusy(false);
  }
}

function demoLead(handle, stage, source, amount, objection, notes, daysAgoValue) {
  const createdAt = daysAgo(daysAgoValue);
  return {
    id: makeId(),
    handle,
    stage,
    source,
    amount,
    objection,
    notes,
    createdAt,
    updatedAt: createdAt,
  };
}

function daysAgo(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString();
}

function togglePanel(toggle) {
  const panel = toggle.closest('.panel');
  if (!panel) return;
  const isCollapsed = panel.classList.toggle('collapsed');
  toggle.textContent = isCollapsed ? '▸' : '▾';
  toggle.setAttribute('aria-expanded', String(!isCollapsed));
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function countByStages(stageValues, leads = state.leads) {
  return leads.filter((lead) => stageValues.includes(lead.stage)).length;
}

function stageLabel(stageValue) {
  return STAGES.find((stage) => stage.value === stageValue)?.label || stageValue;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function diagnosticMessage(type, value) {
  if (type === 'reply') {
    if (value >= 0.7) return `response rate is ${rateSpan(value)}. that's strong, so your targeting and opener are working. keep volume up and protect what is already hitting.`;
    if (value >= 0.4) return `response rate is ${rateSpan(value)}. decent base, but there is room to sharpen targeting and your first DM angle.`;
    return `response rate is ${rateSpan(value)}. that is low, so the first thing to improve is targeting + opener quality.`;
  }

  if (type === 'qualification') {
    if (value >= 0.7) return `qualification rate is ${rateSpan(value)}. solid, people are moving past surface-level replies and into real conversations.`;
    if (value >= 0.4) return `qualification rate is ${rateSpan(value)}. some conversations are flowing, but your questions could do a better job exposing pain and intent.`;
    return `qualification rate is ${rateSpan(value)}. replies are coming in, but too many are dying early. tighten the DM questions and who you reach out to.`;
  }

  if (type === 'booking') {
    if (value >= 0.5) return `booked rate is ${rateSpan(value)}. good sign. your transition from conversation into the call is doing its job.`;
    if (value >= 0.25) return `booked rate is ${rateSpan(value)}. not terrible, but your bridge into the call probably needs to feel smoother and more natural.`;
    return `booked rate is ${rateSpan(value)}. people are replying, but they are not booking enough. review the way you pitch and transition into the call.`;
  }

  if (type === 'close') {
    if (value >= 0.4) return `close rate is ${rateSpan(value)}. healthy. the sales call is doing a good job turning booked calls into cash.`;
    if (value >= 0.2) return `close rate is ${rateSpan(value)}. there is something to improve in the call, likely around pain, certainty, or objection handling.`;
    return `close rate is ${rateSpan(value)}. that's the biggest warning sign. review the sales call, your offer clarity, and how objections are being handled.`;
  }

  if (type === 'show') {
    if (value >= 0.8) return `show rate is ${rateSpan(value)}. great. your reminders and post-booking sequence are keeping people engaged.`;
    if (value >= 0.6) return `show rate is ${rateSpan(value)}. okay, but there is room to improve with stronger reminders and better pre-call warmup.`;
    return `show rate is ${rateSpan(value)}. too many booked calls are not showing. tighten your post-booking sequence and reminder flow.`;
  }

  return `${formatPercent(value)}`;
}

function rateSpan(value) {
  const clamped = Math.max(0, Math.min(1, value));
  const hue = 270 - (clamped * 70);
  const color = `hsl(${hue} 90% 75%)`;
  return `<span style="color:${color};font-weight:700;">${formatPercent(clamped)}</span>`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function safeDivide(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setAuthMessage(message) {
  if (authMessage) authMessage.textContent = message;
}

function setSyncMode(mode, message) {
  if (syncModePill) {
    syncModePill.textContent = mode === 'cloud' ? 'cloud sync' : 'local mode';
    syncModePill.classList.remove('cloud', 'local');
    syncModePill.classList.add(mode === 'cloud' ? 'cloud' : 'local');
  }
  if (syncStatus) syncStatus.textContent = message;
}

function updateAuthUi() {
  const signedIn = Boolean(state.auth.user);
  authSignedOut?.classList.toggle('hidden-row', signedIn);
  authSignedIn?.classList.toggle('hidden-row', !signedIn);
  if (currentUserEmail) currentUserEmail.textContent = state.auth.user?.email || '';
  if (!state.auth.configured) {
    signInBtn.disabled = true;
    signUpBtn.disabled = true;
  }
}

function setBusy(isBusy) {
  state.auth.busy = isBusy;
  [signInBtn, signUpBtn, signOutBtn, saveLeadBtn, seedDemoBtn, clearAllBtn].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
}

function handleError(error, fallbackMessage = 'something went wrong.') {
  console.error(error);
  const message = error?.message || fallbackMessage;
  setAuthMessage(message);
}
