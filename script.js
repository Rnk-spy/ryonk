/* RYONK — logika frontend. Tanpa framework. Semua data tersimpan di localStorage. */
(function () {
  'use strict';
  const C = window.RYONK_CONFIG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const KEY = 'ryonk.v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const mobile = () => window.matchMedia('(max-width:900px)').matches;

  /* ---------- State ---------- */
  const defaults = () => ({ convs: [], active: null, theme: 'dark', mode: C.modes[0].id,
    model: C.models[0].id, system: C.defaultSystemPrompt, name: 'Guest' });
  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.convs) return Object.assign(defaults(), d); } catch (e) {}
    return defaults();
  }
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Penyimpanan lokal penuh atau dinonaktifkan.'); } };
  let abortCtl = null, busy = false, attach = null, preview = null; // preview: {type:'img'|'html', src}

  const cur = () => S.convs.find(c => c.id === S.active) || null;
  function newConv() {
    const c = { id: uid(), title: 'New conversation', messages: [], system: S.system, created: Date.now() };
    S.convs.unshift(c); S.active = c.id; return c;
  }

  /* ---------- Util ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  function download(name, data) {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const wait = (ms, sig) => new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    sig.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('abort'), { name: 'AbortError' })); });
  });

  /* ---------- Render ---------- */
  function renderHistory() {
    const box = $('#history'); box.textContent = '';
    if (!S.convs.length) { box.appendChild(el('div', 'muted', 'Belum ada percakapan.')); return; }
    S.convs.forEach(c => {
      const row = el('div', 'h-item' + (c.id === S.active ? ' on' : ''));
      const t = el('button', 't', c.title); t.onclick = () => { S.active = c.id; save(); renderAll(); closeDrawers(); };
      const d = el('button', 'd'); d.setAttribute('aria-label', 'Hapus percakapan');
      d.innerHTML = '<svg class="i"><use href="#i-trash"/></svg>';
      d.onclick = () => {
        S.convs = S.convs.filter(x => x.id !== c.id);
        if (S.active === c.id) S.active = S.convs[0] ? S.convs[0].id : null;
        save(); renderAll();
      };
      row.append(t, d); box.appendChild(row);
    });
  }
  function renderChat() {
    const c = cur(), box = $('#msgs'); box.textContent = '';
    $('#chat').classList.toggle('has-msgs', !!(c && c.messages.length));
    if (!c) return;
    c.messages.forEach(m => {
      const w = el('div', 'msg ' + m.role + (m.note ? ' note' : ''));
      w.appendChild(el('div', 'who', m.role === 'user' ? S.name : 'RYONK'));
      if (m.content) w.appendChild(el('div', 'body', m.content));
      (m.files || []).forEach(f => w.appendChild(el('span', 'fchip', f.name + ' · ' + fmtSize(f.size))));
      const h = m.role === 'assistant' && /```html\n([\s\S]*?)```/.exec(m.content || '');
      if (h) { const b = el('button', 'btn', 'Preview HTML'); b.onclick = () => { setPreview({ type: 'html', src: h[1] }); openInspector(); }; w.appendChild(b); }
      box.appendChild(w);
    });
    if (busy) { const d = el('div', 'dots'); d.setAttribute('aria-label', 'RYONK sedang berpikir'); d.innerHTML = '<span></span><span></span><span></span>'; box.appendChild(d); }
    const ch = $('#chat'); ch.scrollTop = ch.scrollHeight;
  }
  function renderInspector() {
    const c = cur(), sum = $('#inSummary'), files = $('#inFiles'); files.textContent = '';
    const n = c ? c.messages.length : 0;
    sum.textContent = c ? n + ' pesan · mode ' + S.mode + ' · model ' + S.model + '. Judul: ' + c.title : 'Belum ada percakapan aktif.';
    const list = c ? [].concat(...c.messages.map(m => m.files || [])) : [];
    if (!list.length) files.textContent = 'Belum ada berkas.';
    list.forEach(f => { const r = el('div', 'row'); r.innerHTML = '<svg class="i"><use href="#i-file"/></svg>'; r.appendChild(el('span', '', f.name + ' (' + fmtSize(f.size) + ')')); files.appendChild(r); });
    const p = $('#inPreview'); p.textContent = '';
    if (!preview) { p.textContent = 'Belum ada gambar atau HTML.'; return; }
    if (preview.type === 'img') { const i = el('img'); i.src = preview.src; i.alt = 'Preview gambar'; p.appendChild(i); }
    else { const f = el('iframe'); f.setAttribute('sandbox', ''); f.title = 'Preview HTML'; f.srcdoc = preview.src; p.appendChild(f); } // sandbox kosong: skrip dinonaktifkan
  }
  function renderAll() {
    $('#modelLabel').textContent = (C.models.find(m => m.id === S.model) || {}).label + ' · ' + (C.modes.find(m => m.id === S.mode) || {}).label;
    $('#profName').textContent = S.name; $('#avatar').textContent = (S.name[0] || 'G').toUpperCase();
    renderHistory(); renderChat(); renderInspector();
  }
  const setPreview = p => { preview = p; renderInspector(); };

  /* ---------- Chat ---------- */
  function setBusy(b) {
    busy = b;
    $('#status').classList.toggle('busy', b); $('#status b').textContent = b ? 'Thinking' : 'Ready';
    $('#stopBtn').hidden = !b; $('#sendBtn').hidden = b;
  }
  async function ask(c, sig) {
    const api = C.api;
    if (!api.chatEndpoint) {
      await wait(900, sig);
      return 'Mode demo: belum ada API yang terhubung, jadi ini bukan jawaban AI. Pesan Anda tersimpan di browser ini. Isi api.chatEndpoint di config.js untuk jawaban sungguhan.';
    }
    const tm = setTimeout(() => abortCtl && abortCtl.abort(), api.timeoutMs);
    try {
      const r = await fetch(api.chatEndpoint, { method: 'POST', signal: sig, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: S.model, mode: S.mode, system: c.system || S.system,
          messages: c.messages.filter(m => !m.note).map(m => ({ role: m.role, content: m.content })) }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (typeof j.reply !== 'string') throw new Error('Respons tidak berisi "reply"');
      return j.reply;
    } finally { clearTimeout(tm); }
  }
  async function send() {
    const ta = $('#prompt'), text = ta.value.trim();
    if ((!text && !attach) || busy) return;
    const c = cur() || newConv();
    c.messages.push({ role: 'user', content: text, files: attach ? [{ name: attach.name, size: attach.size, type: attach.type }] : [] });
    if (c.title === 'New conversation') c.title = (text || attach.name).slice(0, 40);
    ta.value = ''; autosize(); clearAttach(); save(); setBusy(true); renderAll();
    abortCtl = new AbortController();
    try { c.messages.push({ role: 'assistant', content: await ask(c, abortCtl.signal), note: !C.api.chatEndpoint }); }
    catch (e) {
      c.messages.push({ role: 'assistant', note: true,
        content: e.name === 'AbortError' ? 'Generation dihentikan.' : 'Gagal menghubungi API: ' + e.message });
    }
    abortCtl = null; setBusy(false); save(); renderAll();
  }
  function autosize() { const t = $('#prompt'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; }

  /* ---------- Lampiran ---------- */
  function clearAttach() { attach = null; $('#file').value = ''; $('#attachRow').hidden = true; }
  function onFile(f) {
    if (!f) return;
    attach = f;
    const row = $('#attachRow'); row.hidden = false; row.textContent = '';
    row.appendChild(el('span', 'fchip', f.name + ' · ' + fmtSize(f.size)));
    const x = el('button', 'icon-btn'); x.setAttribute('aria-label', 'Hapus lampiran'); x.innerHTML = '<svg class="i"><use href="#i-x"/></svg>';
    x.onclick = clearAttach; row.appendChild(x);
    if (f.type.indexOf('image/') === 0) {
      const rd = new FileReader(); // pratinjau hanya di memori, tidak disimpan ke localStorage
      rd.onload = () => setPreview({ type: 'img', src: rd.result }); rd.readAsDataURL(f);
    }
  }

  /* ---------- Layout ---------- */
  const app = $('#app'), scrim = $('#scrim');
  function closeDrawers() { app.classList.remove('side-open', 'insp-open'); scrim.hidden = true; }
  function openInspector() { if (mobile()) { app.classList.add('insp-open'); scrim.hidden = false; } else app.classList.remove('no-insp'); }
  function toggle(side) {
    if (mobile()) {
      const k = side ? 'side-open' : 'insp-open', on = !app.classList.contains(k);
      closeDrawers(); if (on) { app.classList.add(k); scrim.hidden = false; }
    } else app.classList.toggle(side ? 'no-side' : 'no-insp');
  }
  function applyTheme() { document.documentElement.setAttribute('data-theme', S.theme); }

  /* ---------- Modal ---------- */
  let lastFocus = null;
  function openModal(name) {
    const m = $('#m-' + name); if (!m) return;
    lastFocus = document.activeElement; closeDrawers();
    if (name === 'sys') $('#sysText').value = S.system;
    if (name === 'settings') { $('#setName').value = S.name; $('#setTheme').value = S.theme; }
    if (name === 'img') $('#imgNote').textContent = C.api.imageEndpoint ? 'Kirim prompt ke endpoint gambar Anda.' : 'Belum terhubung: isi api.imageEndpoint di config.js.';
    if (name === 'media') $('#mediaNote').textContent = C.api.mediaEndpoint ? 'Tempel URL media, lalu ambil lewat endpoint Anda.' : 'Browser tidak bisa mengunduh dari situs seperti YouTube atau TikTok sendiri. Butuh backend: isi api.mediaEndpoint di config.js.';
    m.hidden = false; const f = $('input,textarea,select,button', m); if (f) f.focus();
  }
  function closeModals() { $$('.modal').forEach(m => m.hidden = true); if (lastFocus) lastFocus.focus(); }

  /* Util untuk endpoint gambar/media */
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
  }

  /* ---------- Init & event ---------- */
  function init() {
    applyTheme();
    $('#mode').innerHTML = C.modes.map(m => '<option value="' + m.id + '">' + m.label + '</option>').join('');
    $('#model').innerHTML = C.models.map(m => '<option value="' + m.id + '">' + m.label + '</option>').join('');
    $('#mode').value = S.mode; $('#model').value = S.model;
    $('#demoNote').textContent = C.api.chatEndpoint ? '' : 'Mode demo: belum ada API terhubung (lihat config.js).';
    ['Rangkum dokumen yang saya lampirkan', 'Bantu susun rencana proyek', 'Jelaskan konsep ini dengan sederhana', 'Tulis ulang paragraf ini agar lebih tajam']
      .forEach(t => { const b = el('button', 'chip', t); b.onclick = () => { $('#prompt').value = t; autosize(); $('#prompt').focus(); }; $('#chips').appendChild(b); });

    $('#newChat').onclick = () => { newConv(); save(); renderAll(); closeDrawers(); $('#prompt').focus(); };
    $('#mode').onchange = e => { S.mode = e.target.value; save(); renderAll(); };
    $('#model').onchange = e => { S.model = e.target.value; save(); renderAll(); };
    $('#toggleSide').onclick = () => toggle(true);
    $('#toggleInsp').onclick = () => toggle(false);
    $('#closeInsp').onclick = () => { mobile() ? closeDrawers() : app.classList.add('no-insp'); };
    scrim.onclick = closeDrawers;
    $('#themeBtn').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save(); };
    $('#clearData').onclick = () => {
      if (!confirm('Hapus semua percakapan dan pengaturan dari browser ini?')) return;
      try { localStorage.removeItem(KEY); } catch (e) {}
      S = defaults(); preview = null; clearAttach(); applyTheme(); $('#mode').value = S.mode; $('#model').value = S.model; renderAll(); toast('Data lokal dihapus.');
    };

    $('#sendBtn').onclick = send;
    $('#stopBtn').onclick = () => abortCtl && abortCtl.abort();
    $('#prompt').addEventListener('input', autosize);
    $('#prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    $('#attachBtn').onclick = () => $('#file').click();
    $('#file').onchange = e => onFile(e.target.files[0]);

    $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
    $$('[data-close]').forEach(b => b.addEventListener('click', closeModals));
    $$('.modal').forEach(m => m.addEventListener('mousedown', e => { if (e.target === m) closeModals(); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModals(); closeDrawers(); } });

    $('#sysSave').onclick = () => { S.system = $('#sysText').value.trim() || C.defaultSystemPrompt; save(); closeModals(); toast('System prompt disimpan.'); };
    $('#sysReset').onclick = () => { $('#sysText').value = C.defaultSystemPrompt; };
    $('#setSave').onclick = () => { S.name = $('#setName').value.trim() || 'Guest'; S.theme = $('#setTheme').value; applyTheme(); save(); renderAll(); closeModals(); };
    $('#expAll').onclick = () => { download('ryonk-conversations.json', { app: 'RYONK', exported: new Date().toISOString(), conversations: S.convs }); closeModals(); };
    $('#expOne').onclick = () => { const c = cur(); if (!c) return toast('Belum ada percakapan aktif.'); download('ryonk-' + c.id + '.json', c); closeModals(); };

    // Prompt generator: template lokal, bukan AI
    $('#pgGen').onclick = () => {
      const t = $('#pgTopic').value.trim(); if (!t) return toast('Isi topik dulu.');
      const g = $('#pgGoal').value, tone = $('#pgTone').value;
      $('#pgOut').value = 'Peran: asisten ahli untuk tugas "' + g + '".\nTopik: ' + t + '\nGaya: ' + tone + '\nTugas: Jelaskan langkah demi langkah, beri contoh konkret, dan tutup dengan ringkasan.\nBatasan: Tanyakan dulu bila informasi kurang; jangan mengarang fakta.';
    };
    $('#pgCopy').onclick = () => { const v = $('#pgOut').value; if (!v) return; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast('Disalin.'), () => { $('#pgOut').select(); toast('Salin manual dengan Ctrl+C.'); }); };
    $('#pgUse').onclick = () => { const v = $('#pgOut').value; if (!v) return; $('#prompt').value = v; autosize(); closeModals(); };

    $('#imgGo').onclick = async () => {
      const out = $('#imgOut'), p = $('#imgPrompt').value.trim();
      if (!p) return toast('Isi prompt dulu.');
      if (!C.api.imageEndpoint) { out.textContent = 'Endpoint gambar belum diatur di config.js, jadi tidak ada gambar yang dibuat.'; return; }
      out.innerHTML = '<div class="skel"></div>';
      try {
        const j = await post(C.api.imageEndpoint, { prompt: p, size: $('#imgSize').value });
        const src = j.url || (j.b64 && 'data:image/png;base64,' + j.b64); if (!src) throw new Error('Respons tanpa url/b64');
        out.textContent = ''; const i = el('img'); i.src = src; i.alt = p; out.appendChild(i); setPreview({ type: 'img', src });
      } catch (e) { out.textContent = 'Gagal: ' + e.message; }
    };
    $('#mediaGo').onclick = async () => {
      const out = $('#mediaOut'), u = $('#mediaUrl').value.trim();
      if (!/^https?:\/\//i.test(u)) return toast('Masukkan URL yang diawali http(s)://');
      if (!C.api.mediaEndpoint) { out.textContent = 'Endpoint media belum diatur di config.js, jadi tidak ada yang diunduh.'; return; }
      out.innerHTML = '<div class="skel"></div>';
      try {
        const j = await post(C.api.mediaEndpoint, { url: u }); if (!j.downloadUrl) throw new Error('Respons tanpa downloadUrl');
        out.textContent = ''; const a = el('a', '', 'Unduh berkas'); a.href = j.downloadUrl; a.rel = 'noopener'; a.target = '_blank'; out.appendChild(a);
      } catch (e) { out.textContent = 'Gagal: ' + e.message; }
    };

    renderAll();
  }
  init();
})();
