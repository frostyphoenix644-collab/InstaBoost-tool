/* Global client-side logic: theme, auth, Airi widget, helpers */

const API = {
  signup: '/api/signup',
  login: '/api/login',
  me: '/api/me',
  ai: '/api/ai',
  availability: '/api/seller/availability',
  product: '/api/seller/product',
  hotlist: '/api/hotlist'
};

function setTheme(mode) {
  if (mode === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
  localStorage.setItem('theme', mode);
}
function initTheme() {
  const t = localStorage.getItem('theme') || 'dark';
  setTheme(t);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.onclick = () => setTheme(document.documentElement.classList.contains('light') ? 'dark' : 'light');
  }
}

function token() { return localStorage.getItem('token') || ''; }
function setToken(tok) { localStorage.setItem('token', tok); }
function clearAuth() { localStorage.removeItem('token'); }

async function apiJSON(url, method='GET', data=null, isForm=false) {
  const opt = { method, headers: {} };
  if (!isForm) opt.headers['Content-Type'] = 'application/json';
  if (token()) opt.headers['Authorization'] = 'Bearer ' + token();
  if (data) opt.body = isForm ? data : JSON.stringify(data);
  const res = await fetch(url, opt);
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

// Airi widget (hide on login/signup pages)
function initAiri() {
  const noAiri = location.pathname.endsWith('login.html') || location.pathname.endsWith('signup.html');
  if (noAiri) return;

  const fab = document.createElement('div');
  fab.id = 'airi-fab';
  fab.innerHTML = `<img src="/assets/airi.png" alt="Airi">`;
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'airi-panel';
  panel.innerHTML = `
    <div id="airi-head">
      <div>
        <strong>Airi</strong> <span class="badge">assistant</span>
      </div>
      <div id="airi-close">✕</div>
    </div>
    <div id="airi-log"></div>
    <div id="airi-input-row">
      <input id="airi-input" type="text" placeholder="Ask me anything about products, price, sellers...">
      <button id="airi-send">Ask</button>
    </div>`;
  document.body.appendChild(panel);

  const log = panel.querySelector('#airi-log');
  const input = panel.querySelector('#airi-input');

  function add(who, txt) {
    const div = document.createElement('div');
    div.style.marginBottom = '8px';
    div.innerHTML = `<strong>${who}:</strong> ${txt}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  async function send() {
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    add('You', q);
    try {
      // fetch user for role context
      let role = 'buyer';
      try { const me = await apiJSON(API.me); role = me.role || 'buyer'; } catch {}
      const data = await apiJSON(API.ai, 'POST', { question: q, mode: 'friendly', role });
      add('Airi', data.reply || '...');
    } catch (e) {
      add('Airi', 'AI unavailable right now.');
    }
  }

  panel.querySelector('#airi-send').onclick = send;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  fab.onclick = () => { panel.style.display = 'flex'; };
  panel.querySelector('#airi-close').onclick = () => { panel.style.display = 'none'; };
}

function initCommon() {
  initTheme();
  initAiri();
}

document.addEventListener('DOMContentLoaded', initCommon);
