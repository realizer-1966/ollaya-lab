// ollaya Decision Model Lab — 서버 연결 + 카탈로그 + 질문 편집 + 판정
import { CATALOG, DEFAULT_SRV, DEFAULT_KEY, LS_KEY, LS_SRV, refreshInstalled } from './catalog.js?v=3';

const $ = (id) => document.getElementById(id);
const srvurl = $('srvurl'), srvkey = $('srvkey'), connect = $('connect');
const hasSrvUI = !!connect;   // 서버 설정 UI 접힘/존재 어느 쪽이든 동작
const srvstatus = $('srvstatus'), status = $('status');
const run = $('run'), models = $('models');
const qjson = $('qjson'), presetSel = $('preset');

let srv = localStorage.getItem(LS_SRV) || DEFAULT_SRV;
// 구버전 http(폰트널 IP) 저장값 마이그레이션 — mixed content로 브라우저 fetch 불가
if (srv.startsWith('http://')) srv = DEFAULT_SRV;
let key = localStorage.getItem(LS_KEY) || DEFAULT_KEY;
let installedModels = null;
let selectedModel = null;

if (srvurl) srvurl.value = srv;
if (srvkey) srvkey.value = key;

hasSrvUI && connect.addEventListener('click', async () => {
  srv = srvurl.value.trim().replace(/\/$/, '');
  key = srvkey.value || DEFAULT_KEY;
  localStorage.setItem(LS_SRV, srv);
  if (key === DEFAULT_KEY) localStorage.removeItem(LS_KEY); else if (key) localStorage.setItem(LS_KEY, key);
  srvstatus.textContent = '연결 시도 중...';
  srvstatus.className = 'status';
  const res = await refreshInstalled(srv, key);
  if (res === null) {
    srvstatus.textContent = '연결 실패 — ' + (window.__lastConnErr || '네트워크') + ' (' + srv + ')';
    srvstatus.className = 'status err';
    return;
  }
  installedModels = res;
  srvstatus.textContent = '연결됨 — ' + srv + ' (' + res.size + ' 모델 설치됨)';
  renderCatalog();
  updateRunBtn();
  if (typeof refreshCreatePanel === 'function') refreshCreatePanel();
});

function badge(c) {
  if (installedModels === null) return '<span class="badge missing">연결 필요</span>';
  if (c.mine) return c.installed ? '<span class="badge ok">내 모델</span>' : '<span class="badge missing">삭제됨</span>';
  return c.installed ? '<span class="badge ok">설치됨</span>' : '<span class="badge missing">pull 필요</span>';
}

async function attachDelete(card, c) {
  const btn = card.querySelector('.delbtn');
  if (!btn) return;
  btn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    if (!confirm(c.model + ' 을(를) 데몬에서 삭제할까?\n베이스 모델은 유지되며, 되돌릴 수 없습니다.')) return;
    status.textContent = '삭제 중... ' + c.model;
    status.className = 'status';
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;
      const res = await fetch(srv + '/api/delete', { method: 'DELETE', headers, body: JSON.stringify({ model: c.model }) });
      if (res.ok || res.status === 404) {
        status.textContent = '삭제됨 — ' + c.model + (res.status === 404 ? ' (이미 없음)' : '');
        const inst = await refreshInstalled(srv, key);
        installedModels = inst;
        if (selectedModel === c.model) { selectedModel = null; updateRunBtn(); }
        renderCatalog();
        if (typeof refreshCreatePanel === 'function') refreshCreatePanel();
      } else {
        let msg = res.status;
        try { const e = await res.json(); msg = e.error || e.code || msg; } catch {}
        status.textContent = '삭제 실패: ' + msg;
        status.className = 'status err';
      }
    } catch (e) {
      status.textContent = '삭제 오류: ' + e.message;
      status.className = 'status err';
    }
  });
}

