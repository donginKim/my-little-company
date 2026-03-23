export function getDashboardHtml(_port: number): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Little Company</title>
<script src="https://cdn.jsdelivr.net/npm/marked@9/marked.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d0d1a;--sidebar:#12122a;--card:#1a1a38;--border:#252550;
  --text:#d8d8f0;--dim:#6868a0;--accent:#5555ff;
  --pm:#b050b0;--arch:#4070ff;--dev:#40b040;--rev:#b09030;--qa:#30b0b0;--ceo:#ffffff;
  --ok:#40c060;--warn:#c09030;--err:#c04040;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);height:100vh;display:flex;flex-direction:column;overflow:hidden;font-size:13px}

/* Header */
header{display:flex;align-items:center;gap:12px;padding:10px 20px;background:var(--sidebar);border-bottom:1px solid var(--border);flex-shrink:0}
header h1{font-size:14px;font-weight:700;color:#fff;letter-spacing:.04em}
#proj-badge{font-size:11px;padding:2px 10px;background:var(--accent);color:#fff;border-radius:999px}
#conn-dot{width:7px;height:7px;border-radius:50%;background:var(--dim);margin-left:auto;flex-shrink:0}
#conn-dot.live{background:#40ff80;animation:blink 1.5s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}

/* Toolbar */
#toolbar{display:flex;align-items:center;gap:8px;padding:8px 20px;background:var(--sidebar);border-bottom:1px solid var(--border);flex-shrink:0}
.btn{font-size:12px;font-weight:600;padding:5px 14px;border-radius:6px;border:none;cursor:pointer;transition:.15s;letter-spacing:.02em}
.btn:disabled{opacity:.35;cursor:not-allowed}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover:not(:disabled){background:#4444ee}
.btn-green{background:var(--ok);color:#000}
.btn-green:hover:not(:disabled){filter:brightness(1.1)}
.btn-red{background:var(--err);color:#fff}
.btn-red:hover:not(:disabled){filter:brightness(1.1)}
.btn-ghost{background:transparent;color:var(--dim);border:1px solid var(--border)}
.btn-ghost:hover:not(:disabled){color:var(--text);border-color:var(--text)}
#run-status{font-size:12px;color:var(--dim);margin-left:auto}
#run-status.running{color:var(--ok)}

/* Layout */
.layout{display:flex;flex:1;overflow:hidden}

/* Sidebar */
aside{width:210px;flex-shrink:0;background:var(--sidebar);border-right:1px solid var(--border);overflow-y:auto;padding:14px 0;display:flex;flex-direction:column;gap:20px}
.sb-section{padding:0 14px}
.sb-title{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}
.step-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;color:var(--dim);transition:.1s}
.step-row:hover{background:var(--card);color:var(--text)}
.step-row.done{color:var(--text)}
.step-row.active-step{background:var(--card);color:#fff}
.step-dot{width:7px;height:7px;border-radius:50%;background:var(--border);flex-shrink:0}
.step-row.done .step-dot{background:var(--ok)}
.step-row.active-step .step-dot{background:var(--accent);animation:blink 1s infinite}
.step-role{font-size:11px;color:var(--dim);margin-left:auto}
.sb-note{padding:0 14px}
.sb-note textarea{width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:7px 10px;font-size:12px;resize:none;outline:none;height:70px}
.sb-note textarea:focus{border-color:var(--accent)}
.sb-note .btn{width:100%;margin-top:6px;justify-content:center}

/* Main */
main{flex:1;display:flex;flex-direction:column;overflow:hidden}

/* Tabs */
.tabs{display:flex;gap:2px;padding:10px 18px 0;border-bottom:1px solid var(--border);flex-shrink:0}
.tab{font-size:12px;padding:5px 14px;border-radius:5px 5px 0 0;cursor:pointer;color:var(--dim);border:1px solid transparent;border-bottom:none;transition:.12s}
.tab:hover{color:var(--text)}
.tab.active{color:#fff;background:var(--card);border-color:var(--border)}

.content{flex:1;overflow-y:auto;padding:20px}
.panel{display:none}.panel.active{display:block}

/* Chat */
.chat-feed{display:flex;flex-direction:column;gap:18px}
.bubble-wrap{max-width:78%}
.bubble-wrap.from-ceo{align-self:flex-end}
.bub-meta{font-size:11px;color:var(--dim);margin-bottom:4px;display:flex;align-items:center;gap:6px}
.bub-name{font-weight:700}
.bub-body{background:var(--card);border:1px solid var(--border);border-radius:2px 12px 12px 12px;padding:10px 14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow-y:auto}
.bub-body.streaming::after{content:'\\25ae';animation:blink .7s infinite}
.from-ceo .bub-body{background:#1c1c1c;border-radius:12px 2px 12px 12px;border-color:#444}
[data-role=pm]        .bub-name{color:var(--pm)}
[data-role=architect] .bub-name{color:var(--arch)}
[data-role=developer] .bub-name{color:var(--dev)}
[data-role=reviewer]  .bub-name{color:var(--rev)}
[data-role=qa]        .bub-name{color:var(--qa)}
[data-role=pm]        .bub-body{border-left:3px solid var(--pm)}
[data-role=architect] .bub-body{border-left:3px solid var(--arch)}
[data-role=developer] .bub-body{border-left:3px solid var(--dev)}
[data-role=reviewer]  .bub-body{border-left:3px solid var(--rev)}
[data-role=qa]        .bub-body{border-left:3px solid var(--qa)}

/* Artifacts */
.art-grid{display:flex;flex-direction:column;gap:14px}
.art-card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.art-hd{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--border);cursor:pointer}
.art-hd:hover{background:rgba(255,255,255,.03)}
.art-path{font-size:11px;color:var(--dim)}
.art-bd{padding:16px 18px;font-size:13px;line-height:1.7;max-height:420px;overflow-y:auto;display:none}
.art-bd.open{display:block}
.art-bd h1,.art-bd h2,.art-bd h3{margin:14px 0 6px;color:#fff}
.art-bd h1{font-size:17px;border-bottom:1px solid var(--border);padding-bottom:5px}
.art-bd h2{font-size:14px}.art-bd h3{font-size:13px}
.art-bd p{margin-bottom:9px}
.art-bd ul,.art-bd ol{padding-left:18px;margin-bottom:9px}
.art-bd code{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace}
.art-bd pre{background:#09091a;border:1px solid var(--border);border-radius:6px;padding:11px;overflow-x:auto;margin-bottom:9px}
.art-bd pre code{background:none;padding:0}
.art-bd table{width:100%;border-collapse:collapse;margin-bottom:10px}
.art-bd th,.art-bd td{padding:5px 9px;border:1px solid var(--border);font-size:12px}
.art-bd th{background:rgba(255,255,255,.05)}
.chevron{transition:transform .2s;font-size:11px;color:var(--dim)}
.art-hd.open .chevron{transform:rotate(90deg)}

/* Tasks */
.task-grid{display:flex;flex-direction:column;gap:8px}
.task-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:11px 14px;display:flex;align-items:flex-start;gap:10px}
.t-icon{width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;margin-top:1px}
.t-icon.pending{background:var(--border);color:var(--dim)}
.t-icon.done{background:var(--ok);color:#000}
.t-icon.in_progress{background:var(--accent);color:#fff;animation:blink 1s infinite}
.t-icon.skipped{background:#333;color:var(--dim)}
.t-info{flex:1;min-width:0}
.t-title{font-weight:600;margin-bottom:3px}
.t-desc{color:var(--dim);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t-id{font-size:10px;color:var(--dim);margin-top:3px;font-family:monospace}

/* Notes */
.note-list{display:flex;flex-direction:column;gap:10px}
.note-card{background:var(--card);border:1px solid var(--border);border-left:3px solid #fff;border-radius:0 8px 8px 0;padding:11px 14px}
.note-meta{font-size:11px;color:var(--dim);margin-bottom:5px}
.note-body{white-space:pre-wrap}

/* Modal overlay */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;display:none}
.modal-overlay.open{display:flex}
.modal{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;min-width:420px;max-width:600px;width:90%}
.modal h3{font-size:15px;margin-bottom:14px;color:#fff}
.modal p{color:var(--dim);font-size:13px;margin-bottom:16px}
.modal textarea{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:9px 12px;font-size:13px;resize:vertical;min-height:80px;outline:none;margin-bottom:14px}
.modal textarea:focus{border-color:var(--accent)}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}

/* Changes panel */
.changes-panel{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px}
.changes-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.changes-header h3{font-size:14px;color:#fff}
.change-item{background:var(--bg);border:1px solid var(--border);border-radius:6px;margin-bottom:8px;overflow:hidden}
.change-item-hd{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;font-size:12px}
.change-item-hd:hover{background:rgba(255,255,255,.03)}
.change-badge{font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px}
.badge-create{background:#1a3a1a;color:var(--ok)}
.badge-modify{background:#1a1a3a;color:#8080ff}
.badge-delete{background:#3a1a1a;color:var(--err)}
.change-body{padding:10px 12px;border-top:1px solid var(--border);display:none;font-size:12px;font-family:monospace;white-space:pre-wrap;max-height:200px;overflow-y:auto;color:var(--dim)}
.change-body.open{display:block}
.changes-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}

/* Toast */
.toast{position:fixed;bottom:20px;right:20px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;z-index:200;opacity:0;transform:translateY(10px);transition:.3s;pointer-events:none}
.toast.show{opacity:1;transform:translateY(0)}

/* Empty */
.empty{color:var(--dim);text-align:center;padding:50px 20px}

/* Config form */
.cfg-wrap{max-width:700px;display:flex;flex-direction:column;gap:16px;padding-bottom:20px}
.cfg-card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.cfg-card-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px;color:#fff}
.cfg-body{padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.cfg-field{display:flex;align-items:center;gap:10px}
.cfg-field label{font-size:12px;color:var(--dim);width:80px;flex-shrink:0}
.cfg-input,.cfg-select{background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:5px;padding:5px 9px;font-size:12px;outline:none}
.cfg-input:focus,.cfg-select:focus{border-color:var(--accent)}
.cfg-select{cursor:pointer}
.cfg-input-wide{flex:1;min-width:0}
.btn-sm{font-size:11px;padding:3px 10px}
.cfg-provider{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:11px;display:flex;flex-direction:column;gap:8px}
.cfg-step{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:11px;display:flex;gap:10px}
.cfg-step-ctrl{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex-shrink:0}
.cfg-step-body{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
.cfg-step-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cfg-step-params{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cfg-footer{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding:4px 0}
.config-saved{font-size:12px;color:var(--ok);opacity:0;transition:.3s}
.config-saved.show{opacity:1}
.toggle{position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;cursor:pointer}
.toggle input{opacity:0;width:0;height:0;position:absolute}
.toggle-sw{position:absolute;inset:0;background:var(--border);border-radius:20px;transition:.2s}
.toggle-sw::before{content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.toggle input:checked~.toggle-sw{background:var(--accent)}
.toggle input:checked~.toggle-sw::before{transform:translateX(16px)}
</style>
</head>
<body>

<header>
  <h1>My Little Company</h1>
  <span id="proj-badge">&#8212;</span>
  <span id="conn-dot"></span>
</header>

<div id="toolbar">
  <button class="btn btn-green" onclick="openNewProject()">+ 새 프로젝트</button>
  <button class="btn btn-primary" id="btn-run-all">&#9654; &#51204;&#52404; &#49892;&#54665;</button>
  <button class="btn btn-ghost" id="btn-run-next">&#9197; &#45796;&#51020; &#49828;&#53945;</button>
  <button class="btn btn-red" id="btn-abort" disabled>&#9632; 중단</button>
  <button class="btn btn-ghost" id="btn-interrupt" disabled>&#9889; 개입</button>
  <button class="btn btn-ghost" id="btn-reset-pipeline" title="completedStepIds 초기화 — 파이프라인을 처음부터 다시 실행" onclick="resetPipeline()">&#8635; 초기화</button>
  <span id="run-status">대기 중</span>
</div>

<div class="layout">
  <aside>
    <div class="sb-section">
      <div class="sb-title">Pipeline</div>
      <div id="pipeline-list"></div>
    </div>
    <div class="sb-note">
      <div class="sb-title">CEO &#45432;&#53944; &#51452;&#51077;</div>
      <textarea id="ceo-note-input" placeholder="&#54028;&#51060;&#54532;&#46972;&#51064; &#51473;&#45800; &#54980; &#51452;&#51077;&#54624; &#51648;&#49884;&#49324;&#54637;&#8230;"></textarea>
      <button class="btn btn-ghost" id="btn-inject-note">&#51452;&#51077;</button>
    </div>
  </aside>

  <main>
    <div class="tabs">
      <div class="tab active" data-tab="chat">&#45824;&#54868;</div>
      <div class="tab" data-tab="artifacts">&#49328;&#52636;&#47932;</div>
      <div class="tab" data-tab="tasks">&#53468;&#49828;&#53356;</div>
      <div class="tab" data-tab="notes">CEO &#45432;&#53944;</div>
      <div class="tab" data-tab="config">&#49444;&#51221;</div>
    </div>
    <div class="content">
      <div id="chat"      class="panel active"><div class="chat-feed" id="chat-feed"></div></div>
      <div id="artifacts" class="panel"></div>
      <div id="tasks"     class="panel"></div>
      <div id="notes"     class="panel"></div>
      <div id="config"    class="panel">
        <div class="cfg-wrap">
          <div class="cfg-card">
            <div class="cfg-card-hd">LLM 설정</div>
            <div class="cfg-body">
              <div class="cfg-field">
                <label>기본 프로바이더</label>
                <select class="cfg-select" id="cfg-default-provider"></select>
              </div>
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:12px;color:var(--dim)">프로바이더</span>
                  <button class="btn btn-ghost btn-sm" onclick="addProvider()">+ 추가</button>
                </div>
                <div id="cfg-providers" style="display:flex;flex-direction:column;gap:8px"></div>
              </div>
            </div>
          </div>
          <div class="cfg-card">
            <div class="cfg-card-hd">
              <span>파이프라인</span>
              <button class="btn btn-ghost btn-sm" onclick="addPipelineStep()">+ 스텝 추가</button>
            </div>
            <div class="cfg-body">
              <div id="cfg-pipeline" style="display:flex;flex-direction:column;gap:8px"></div>
            </div>
          </div>
          <div class="cfg-card">
            <div class="cfg-card-hd">기타</div>
            <div class="cfg-body">
              <div class="cfg-field">
                <label>안전 모드</label>
                <label class="toggle"><input type="checkbox" id="cfg-safe-mode"><span class="toggle-sw"></span></label>
                <span style="font-size:11px;color:var(--dim)">파일을 실제로 쓰지 않고 미리보기만</span>
              </div>
            </div>
          </div>
          <div class="cfg-footer">
            <span class="config-saved" id="config-saved">✓ 저장됨</span>
            <button class="btn btn-primary" onclick="saveConfig()">저장</button>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>

<!-- Changes modal -->
<div class="modal-overlay" id="changes-overlay">
  <div class="modal" style="max-width:700px">
    <h3>&#48320;&#44221;&#49324;&#54637; &#44160;&#53664;</h3>
    <div id="changes-list"></div>
    <div class="changes-actions">
      <button class="btn btn-ghost" onclick="resolveChanges('reject')">건너뛰기</button>
      <button class="btn btn-green" onclick="resolveChanges('apply')">Apply &#10003;</button>
    </div>
  </div>
</div>

<!-- Checkpoint modal -->
<div class="modal-overlay" id="checkpoint-overlay">
  <div class="modal">
    <h3 id="chk-title">&#52404;&#53356;&#54252;&#51064;&#53944;</h3>
    <p id="chk-desc"></p>
    <textarea id="chk-note" placeholder="&#47700;&#47784; &#52628;&#44032; (&#49440;&#53469;)"></textarea>
    <div class="modal-actions">
      <button class="btn btn-red" onclick="resolveCheckpoint('abort')">&#51473;&#45800;</button>
      <button class="btn btn-green" onclick="resolveCheckpoint('continue')">&#44228;&#49549; &#9654;</button>
    </div>
  </div>
</div>

<!-- Collect-note modal -->
<div class="modal-overlay" id="collect-overlay">
  <div class="modal">
    <h3>CEO &#44060;&#51077;</h3>
    <p id="collect-prompt"></p>
    <textarea id="collect-note-input" placeholder="&#51648;&#49884;&#49324;&#54637;&#51012; &#51077;&#47141;&#54616;&#49464;&#50836;&#8230;"></textarea>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="resolveCollectNote()">&#51204;&#49569;</button>
    </div>
  </div>
</div>

<!-- New project modal -->
<div class="modal-overlay" id="newproject-overlay">
  <div class="modal">
    <h3>새 프로젝트 시작</h3>
    <p>프로젝트 이름과 아이디어를 입력하면 파이프라인이 시작됩니다.</p>
    <div style="margin-bottom:10px">
      <label style="font-size:11px;color:var(--dim);display:block;margin-bottom:4px">프로젝트 이름</label>
      <input id="np-name" type="text" placeholder="my-app" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 12px;font-size:13px;outline:none" />
    </div>
    <div style="margin-bottom:14px">
      <label style="font-size:11px;color:var(--dim);display:block;margin-bottom:4px">&#50500;&#51060;&#46356;&#50612;</label>
      <textarea id="np-idea" placeholder="&#50612;&#46500; &#50545;&#51012; &#47564;&#46308;&#44256; &#49910;&#51008;&#51648; &#49444;&#47749;&#54616;&#49464;&#50836;&#8230;" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:9px 12px;font-size:13px;resize:vertical;min-height:100px;outline:none"></textarea>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <input type="checkbox" id="np-run-all" checked style="accent-color:var(--accent)">
      <label for="np-run-all" style="font-size:12px;cursor:pointer">&#54028;&#51060;&#54532;&#46972;&#51064; &#48148;&#47196; &#49892;&#54665;</label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="document.getElementById('newproject-overlay').classList.remove('open')">취소</button>
      <button class="btn btn-primary" onclick="confirmNewProject()">시작 &#9654;</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
// -------------------------------------------------
// State
// -------------------------------------------------
let appState   = null;
let pipeline   = [];
let tasks      = [];
let notes      = [];
let isRunning  = false;
let activeTab  = 'chat';
let streamingBubble = null;

// -------------------------------------------------
// Init
// -------------------------------------------------
loadAll();
connectSSE();

// -------------------------------------------------
// Tabs
// -------------------------------------------------
document.querySelectorAll('.tab').forEach(function(t) {
  t.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(x) { x.classList.remove('active'); });
    t.classList.add('active');
    activeTab = t.dataset.tab;
    document.getElementById(activeTab).classList.add('active');
    if (activeTab === 'config') loadConfigParsed();
    else if (activeTab !== 'chat') renderTab(activeTab);
  });
});

// -------------------------------------------------
// Toolbar buttons
// -------------------------------------------------
function openNewProject() {
  document.getElementById('np-name').value = '';
  document.getElementById('np-idea').value = '';
  document.getElementById('newproject-overlay').classList.add('open');
  setTimeout(function() { document.getElementById('np-name').focus(); }, 50);
}

function confirmNewProject() {
  var name = document.getElementById('np-name').value.trim();
  var idea = document.getElementById('np-idea').value.trim();
  if (!name || !idea) { toast('프로젝트명과 아이디어를 입력하세요'); return; }
  var runAll = document.getElementById('np-run-all').checked;
  document.getElementById('newproject-overlay').classList.remove('open');
  post('/api/project/init', { projectName: name, idea: idea }).then(function() {
    toast('프로젝트 생성 완료: ' + name);
    loadAll();
    if (runAll) setTimeout(function() { post('/api/run/start', { mode: 'all' }); }, 200);
  });
}

function validatePipelineAndRun(mode, stepRef) {
  // Check: developer step exists without preceding architect step
  var devIdx = pipeline.findIndex(function(s) { return s.role === 'developer'; });
  if (devIdx >= 0) {
    var hasArchBefore = pipeline.slice(0, devIdx).some(function(s) { return s.role === 'architect'; });
    if (!hasArchBefore) {
      toast('파이프라인에 architect 스텝이 developer 앞에 없습니다. 설정 탭에서 추가해주세요.');
      return;
    }
  }
  // Check: project initialized
  if (!appState) {
    toast('프로젝트가 초기화되지 않았습니다. + 새 프로젝트를 먼저 실행하세요.');
    return;
  }
  post('/api/run/start', { mode: mode, stepRef: stepRef });
}
function resetPipeline() {
  if (isRunning) { toast('실행 중에는 초기화할 수 없습니다'); return; }
  if (!confirm('파이프라인 진행 상태를 초기화하시겠습니까? (생성된 파일은 삭제되지 않습니다)')) return;
  post('/api/state/reset', {}).then(function() {
    toast('파이프라인 초기화 완료 — 처음부터 다시 실행할 수 있습니다');
    loadAll();
  });
}
function showResetBanner() {
  var el = document.getElementById('reset-banner');
  if (el) { el.style.display = 'flex'; return; }
  var banner = document.createElement('div');
  banner.id = 'reset-banner';
  banner.style.cssText = 'display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 16px;margin:8px 0;font-size:13px';
  var span = document.createElement('span');
  span.style.color = 'var(--dim)';
  span.textContent = '모든 스텝이 완료되었습니다. 처음부터 다시 실행하려면:';
  var btnReset = document.createElement('button');
  btnReset.className = 'btn btn-ghost btn-sm';
  btnReset.textContent = '↺ 파이프라인 초기화';
  btnReset.addEventListener('click', resetPipeline);
  var btnClose = document.createElement('button');
  btnClose.className = 'btn btn-ghost btn-sm';
  btnClose.textContent = '×';
  btnClose.addEventListener('click', function() { banner.style.display = 'none'; });
  banner.appendChild(span);
  banner.appendChild(btnReset);
  banner.appendChild(btnClose);
  var feed = document.getElementById('chat-feed');
  feed.appendChild(banner);
  feed.scrollTop = feed.scrollHeight;
}
document.getElementById('btn-run-all').addEventListener('click', function() { validatePipelineAndRun('all'); });
document.getElementById('btn-run-next').addEventListener('click', function() { validatePipelineAndRun('next'); });
document.getElementById('btn-abort').addEventListener('click', function() { post('/api/run/abort', {}); });
document.getElementById('btn-interrupt').addEventListener('click', function() { post('/api/run/interrupt', {}); });
document.getElementById('btn-inject-note').addEventListener('click', function() {
  var note = document.getElementById('ceo-note-input').value.trim();
  if (!note) return;
  post('/api/run/interrupt', {});
  setTimeout(function() {
    post('/api/run/collect-note', { note: note });
    document.getElementById('ceo-note-input').value = '';
    toast('CEO \ub178\ud2b8\uac00 \uc8fc\uc785\ub418\uc5c8\uc2b5\ub2c8\ub2e4');
  }, 300);
});

// -------------------------------------------------
// API helpers
// -------------------------------------------------
function api(path) {
  return fetch(path).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
}
function post(path, body) {
  return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(function() {});
}

// -------------------------------------------------
// Load all data
// -------------------------------------------------
function loadAll() {
  return Promise.all([
    api('/api/state'),
    api('/api/pipeline'),
    api('/api/tasks'),
    api('/api/notes')
  ]).then(function(results) {
    appState = results[0];
    pipeline = results[1] || [];
    tasks    = (results[2] && results[2].tasks) ? results[2].tasks : [];
    notes    = results[3] || [];
    renderHeader();
    renderSidebar();
    if (activeTab !== 'chat') renderTab(activeTab);
  });
}

// -------------------------------------------------
// Header
// -------------------------------------------------
function renderHeader() {
  document.getElementById('proj-badge').textContent = (appState && appState.projectName) ? appState.projectName : '\u2014';
}

// -------------------------------------------------
// Sidebar
// -------------------------------------------------
function renderSidebar() {
  var el = document.getElementById('pipeline-list');
  if (!pipeline.length) { el.innerHTML = '<div style="color:var(--dim);font-size:12px">config \uc5c6\uc74c</div>'; return; }
  var done = {};
  var completedIds = (appState && appState.completedStepIds) ? appState.completedStepIds : [];
  completedIds.forEach(function(id) { done[id] = true; });
  el.innerHTML = pipeline.map(function(s) {
    var isDone = !!done[s.id];
    return '<div class="step-row ' + (isDone ? 'done' : '') + '" data-id="' + esc(s.id) + '">' +
      '<span class="step-dot"></span>' +
      '<span>' + esc(s.label) + '</span>' +
      '<span class="step-role">' + esc(s.role) + '</span>' +
      '</div>';
  }).join('');

  el.querySelectorAll('.step-row').forEach(function(row) {
    row.addEventListener('click', function() {
      if (isRunning) return;
      var stepId = row.dataset.id;
      var step = pipeline.find(function(s) { return s.id === stepId; });
      if (step && step.role === 'developer') {
        var stepIdx = pipeline.findIndex(function(s) { return s.id === stepId; });
        var hasArchBefore = pipeline.slice(0, stepIdx).some(function(s) { return s.role === 'architect'; });
        if (!hasArchBefore) {
          toast('architect 스텝이 developer 앞에 없습니다. 설정 탭에서 추가해주세요.');
          return;
        }
      }
      post('/api/run/start', { mode: 'next', stepRef: stepId });
    });
  });
}

// -------------------------------------------------
// Running state
// -------------------------------------------------
function setRunning(running) {
  isRunning = running;
  document.getElementById('btn-run-all').disabled = running;
  document.getElementById('btn-run-next').disabled = running;
  document.getElementById('btn-abort').disabled = !running;
  document.getElementById('btn-interrupt').disabled = !running;
  var status = document.getElementById('run-status');
  status.textContent = running ? '\uc2e4\ud589 \uc911\u2026' : '\ub300\uae30 \uc911';
  status.className = running ? 'running' : '';
}

// -------------------------------------------------
// Chat streaming bubbles
// -------------------------------------------------
function openBubble(role, stepId, stepLabel, model, provider) {
  var feed = document.getElementById('chat-feed');
  var wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';
  wrap.dataset.role = role;
  wrap.dataset.stepId = stepId;
  wrap.innerHTML =
    '<div class="bub-meta">' +
      '<span class="bub-name">' + esc(stepLabel) + '</span>' +
      '<span>' + esc(model) + ' \xb7 ' + esc(provider) + '</span>' +
    '</div>' +
    '<div class="bub-body streaming"></div>';
  feed.appendChild(wrap);
  feed.scrollTop = feed.scrollHeight;
  streamingBubble = wrap.querySelector('.bub-body');
}

function appendToken(token) {
  if (!streamingBubble) return;
  streamingBubble.textContent += token;
  var feed = document.getElementById('chat-feed');
  feed.scrollTop = feed.scrollHeight;
}

function closeBubble(summary) {
  if (streamingBubble) {
    streamingBubble.classList.remove('streaming');
    if (!streamingBubble.textContent.trim() && summary) {
      streamingBubble.textContent = summary;
    }
    streamingBubble = null;
  }
}

function addCeoBubble(note) {
  var feed = document.getElementById('chat-feed');
  var wrap = document.createElement('div');
  wrap.className = 'bubble-wrap from-ceo';
  var t = new Date().toLocaleTimeString('ko-KR');
  wrap.innerHTML =
    '<div class="bub-meta" style="justify-content:flex-end">' +
      '<span>' + t + '</span>' +
      '<span class="bub-name" style="color:var(--ceo)">CEO</span>' +
    '</div>' +
    '<div class="bub-body">' + esc(note) + '</div>';
  feed.appendChild(wrap);
  feed.scrollTop = feed.scrollHeight;
}

// -------------------------------------------------
// Modal helpers
// -------------------------------------------------
function showChanges(changes) {
  var list = document.getElementById('changes-list');
  list.innerHTML = changes.map(function(c, i) {
    var badgeClass = { create: 'badge-create', modify: 'badge-modify', delete: 'badge-delete' }[c.changeType] || '';
    var label = { create: 'NEW', modify: 'MOD', delete: 'DEL' }[c.changeType] || '?';
    var body = c.diff || c.preview || '';
    return '<div class="change-item">' +
      '<div class="change-item-hd" onclick="toggleChange(' + i + ')">' +
        '<span class="change-badge ' + badgeClass + '">' + label + '</span>' +
        '<span>' + esc(c.path) + '</span>' +
        '<span style="margin-left:auto;color:var(--dim);font-size:11px">&#9654;</span>' +
      '</div>' +
      '<div class="change-body" id="chg-' + i + '">' + esc(body) + '</div>' +
    '</div>';
  }).join('');
  document.getElementById('changes-overlay').classList.add('open');
}
function toggleChange(i) {
  document.getElementById('chg-' + i).classList.toggle('open');
}
function resolveChanges(decision) {
  document.getElementById('changes-overlay').classList.remove('open');
  post('/api/run/apply', { decision: decision });
}

function showCheckpoint(completedLabel, nextLabel) {
  document.getElementById('chk-title').textContent = '\uccb4\ud06c\ud3ec\uc778\ud2b8: ' + completedLabel + ' \uc644\ub8cc';
  document.getElementById('chk-desc').textContent = '\ub2e4\uc74c: ' + nextLabel + ' \ub97c \uc2dc\uc791\ud558\uae30 \uc804\uc785\ub2c8\ub2e4.';
  document.getElementById('chk-note').value = '';
  document.getElementById('checkpoint-overlay').classList.add('open');
}
function resolveCheckpoint(decision) {
  var note = document.getElementById('chk-note').value.trim();
  document.getElementById('checkpoint-overlay').classList.remove('open');
  post('/api/run/checkpoint', { decision: decision, note: note || undefined });
  if (note) addCeoBubble(note);
}

function showCollectNote(prompt) {
  document.getElementById('collect-prompt').textContent = prompt;
  document.getElementById('collect-note-input').value = '';
  document.getElementById('collect-overlay').classList.add('open');
  setTimeout(function() { document.getElementById('collect-note-input').focus(); }, 50);
}
function resolveCollectNote() {
  var note = document.getElementById('collect-note-input').value.trim();
  document.getElementById('collect-overlay').classList.remove('open');
  post('/api/run/collect-note', { note: note });
  if (note) addCeoBubble(note);
}

// -------------------------------------------------
// Render tabs
// -------------------------------------------------
function renderTab(tab) {
  if (tab === 'artifacts') renderArtifacts();
  else if (tab === 'tasks') renderTasks();
  else if (tab === 'notes') renderNotes();
}

function renderArtifacts() {
  var el = document.getElementById('artifacts');
  if (!appState) { el.innerHTML = '<div class="empty">\ud504\ub85c\uc81d\ud2b8 \ubbf8\ucd08\uae30\ud654</div>'; return; }
  var outputs = appState.outputs || {};
  var items = [];
  Object.keys(outputs).forEach(function(stepId) {
    var output = outputs[stepId];
    if (!output) return;
    var step = pipeline.find(function(s) { return s.id === stepId; });
    (output.artifacts || []).forEach(function(a) {
      items.push({ stepId: stepId, label: (step && step.label) ? step.label : stepId, role: output.role, artifact: a });
    });
  });
  if (!items.length) { el.innerHTML = '<div class="empty">\uc0b0\ucd9c\ubb3c \uc5c6\uc74c</div>'; return; }
  el.innerHTML = '<div class="art-grid">' + items.map(function(item) {
    var roleColors = { pm: 'var(--pm)', architect: 'var(--arch)', developer: 'var(--dev)', reviewer: 'var(--rev)', qa: 'var(--qa)' };
    var rc = roleColors[item.role] || 'var(--dim)';
    return '<div class="art-card">' +
      '<div class="art-hd" onclick="toggleArt(this)">' +
        '<div><span style="color:' + rc + '">' + esc(item.label) + '</span> <span class="art-path">' + esc(item.artifact.path) + '</span></div>' +
        '<span class="chevron">&#9654;</span>' +
      '</div>' +
      '<div class="art-bd" data-path="' + esc(item.artifact.path) + '" data-loaded="0"></div>' +
    '</div>';
  }).join('') + '</div>';
}

function toggleArt(hd) {
  hd.classList.toggle('open');
  var bd = hd.nextElementSibling;
  bd.classList.toggle('open');
  if (bd.classList.contains('open') && bd.dataset.loaded === '0') {
    bd.dataset.loaded = '1';
    bd.innerHTML = '<div style="color:var(--dim)">\ub85c\ub529 \uc911\u2026</div>';
    api('/api/artifact?path=' + encodeURIComponent(bd.dataset.path)).then(function(r) {
      bd.innerHTML = (r && r.content) ? marked.parse(r.content) : '<div style="color:var(--dim)">\ud30c\uc77c \uc5c6\uc74c</div>';
    });
  }
}

function renderTasks() {
  var el = document.getElementById('tasks');
  if (!tasks.length) { el.innerHTML = '<div class="empty">\ud0dc\uc2a4\ud06c \uc5c6\uc74c</div>'; return; }
  var icon = { pending: '\u25cb', done: '\u2713', in_progress: '\u2026', skipped: '\u2014' };
  el.innerHTML = '<div class="task-grid">' + tasks.map(function(t) {
    return '<div class="task-card">' +
      '<div class="t-icon ' + t.status + '">' + (icon[t.status] || '?') + '</div>' +
      '<div class="t-info">' +
        '<div class="t-title">' + esc(t.title) + '</div>' +
        '<div class="t-desc">' + esc(t.description) + '</div>' +
        '<div class="t-id">' + esc(t.id) + '</div>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
}

function renderNotes() {
  var el = document.getElementById('notes');
  if (!notes.length) { el.innerHTML = '<div class="empty">CEO \ub178\ud2b8 \uc5c6\uc74c</div>'; return; }
  el.innerHTML = '<div class="note-list">' + notes.map(function(n) {
    return '<div class="note-card">' +
      '<div class="note-meta">' + esc(n.afterLabel || n.afterStepId) + ' \uc774\ud6c4 \xb7 ' + new Date(n.timestamp).toLocaleString('ko-KR') + '</div>' +
      '<div class="note-body">' + esc(n.note) + '</div>' +
    '</div>';
  }).join('') + '</div>';
}

// -------------------------------------------------
// Toast
// -------------------------------------------------
var toastTimer = null;
function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.classList.remove('show'); }, 2500);
}

// -------------------------------------------------
// SSE
// -------------------------------------------------
var currentStepLabel = '';
var currentStepRole  = '';

function connectSSE() {
  var es = new EventSource('/events');
  var dot = document.getElementById('conn-dot');

  es.onopen = function() { dot.classList.add('live'); };
  es.onerror = function() { dot.classList.remove('live'); setTimeout(connectSSE, 3000); es.close(); };

  es.onmessage = function(e) {
    var ev;
    try { ev = JSON.parse(e.data); } catch(err) { return; }

    switch (ev.type) {
      case 'run:start':
        setRunning(true);
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function(x) { x.classList.remove('active'); });
        document.querySelector('[data-tab="chat"]').classList.add('active');
        document.getElementById('chat').classList.add('active');
        activeTab = 'chat';
        break;

      case 'role:start':
        currentStepRole  = ev.role;
        currentStepLabel = ev.stepLabel;
        document.querySelectorAll('.step-row').forEach(function(r) { r.classList.remove('active-step'); });
        var activeRow = document.querySelector('.step-row[data-id="' + ev.stepId + '"]');
        if (activeRow) activeRow.classList.add('active-step');
        break;

      case 'llm:request':
        openBubble(ev.role, ev.stepId, currentStepLabel || ev.stepId, ev.model, ev.provider);
        break;

      case 'llm:token':
        appendToken(ev.token);
        break;

      case 'llm:response':
        closeBubble('');
        break;

      case 'role:complete':
        closeBubble(ev.summary);
        document.querySelectorAll('.step-row').forEach(function(r) {
          if (r.dataset.id === ev.stepId) { r.classList.add('done'); r.classList.remove('active-step'); }
        });
        break;

      case 'role:error':
        closeBubble('');
        toast('\uc624\ub958: ' + ev.error);
        break;

      case 'artifact:save':
        toast('\uc800\uc7a5\ub428: ' + ev.filePath);
        break;

      case 'changes:pending':
        showChanges(ev.changes);
        break;

      case 'changes:applied':
        toast(ev.count + '\uac1c \ud30c\uc77c \uc801\uc6a9 \uc644\ub8cc');
        break;

      case 'changes:rejected':
        toast('\ubcc0\uacbd\uc0ac\ud56d \uac74\ub108\ub700');
        break;

      case 'checkpoint':
        showCheckpoint(ev.completedLabel, ev.nextLabel);
        break;

      case 'collect:note':
        showCollectNote(ev.prompt);
        break;

      case 'ceo:interrupt':
        addCeoBubble(ev.note);
        break;

      case 'pipeline:complete':
        setRunning(false);
        toast('파이프라인 완료!');
        loadAll();
        break;

      case 'pipeline:already_complete':
        setRunning(false);
        toast('모든 스텝이 이미 완료되었습니다. 다시 실행하려면 파이프라인을 초기화하세요.');
        showResetBanner();
        break;

      case 'pipeline:aborted':
        setRunning(false);
        toast('\ud30c\uc774\ud504\ub77c\uc778 \uc911\ub2e8\ub428');
        loadAll();
        break;

      case 'pipeline:error':
        setRunning(false);
        toast('\uc624\ub958: ' + ev.message);
        break;

      case 'state:refresh':
        loadAll();
        if (activeTab !== 'chat') renderTab(activeTab);
        break;

      case 'error':
        toast(ev.message);
        break;
    }
  };
}

// -------------------------------------------------
// Config form
// -------------------------------------------------
var cfgData = null;

function loadConfigParsed() {
  api('/api/config/parsed').then(function(r) {
    if (!r) return;
    cfgData = r;
    if (!cfgData.llm) cfgData.llm = { defaultProvider: 'anthropic', providers: {} };
    if (!cfgData.llm.providers) cfgData.llm.providers = {};
    if (!cfgData.pipeline) cfgData.pipeline = [];
    renderConfig();
  });
}

function renderConfig() {
  renderCfgDefaultProvider();
  renderProviders();
  renderPipelineSteps();
  document.getElementById('cfg-safe-mode').checked = !!cfgData.safeMode;
}

function renderCfgDefaultProvider() {
  var sel = document.getElementById('cfg-default-provider');
  var names = Object.keys(cfgData.llm.providers || {});
  var cur = cfgData.llm.defaultProvider || '';
  sel.innerHTML = names.map(function(n) {
    return '<option value="' + esc(n) + '"' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>';
  }).join('');
  sel.onchange = function() { cfgData.llm.defaultProvider = this.value; };
}

function renderProviders() {
  var el = document.getElementById('cfg-providers');
  var providers = cfgData.llm.providers || {};
  var names = Object.keys(providers);
  if (!names.length) {
    el.innerHTML = '<div style="color:var(--dim);font-size:12px">프로바이더 없음</div>';
    return;
  }
  el.innerHTML = names.map(function(name, idx) {
    var p = providers[name];
    var isOllama = p.type === 'ollama';
    var typeOpts = ['anthropic','openai','ollama'].map(function(t) {
      return '<option value="' + t + '"' + (p.type === t ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
    var credField = isOllama
      ? '<div class="cfg-field"><label>Base URL</label><input class="cfg-input cfg-input-wide prov-baseurl" value="' + esc(p.baseUrl || '') + '" placeholder="http://localhost:11434" data-idx="' + idx + '"></div>'
      : '<div class="cfg-field"><label>API Key</label><input class="cfg-input cfg-input-wide prov-apikey" value="' + esc(p.apiKey || '') + '" placeholder="API 키 또는 환경변수" data-idx="' + idx + '"></div>';
    return '<div class="cfg-provider" data-idx="' + idx + '">' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<input class="cfg-input prov-name" style="font-weight:600;width:130px" value="' + esc(name) + '" placeholder="이름" data-idx="' + idx + '">' +
        '<select class="cfg-select prov-type" data-idx="' + idx + '">' + typeOpts + '</select>' +
        '<button class="btn btn-ghost btn-sm prov-del" style="color:var(--err);margin-left:auto" data-idx="' + idx + '">삭제</button>' +
      '</div>' +
      credField +
      '<div class="cfg-field"><label>기본 모델</label><input class="cfg-input cfg-input-wide prov-model" value="' + esc(p.defaultModel || '') + '" placeholder="모델명" data-idx="' + idx + '"></div>' +
    '</div>';
  }).join('');

  var provNames = names.slice();
  el.querySelectorAll('.prov-del').forEach(function(btn) {
    btn.addEventListener('click', function() { removeProvider(provNames[parseInt(this.dataset.idx)]); });
  });
  el.querySelectorAll('.prov-name').forEach(function(inp) {
    inp.addEventListener('change', function() { renameProvider(provNames[parseInt(this.dataset.idx)], this.value); });
  });
  el.querySelectorAll('.prov-type').forEach(function(sel) {
    sel.addEventListener('change', function() { updateProvider(provNames[parseInt(this.dataset.idx)], 'type', this.value); });
  });
  el.querySelectorAll('.prov-apikey').forEach(function(inp) {
    inp.addEventListener('change', function() { updateProvider(provNames[parseInt(this.dataset.idx)], 'apiKey', this.value); });
  });
  el.querySelectorAll('.prov-baseurl').forEach(function(inp) {
    inp.addEventListener('change', function() { updateProvider(provNames[parseInt(this.dataset.idx)], 'baseUrl', this.value); });
  });
  el.querySelectorAll('.prov-model').forEach(function(inp) {
    inp.addEventListener('change', function() { updateProvider(provNames[parseInt(this.dataset.idx)], 'defaultModel', this.value); });
  });
}

function renderPipelineSteps() {
  var el = document.getElementById('cfg-pipeline');
  var steps = cfgData.pipeline || [];
  var providerNames = Object.keys(cfgData.llm.providers || {});
  var roles = ['pm','architect','developer','reviewer','qa'];
  if (!steps.length) {
    el.innerHTML = '<div style="color:var(--dim);font-size:12px">스텝 없음</div>';
    return;
  }
  el.innerHTML = steps.map(function(step, i) {
    var roleOpts = roles.map(function(r) {
      return '<option value="' + r + '"' + (step.role === r ? ' selected' : '') + '>' + r + '</option>';
    }).join('');
    var provOpts = '<option value=""' + (!step.provider ? ' selected' : '') + '>(기본)</option>' +
      providerNames.map(function(p) {
        return '<option value="' + esc(p) + '"' + (step.provider === p ? ' selected' : '') + '>' + esc(p) + '</option>';
      }).join('');
    var temp = step.temperature !== undefined ? parseFloat(step.temperature) : 0.5;
    var tokens = step.maxTokens || 4096;
    var tid = 'cfg-t-' + i;
    var modeRow = step.role === 'developer'
      ? '<div class="cfg-step-params" style="margin-top:4px">' +
          '<span style="font-size:11px;color:var(--dim)">출력 모드</span>' +
          '<select class="cfg-select step-mode" data-idx="' + i + '" style="font-size:11px;padding:2px 6px">' +
            '<option value="code"' + ((!step.mode || step.mode === 'code') ? ' selected' : '') + '>code — 소스 파일만</option>' +
            '<option value="full"' + (step.mode === 'full' ? ' selected' : '') + '>full — 소스 + 의존성 + 실행 스크립트</option>' +
          '</select>' +
        '</div>'
      : '';
    return '<div class="cfg-step">' +
      '<div class="cfg-step-ctrl">' +
        '<button class="btn btn-ghost btn-sm step-up" style="padding:2px 7px" data-idx="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<span style="font-size:11px;color:var(--dim);text-align:center;min-width:14px">' + (i+1) + '</span>' +
        '<button class="btn btn-ghost btn-sm step-dn" style="padding:2px 7px" data-idx="' + i + '"' + (i === steps.length-1 ? ' disabled' : '') + '>↓</button>' +
      '</div>' +
      '<div class="cfg-step-body">' +
        '<div class="cfg-step-top">' +
          '<select class="cfg-select step-role" data-idx="' + i + '" style="font-weight:600">' + roleOpts + '</select>' +
          '<select class="cfg-select step-prov" data-idx="' + i + '">' + provOpts + '</select>' +
          '<button class="btn btn-ghost btn-sm step-del" style="color:var(--err);margin-left:auto" data-idx="' + i + '">삭제</button>' +
        '</div>' +
        '<div class="cfg-step-params">' +
          '<span style="font-size:11px;color:var(--dim)">온도</span>' +
          '<input type="range" class="step-temp" min="0" max="1" step="0.05" value="' + temp + '" style="flex:1;accent-color:var(--accent);min-width:80px" data-idx="' + i + '" data-tid="' + tid + '">' +
          '<span id="' + tid + '" style="font-size:11px;width:28px;text-align:right">' + temp.toFixed(2) + '</span>' +
          '<span style="font-size:11px;color:var(--dim);margin-left:8px">토큰</span>' +
          '<input class="cfg-input step-tokens" type="number" value="' + tokens + '" min="256" max="200000" step="256" style="width:80px" data-idx="' + i + '">' +
        '</div>' +
        modeRow +
      '</div>' +
    '</div>';
  }).join('');

  el.querySelectorAll('.step-up').forEach(function(b) { b.addEventListener('click', function() { movePipelineStep(parseInt(this.dataset.idx), -1); }); });
  el.querySelectorAll('.step-dn').forEach(function(b) { b.addEventListener('click', function() { movePipelineStep(parseInt(this.dataset.idx), 1); }); });
  el.querySelectorAll('.step-del').forEach(function(b) { b.addEventListener('click', function() { removePipelineStep(parseInt(this.dataset.idx)); }); });
  el.querySelectorAll('.step-role').forEach(function(s) {
    s.addEventListener('change', function() {
      cfgData.pipeline[parseInt(this.dataset.idx)].role = this.value;
      renderPipelineSteps(); // mode row 표시/숨김 갱신
    });
  });
  el.querySelectorAll('.step-prov').forEach(function(s) {
    s.addEventListener('change', function() {
      if (this.value) cfgData.pipeline[parseInt(this.dataset.idx)].provider = this.value;
      else delete cfgData.pipeline[parseInt(this.dataset.idx)].provider;
    });
  });
  el.querySelectorAll('.step-temp').forEach(function(inp) {
    inp.addEventListener('input', function() {
      cfgData.pipeline[parseInt(this.dataset.idx)].temperature = parseFloat(this.value);
      document.getElementById(this.dataset.tid).textContent = parseFloat(this.value).toFixed(2);
    });
  });
  el.querySelectorAll('.step-tokens').forEach(function(inp) {
    inp.addEventListener('change', function() { cfgData.pipeline[parseInt(this.dataset.idx)].maxTokens = parseInt(this.value); });
  });
  el.querySelectorAll('.step-mode').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var idx = parseInt(this.dataset.idx);
      if (this.value === 'code') delete cfgData.pipeline[idx].mode;
      else cfgData.pipeline[idx].mode = this.value;
    });
  });
}

function addProvider() {
  if (!cfgData.llm.providers) cfgData.llm.providers = {};
  var n = 1;
  while (cfgData.llm.providers['provider-' + n]) n++;
  cfgData.llm.providers['provider-' + n] = { type: 'anthropic', apiKey: '', defaultModel: '' };
  renderProviders();
  renderCfgDefaultProvider();
}

function removeProvider(name) {
  delete cfgData.llm.providers[name];
  if (cfgData.llm.defaultProvider === name) {
    cfgData.llm.defaultProvider = Object.keys(cfgData.llm.providers)[0] || '';
  }
  renderProviders();
  renderCfgDefaultProvider();
}

function renameProvider(oldName, newName) {
  if (!newName || newName === oldName) return;
  var entries = Object.entries(cfgData.llm.providers);
  cfgData.llm.providers = {};
  entries.forEach(function(e) {
    cfgData.llm.providers[e[0] === oldName ? newName : e[0]] = e[1];
  });
  if (cfgData.llm.defaultProvider === oldName) cfgData.llm.defaultProvider = newName;
  renderProviders();
  renderCfgDefaultProvider();
}

function updateProvider(name, key, value) {
  if (!cfgData.llm.providers[name]) return;
  cfgData.llm.providers[name][key] = value;
  if (key === 'type') renderProviders();
}

function addPipelineStep() {
  cfgData.pipeline.push({ role: 'developer', temperature: 0.3, maxTokens: 8192 });
  renderPipelineSteps();
}

function removePipelineStep(i) {
  cfgData.pipeline.splice(i, 1);
  renderPipelineSteps();
}

function movePipelineStep(i, dir) {
  var j = i + dir;
  if (j < 0 || j >= cfgData.pipeline.length) return;
  var tmp = cfgData.pipeline[i]; cfgData.pipeline[i] = cfgData.pipeline[j]; cfgData.pipeline[j] = tmp;
  renderPipelineSteps();
}

function saveConfig() {
  document.getElementById('cfg-safe-mode').checked;
  cfgData.safeMode = document.getElementById('cfg-safe-mode').checked;
  post('/api/config/save-json', cfgData).then(function() {
    var s = document.getElementById('config-saved');
    s.classList.add('show');
    setTimeout(function() { s.classList.remove('show'); }, 2000);
  });
}

// input focus style
document.getElementById('np-name').addEventListener('focus', function() { this.style.borderColor = 'var(--accent)'; });
document.getElementById('np-name').addEventListener('blur',  function() { this.style.borderColor = 'var(--border)'; });
document.getElementById('np-idea').addEventListener('focus', function() { this.style.borderColor = 'var(--accent)'; });
document.getElementById('np-idea').addEventListener('blur',  function() { this.style.borderColor = 'var(--border)'; });

// Enter key to confirm new project
document.getElementById('np-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('np-idea').focus();
});

// -------------------------------------------------
// Utils
// -------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
</script>
</body>
</html>`;
}
