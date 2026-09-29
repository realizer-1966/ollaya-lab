// ollaya Decision Model Lab — 서버 연결 + 카탈로그 + 질문 편집 + 판정
import { CATALOG, DEFAULT_SRV, DEFAULT_KEY, LS_KEY, LS_SRV, refreshInstalled } from './catalog.js';

const $ = (id) => document.getElementById(id);
const srvurl = $('srvurl'), srvkey = $('srvkey'), connect = $('connect');
const srvstatus = $('srvstatus'), status = $('status');
const run = $('run'), models = $('models');
const qjson = $('qjson'), presetSel = $('preset');

let srv = localStorage.getItem(LS_SRV) || DEFAULT_SRV;
// 구버전 http(폰트널 IP) 저장값 마이그레이션 — mixed content로 브라우저 fetch 불가
if (srv.startsWith('http://')) srv = DEFAULT_SRV;
let key = localStorage.getItem(LS_KEY) || DEFAULT_KEY;
let installedModels = null;
let selectedModel = null;

srvurl.value = srv;
srvkey.value = key;

connect.addEventListener('click', async () => {
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
});

function badge(c) {
  if (installedModels === null) return '<span class="badge missing">연결 필요</span>';
  return c.installed ? '<span class="badge ok">설치됨</span>' : '<span class="badge missing">pull 필요</span>';
}

function renderCatalog() {
  models.innerHTML = '';
  const fams = [...new Set(CATALOG.map((c) => c.family))];
  for (const fam of fams) {
    const famCards = CATALOG.filter((c) => c.family === fam);
    const head = document.createElement('div');
    head.className = 'family';
    head.style.marginTop = '14px';
    head.textContent = fam + ' — ' + famCards.length + '개';
    models.appendChild(head);
    for (const c of famCards) {
      const card = document.createElement('div');
      card.className = 'mcard' + (installedModels && !c.installed ? ' missing' : '') + (selectedModel === c.model ? ' sel' : '');
      card.innerHTML =
        '<div class="mname">' + c.model + ' ' + badge(c) + '</div>' +
        '<div class="mdesc">' + c.desc + '</div>' +
        '<div class="mtags conf">' +
          'engine=' + c.engine + ' · 최대옵션=' + (c.maxOptions ?? '?') +
        '</div>' +
        (c.tips ? '<div class="hint">' + c.tips + '</div>' : '');
      card.addEventListener('click', () => selectModel(c));
      models.appendChild(card);
    }
  }
}

function selectModel(c) {
  selectedModel = c.model;
  if (installedModels && !c.installed) {
    if (!confirm(c.model + ' 미설치 — 노트북에서 pull 필요.
계속 시도할까? (404 예상)')) {
      renderCatalog();
      return;
    }
  }
  renderCatalog();
  if (c.defaultQuestions) {
    qjson.value = JSON.stringify(c.defaultQuestions, null, 2);
  }
  updateRunBtn();
  status.textContent = selectedModel + ' 선택됨';
  status.className = 'status';
}

function updateRunBtn() {
  const hasSel = !!selectedModel;
  run.disabled = !hasSel;
  run.textContent = hasSel ? '판정 (' + selectedModel + ')' : '모델 선택 + 연결 후 판정';
}

const PRESETS = {};
for (const c of CATALOG) {
  if (c.defaultQuestions) PRESETS[c.model.split(':')[0]] = c.defaultQuestions;
}
for (const n of Object.keys(PRESETS)) {
  const opt = document.createElement('option');
  opt.value = n; opt.textContent = n + ' 프리셋';
  presetSel.appendChild(opt);
}
$('loadpreset').addEventListener('click', () => {
  const n = presetSel.value;
  if (n && PRESETS[n]) qjson.value = JSON.stringify(PRESETS[n], null, 2);
});
$('reset').addEventListener('click', () => {
  const fam = selectedModel?.split(':')[0];
  if (fam && PRESETS[fam]) qjson.value = JSON.stringify(PRESETS[fam], null, 2);
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
connect.click();  // srv·key 디폴트 내장 — 즉시 자동 연결