function renderCatalog() {
  models.innerHTML = '';
  const customs = CATALOG.filter((c) => c.mine);
  const rest = CATALOG.filter((c) => !c.mine);
  const groups = [];
  if (customs.length) groups.push({ label: '내 모델 — 데몬에서 생성 (' + customs.length + '개)', cards: customs });
  const fams = [...new Set(rest.map((c) => c.family))];
  for (const fam of fams) groups.push({ label: fam + ' — ' + rest.filter((c) => c.family === fam).length + '개', cards: rest.filter((c) => c.family === fam) });
  for (const g of groups) {
    const gCards = g.cards;
    const head = document.createElement('div');
    head.className = 'family';
    head.style.marginTop = '14px';
    head.textContent = g.label;
    models.appendChild(head);
    for (const c of gCards) {
      const card = document.createElement('div');
      card.className = 'mcard' + (installedModels && !c.installed ? ' missing' : '') + (selectedModel === c.model ? ' sel' : '');
      card.innerHTML =
        '<div class="mname">' + c.model + ' ' + badge(c) +
        (c.mine ? '<button class="delbtn" data-model="' + c.model + '" title="데몬에서 이 모델 삭제 (베이스는 유지)" style="float:right;background:none;border:none;cursor:pointer;font-size:15px;padding:0 2px;line-height:1">🗑</button>' : '') +
        '</div>' +
        '<div class="mdesc">' + c.desc + '</div>' +
        '<div class="mtags conf">' +
          'engine=' + c.engine + ' · 최대옵션=' + (c.maxOptions ?? '?') +
        '</div>' +
        (c.tips ? '<div class="hint">' + c.tips + '</div>' : '');
      card.addEventListener('click', () => selectModel(c));
      models.appendChild(card);
      if (c.mine) attachDelete(card, c);
    }
  }
}

async function selectModel(c) {
  selectedModel = c.model;
  if (installedModels && !c.installed) {
    if (!confirm(c.model + ' 미설치 — 데몬에 없음. 계속 시도할까? (404 예상)')) {
      renderCatalog();
      return;
    }
  }
  renderCatalog();
  if (c.dyn) {
    // 데몬 동적 모델(커스텀·레지스트리 변형): /api/show로 내장 질문셋(QUESTIONS)을 가져와 채운다
    status.textContent = selectedModel + ' — 내장 질문셋 로드 중...';
    status.className = 'status';
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = 'Bearer ' + key;
      const res = await fetch(srv + '/api/show', { method: 'POST', headers, body: JSON.stringify({ model: c.model }) });
      const j = await res.json();
      if (res.ok && j.questions && Object.keys(j.questions).length) {
        qjson.value = JSON.stringify(j.questions, null, 2);
        status.textContent = selectedModel + ' 선택됨 — 내장 질문셋 로드됨';
      } else {
        status.textContent = selectedModel + ' 선택됨 (내장 질문셋 없음 — 질문을 직접 입력하거나 프리셋을 고르세요)';
      }
    } catch (e) {
      status.textContent = '질문셋 로드 실패: ' + e.message;
      status.className = 'status err';
    }
  } else if (c.defaultQuestions) {
    qjson.value = JSON.stringify(c.defaultQuestions, null, 2);
  }
  updateRunBtn();
  if (!status.className.includes('err')) status.className = 'status';
  if (!status.textContent.includes('선택됨') && !status.textContent.includes('실패')) status.textContent = selectedModel + ' 선택됨';
}

function updateRunBtn() {
  const hasSel = !!selectedModel;
  run.disabled = !hasSel;
  run.textContent = hasSel ? '판정 (' + selectedModel + ')' : '모델 선택 + 연결 후 판정';
}

// ---- 프리셋: 내장(카탈로그 defaultQuestions) + 사용자 저장(localStorage) ----
const LS_PRESETS = 'lab-presets';
const BUILTIN = {};
for (const c of CATALOG) {
  if (c.defaultQuestions) BUILTIN[c.model.split(':')[0]] = c.defaultQuestions;
}
// 범용 내장 프리셋 — 질문셋 없는 모델(decider·kev·nli·gliclass 등)에서도 활용 가능
if (!BUILTIN['범용']) BUILTIN['범용'] = {
  intent: { type: 'choice', instructions: '핵심 요청은?', criteria: { refund: '환불', bug: '버그', feature: '기능요청', other: '기타' } },
  urgency: { type: 'score', instructions: '긴급도?', rating: ['상시', '높음', '중간', '낮음'] },
};
if (!BUILTIN['감정']) BUILTIN['감정'] = BUILTIN['범용'];

function loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem(LS_PRESETS) || '{}'); } catch { return {}; }
}
function saveCustomPresets(p) { localStorage.setItem(LS_PRESETS, JSON.stringify(p)); }
let PRESETS = Object.assign({}, BUILTIN, loadCustomPresets());

function renderPresets() {
  PRESETS = Object.assign({}, BUILTIN, loadCustomPresets());
  const cur = presetSel.value;
  presetSel.innerHTML = '';
  for (const n of Object.keys(PRESETS)) {
    const opt = document.createElement('option');
    const isCustom = !!loadCustomPresets()[n];
    opt.value = n; opt.textContent = (isCustom ? '⭐ ' : '') + n + ' 프리셋';
    presetSel.appendChild(opt);
  }
  if (cur && PRESETS[cur]) presetSel.value = cur;
}
renderPresets();

