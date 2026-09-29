// ollaya Decision Model Lab — 카탈로그
// 노트북 서버에 설치 확인은 런타임에 /v1/models로. 여기는 레지스트리 전체 11 패밀리.

const DEFAULT_SRV = 'https://dydtn.tailc2a754.ts.net';
const DEFAULT_KEY = '#ys1217474!';
const LS_KEY = 'ollaya-lab-server-key';
const LS_SRV = 'ollaya-lab-server-url';

// ---- 모델 카탈로그 (레지스트리 전체 11 패밀리 21 모델) ----
// installed는 런타임에 /v1/models로 갱신
const CATALOG = [
  {
    family: 'laya', model: 'laya:latest', router: true,
    desc: '라우터 — 판정 요청을 state의 문자/언어로 laya:en 또는 laya:multilingual을 고른다.',
    engine: 'router', maxOptions: null, questions: null,
    tips: '한국어/영어 섞이는 실전 입력에 권장 — 라우팅 이유가 결과 카드에 표시된다.',
  },
  {
    family: 'laya', model: 'laya:multilingual',
    desc: '100+ 언어 판정 (mmBERT-base) — 한글 등 비라틴 스크립트 가능한 유일한 laya 체크포인트.',
    engine: 'onnx', maxOptions: 250,
    defaultQuestions: {
      intent: { type: 'choice', instructions: '이 텍스트의 핵심 요청은?', criteria: {
        refund: '돈을 돌려달라', complaint: '불만·문제 제기', inquiry: '정보 문의', action: '무언가 해달라', other: '기타' } },
      urgency: { type: 'score', instructions: '긴급도는?', criteria: ['여유', '보통', '긴급'] },
      negative: { type: 'noul', instructions: '부정적 감정이 담겼나?' },
    },
    tips: '한국어 — 서버 fp32(0.99 신뢰) vs 브라우저 INT8(열화). refund 0.9962 실측.',
  },
  {
    family: 'laya', model: 'laya:en',
    desc: '영어 전용 (ModernBERT-large): guardrails, 메일·티켓 트리지 — 속도 우선.',
    engine: 'onnx', maxOptions: 125,
    defaultQuestions: {
      intent: { type: 'choice', instructions: 'What is the core request?', criteria: {
        refund: 'Wants money back', complaint: 'Complaint', inquiry: 'Asking questions', action: 'Asks to do something', other: 'Other' } },
      urgency: { type: 'score', instructions: 'Urgency level?', criteria: ['calm', 'moderate', 'urgent'] },
      negative: { type: 'noul', instructions: 'Contains negative emotion?' },
    },
    tips: '라틴 스크립트 한정 — 한글 입력시 직접 지정해도 읽을 수 없다.',
  },
  {
    family: 'laya', model: 'laya:typed-decisions',
    desc: 'typed-decisions 워크플로 파인튜닝 (0.766 accuracy) — 구조화 티켓 분류 특화.',
    engine: 'onnx', maxOptions: 250, defaultQuestions: null,
    tips: '티켓 분류 벤치마크용 — 동일 프롬프트를 laya:en과 비교해볼 수 있다.',
  },
  {
    family: 'winnow', model: 'winnow:e4b',
    desc: 'Winnow-E4B (Gemma 4 E4B IT 파인튜닝), Q8_0 GGUF — 옵션 라벨 A~P 확률. llama.cpp 엔진 + 작성자 fitted temperature.',
    engine: 'llama', maxOptions: 64,
    defaultQuestions: {
      department: { type: 'choice', instructions: 'Which department handles this?', criteria: {
        billing: 'Payments, invoices and refunds', technical: 'Bugs and outages', account: 'Login and settings' } },
      urgency: { type: 'score', instructions: 'Urgency level?', criteria: ['calm', 'moderate', 'urgent'] },
      negative: { type: 'noul', instructions: 'Contains negative emotion?' },
    },
    tips: 'choice/score/noul 모두 실측 통과 — score 웜 123ms, 318ms. 8GB RAM 여유 필요.',
  },
  {
    family: 'winnow', model: 'winnow:12b',
    desc: 'Winnow-12B — 같은 winnow-v1 레이아웃, 더 큰 Gemma 베이스.',
    engine: 'llama', maxOptions: 64, defaultQuestions: null,
    installNote: '대형 GGUF — RAM 충분할 때만 pull.',
  },
  {
    family: 'decider', model: 'decider:0.8b',
    desc: 'Decider-0.8B (Qwen3.5-0.8B base) — decider-slots-v1: 답 슬롯 토큰 위치에 라벨 로짓. 255 옵션, 32k ctx.',
    engine: 'onnx', maxOptions: 255, defaultQuestions: null,
  },
  {
    family: 'decider', model: 'decider:2b',
    desc: 'Decider-2B (Qwen3.5-2B base) — decider-slots-v1, 255 옵션, 32k ctx.',
    engine: 'onnx', maxOptions: 255, defaultQuestions: null,
    tips: '옵션 상한 255가 전체 레지스트리에서 가장 큼 — 큰 라벨셋 테스트 유니크.',
  },
  {
    family: 'decider', model: 'decider:2b-vision',
    desc: 'Decider-2B Vision — 이미지 1장 입력 (PNG base64) 지원. ollaya 유일 vision 결정모델.',
    engine: 'onnx', maxOptions: 255, defaultQuestions: null,
    tips: '/api/decide에 images: [base64 PNG data:] 전달 — 판정 옵션은 image 안에서 읽는다.',
  },
  {
    family: 'decider', model: 'decider:4b',
    desc: 'Decider-4B (Qwen3.5-4B base) — decider-slots-v1.',
    engine: 'onnx', maxOptions: 255, defaultQuestions: null,
  },
  {
    family: 'kev', model: 'kev:0.8b',
    desc: 'KEV-0.8B — kev-pointer-v1: 각 옵션의 close 토큰 위치에 pointer score. LoRA r16.',
    engine: 'onnx', maxOptions: 255, defaultQuestions: null,
  },
  {
    family: 'kev', model: 'kev:4b',
    desc: 'KEV-4B (Qwen3.5-4B base) — kev-pointer-v1.',
    engine: 'onnx', maxOptions: 255, defaultQuestions: null,
    tips: 'pointer 아키텍처 — winnow(라벨확률)와 다른 판정 방식 비교용.',
  },
  {
    family: 'kev', model: 'kev:9b',
    desc: 'KEV-9B — kev-pointer-v1 최대 크기.',
    engine: 'onnx', maxOptions: 255, defaultQuestions: null,
    installNote: '대형',
  },
  {
    family: 'clm', model: 'clm:8b',
    desc: 'CLM-0.1-8B (Qwen3-8B) — clm-v1: contrastive LM 판정 (Contrastive-LM/CLM).',
    engine: 'onnx', maxOptions: null, defaultQuestions: null,
  },
  {
    family: 'nli', model: 'nli:deberta-v3-large',
    desc: 'NLI zero-shot (deBERTa-v3-large-zeroshot-v2.0) — premise/hypothesis pairs 레이아웃. MIT.',
    engine: 'onnx', maxOptions: null, defaultQuestions: null,
    tips: 'choice criteria가 hypothesis로 읽힌다 — NLI 방식 판정 비교 유니크.',
  },
  {
    family: 'nli', model: 'nli:modernbert-large',
    desc: 'NLI zero-shot (ModernBERT-large) — pairs 레이아웃, deBERTa보다 빠름.',
    engine: 'onnx', maxOptions: null, defaultQuestions: null,
  },
  {
    family: 'qwen3guard', model: 'qwen3guard:0.6b',
    desc: 'Qwen3Guard-Gen-0.6B — safety 분류: safety(safe/controversial/unsafe), unsafe 여부, 9개 카테고리.',
    engine: 'onnx', maxOptions: 3,
    embeddedQuestions: true,
    defaultQuestions: {
      safety: { type: 'choice', instructions: 'Qwen3Guard safety level of the user text', criteria: {
        safe: null, controversial: null, unsafe: null } },
      unsafe: { type: 'noul', instructions: 'Qwen3Guard: the user text is unsafe' },
      unsafe_strict: { type: 'noul', instructions: 'Qwen3Guard: the user text is unsafe or controversial' },
      category: { type: 'choice', instructions: 'Qwen3Guard: first unsafe category, given unsafe', criteria: {
        none: null, violent: null, non_violent_illegal: null, sexual: null, pii: null, suicide_self_harm: null, unethical: null, politically_sensitive: null, copyright: null, jailbreak: null } },
    },
    tips: '임베디드 질문셋 보유 — questions를 생략하면 프리셋으로 판정.',
  },
  {
    family: 'gliclass', model: 'gliclass:large',
    desc: 'GLiClass instruct-large — markers 레이아웃, instruction 기반 분류. Knowledgator Apache-2.0.',
    engine: 'onnx', maxOptions: null, defaultQuestions: null,
  },
  {
    family: 'decision', model: 'decision:eos',
    desc: 'Decision-1.0-Eos-0.8B (Qwen3.5-0.8B base) — decision-endpoint-v1 (llm-semantic-router 계열).',
    engine: 'onnx', maxOptions: null, defaultQuestions: null,
  },
  {
    family: 'von', model: 'von:1.1',
    desc: 'von 1.1 (ModernBERT-large) — 옵션 마커 레이아웃, 8k ctx. Apache-2.0.',
    engine: 'onnx', maxOptions: null, defaultQuestions: null,
  },
  {
    family: 'jevk5', model: 'jevk5:4b',
    desc: 'JevK5-4B — 라벨 A~P(16개) 확률 레이아웃, llama.cpp 엔진.',
    engine: 'llama', maxOptions: 16, defaultQuestions: null,
  },
];

// ---- 런타임 설치 상태 갱신 ----
async function refreshInstalled(srv, key) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = 'Bearer ' + key;
    const res = await fetch(srv + '/v1/models', { headers });
    if (!res.ok) return null;
    const j = await res.json();
    const installed = new Set((j.models ?? []).map((m) => m.name));
    const descs = Object.fromEntries((j.models ?? []).map((m) => [m.name, m.description]));
    for (const c of CATALOG) {
      c.installed = installed.has(c.model);
      if (c.installed && descs[c.model]) c.desc = descs[c.model];
    }
    return installed;
  } catch {
    return null;
  }
}

export { CATALOG, DEFAULT_SRV, DEFAULT_KEY, LS_KEY, LS_SRV, refreshInstalled };

// node 단위테스트용 CommonJS (브라우저에서 무시됨)
if (typeof module !== 'undefined' && module.exports) module.exports = { CATALOG, DEFAULT_SRV, DEFAULT_KEY, refreshInstalled };