$('loadpreset').addEventListener('click', () => {
  const n = presetSel.value;
  if (n && PRESETS[n]) qjson.value = JSON.stringify(PRESETS[n], null, 2);
});
$('reset').addEventListener('click', () => {
  const fam = selectedModel?.split(':')[0];
  const src = (fam && PRESETS[fam]) || PRESETS['범용'];
  qjson.value = JSON.stringify(src ?? {}, null, 2);
});
$('savepreset').addEventListener('click', () => {
  const n = ($('pname').value || '').trim();
  if (!n) { status.textContent = '프리셋 이름을 입력하세요'; status.className = 'status err'; return; }
  let q;
  try { q = JSON.parse(qjson.value); } catch (e) { status.textContent = '질문 JSON 오류: ' + e.message; status.className = 'status err'; return; }
  const custom = loadCustomPresets();
  custom[n] = q;
  saveCustomPresets(custom);
  renderPresets();
  presetSel.value = n;
  status.textContent = '프리셋 저장됨 — ' + n;
  status.className = 'status';
});
$('delpreset').addEventListener('click', () => {
  const n = presetSel.value;
  if (!n) return;
  if (BUILTIN[n]) { status.textContent = '내장 프리셋은 삭제 불가 (사용자 저장만 삭제)'; status.className = 'status err'; return; }
  const custom = loadCustomPresets();
  if (!custom[n]) { status.textContent = '삭제할 저장 프리셋이 아님'; status.className = 'status err'; return; }
  delete custom[n];
  saveCustomPresets(custom);
  renderPresets();
  status.textContent = '프리셋 삭제됨 — ' + n;
  status.className = 'status';
});

run.addEventListener('click', async () => {
  const text = $('text').value.trim();
  if (!text || !selectedModel) return;
  let questions = {};
  try {
    const parsed = JSON.parse(qjson.value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) questions = parsed;
  } catch (e) { status.textContent = '질문 JSON 오류: ' + e.message; status.className = 'status err'; return; }

  run.disabled = true;
  status.textContent = '판정 중...';
  status.className = 'status';
  const t0 = performance.now();
  const body = { model: selectedModel, state: { body: text }, extras: ['laya'] };
  if (Object.keys(questions).length > 0) body.questions = questions;
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = 'Bearer ' + key;
  try {
    const res = await fetch(srv + '/api/decide', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      let msg = res.status;
      try { const e = await res.json(); msg = e.error || e.code || msg; } catch {}
      throw new Error('서버 ' + msg);
    }
    const out = await res.json();
    const ms = (performance.now() - t0).toFixed(0);
    renderResults(out, ms);
    status.textContent = '완료';
  } catch (e) {
    status.textContent = '오류: ' + e.message;
    status.className = 'status err';
  }
  run.disabled = false;
});

function bar(name, label, prob) {
  const pct = (prob * 100).toFixed(1);
  return '<div class="label"><b class="qname">' + name + '</b> <span class="conf">' + label +
         ' · ' + pct + '%</span></div><div class="prob"><span style="width:' + pct + '%"></span></div>';
}

function renderResults(out, ms) {
  let html = '<div class="card">';
  html += '<div class="timing">model=' + (out.model ?? '?') + ' · ' + ms + 'ms 왕복 · ' + (out.usage?.input_tokens ?? 0) + ' tok · state_truncated=' + (out.state_truncated ?? false) + '</div>';
  if (out.routing) {
    html += '<div class="timing">라우팅: ' + out.routing.model + ' (' + out.routing.reason + ')</div>';
  }
  html += '<div style="margin-top:10px">';
  for (const [k, v] of Object.entries(out.answers ?? {})) {
    if (v.type === 'choice') html += bar(k, v.choice, v.probabilities[v.choice] ?? 0);
    else if (v.type === 'noul') html += bar(k, v.noul >= 0.5 ? 'YES' : 'NO', v.noul);
    else if (v.type === 'score') {
      const legend = Object.values(v.legend ?? {});
      const lv = Math.round(v.score);
      html += bar(k, (legend[lv] ?? v.score.toFixed(2)) + ' (' + (v.score ?? 0).toFixed(2) + ')', v.confidence ?? 0);
    } else html += bar(k, JSON.stringify(v).slice(0, 80), 0);
    if (v.type === 'choice' && v.probabilities) {
      const sorted = Object.entries(v.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (sorted.length > 1) {
        html += '<div class="hint" style="margin:2px 0 6px">' + sorted.map(([n, p]) => n + ' ' + (p * 100).toFixed(1) + '%').join(' · ') + '</div>';
      }
    }
  }
  html += '</div></div>';
  $('results').innerHTML = html;
}

renderCatalog();
(async () => {  // 부팅 자동 연결 — UI 유무 무관
  const res = await refreshInstalled(srv, key);
  if (res) { installedModels = res; srvstatus.textContent = '연결됨 — ' + srv + ' (' + res.size + ' 모델)'; }
  else srvstatus.textContent = '연결 실패 — ' + (window.__lastConnErr || '네트워크') + ' (' + srv + ')';
  if (res) { srvstatus.className = 'status'; } else { srvstatus.className = 'status err'; }
  renderCatalog();
  updateRunBtn();
  if (typeof refreshCreatePanel === 'function') refreshCreatePanel();
})();

// ---- ✚ 새 모델 만들기 (데몬 /api/create) ----
const cmodel = $('cmodel'), cbase = $('cbase'), cdesc = $('cdesc'),
      cquestions = $('cquestions'), ccreate = $('ccreate'), cfromq = $('cfromq'), cstatus = $('cstatus');

function fillBases() {
  const prev = cbase.value;
  cbase.innerHTML = '';
  const installed = CATALOG.filter((c) => c.installed && !c.mine);
  const list = installed.length ? installed : CATALOG.filter((c) => !c.mine);
  for (const c of list) {
    const o = document.createElement('option');
    o.value = c.model;
    o.textContent = c.model + (c.mine ? ' (내 모델)' : '');
    cbase.appendChild(o);
  }
  // laya:multilingual(한글 가능 베이스) 기본 우선 선택
  const pref = [...cbase.options].find((o) => o.value === 'laya:multilingual');
  if (pref) cbase.value = 'laya:multilingual';
  else if (prev && [...cbase.options].some((o) => o.value === prev)) cbase.value = prev;
}

function refreshCreatePanel() {
  if (!ccreate) return;
  fillBases();
  ccreate.disabled = !installedModels;
  if (!installedModels) cstatus.textContent = '먼저 서버에 연결되면 활성화된다';
}

if (ccreate) {
  ccreate.addEventListener('click', async () => {
    const name = (cmodel.value || '').trim();
    const base = cbase.value;
    if (!name) { cstatus.textContent = '모델 이름을 입력하세요'; cstatus.className = 'status err'; return; }
    if (!/^[a-z0-9][a-z0-9._:-]*$/i.test(name)) { cstatus.textContent = '이름은 영문·숫·._:- 조합만 허용'; cstatus.className = 'status err'; return; }
    let questions;
    const raw = cquestions.value.trim();
    if (raw) {
      try { questions = JSON.parse(raw); } catch (e) { cstatus.textContent = '질문 JSON 오류: ' + e.message; cstatus.className = 'status err'; return; }
      if (!questions || typeof questions !== 'object' || Array.isArray(questions) || !Object.keys(questions).length) {
        cstatus.textContent = '질문셋은 1개 이상의 객체'; cstatus.className = 'status err'; return;
      }
    }
    ccreate.disabled = true;
    cstatus.textContent = '생성 중... ' + name + ' (베이스: ' + base + ')';
    cstatus.className = 'status';
    const body = { model: name, from: base };
    if (raw) body.questions = questions;
    if (cdesc.value.trim()) body.description = cdesc.value.trim();
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    try {
      const res = await fetch(srv + '/api/create', { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('서버 ' + res.status + (j.error ? ' — ' + (j.error.message || j.error) : ''));
      cstatus.textContent = '생성 완료 — ' + name + '. 카탈로그 갱신 중...';
      const inst = await refreshInstalled(srv, key);
      installedModels = inst;
      srvstatus.textContent = '연결됨 — ' + srv + ' (' + (inst ? inst.size : '?') + ' 모델)';
      renderCatalog();
      updateRunBtn();
      cstatus.textContent = '생성 완료 — ' + name + ' (카탈로그 "내 모델" 그룹에 추가됨)';
    } catch (e) {
      cstatus.textContent = '생성 실패: ' + e.message;
      cstatus.className = 'status err';
    }
    ccreate.disabled = false;
  });
  cfromq.addEventListener('click', () => {
    const src = qjson.value.trim();
    if (!src) { cstatus.textContent = '질문 편집기(qjson)가 비어있다'; cstatus.className = 'status err'; return; }
    try { JSON.parse(src); cquestions.value = JSON.stringify(JSON.parse(src), null, 2); cstatus.textContent = '질문 편집기 내용 붙여넣음'; cstatus.className = 'status'; }
    catch (e) { cstatus.textContent = '질문 편집기 JSON 오류: ' + e.message; cstatus.className = 'status err'; }
  });
}
