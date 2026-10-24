/* 小叶健康 · 主增强模块 yx-plus.js (v2) */
(function () {
  "use strict";
  var YX = window.YX = window.YX || {};
  function $(s, r) { return (r || document).querySelector(s); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function r1(v) { return Math.round(num(v) * 10) / 10; }
  function fx(v) { var n = r1(v); return Number.isInteger(n) ? String(n) : n.toFixed(1); }
  function escx(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function escAttr(s) { return String(s).replace(/\\/g, "\\\\").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "\\'"); }
  var MN = (typeof MEALS !== "undefined" && MEALS) ? MEALS : { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
  function ml(m) { return MN[m] || "餐次"; }
  function today(d) { return todayStr(d || new Date()); }
  var _tt = null;
  function toastx(msg, action) {
    var el = $("#yxToast");
    if (!el) { el = document.createElement("div"); el.id = "yxToast"; document.body.appendChild(el); }
    el.innerHTML = "<span>" + escx(msg) + "</span>" + (action ? '<button id="yxToastBtn">' + escx(action.label) + "</button>" : "");
    el.classList.add("show"); clearTimeout(_tt);
    if (action) { var b = $("#yxToastBtn"); if (b) b.onclick = function () { el.classList.remove("show"); action.fn(); }; }
    _tt = setTimeout(function () { el.classList.remove("show"); }, action ? 4500 : 1900);
  }
  YX.toast = toastx;

  /* 数据 */
  function ensureData() {
    if (typeof DB === "undefined" || !DB) return;
    if (!Array.isArray(DB.foods2)) DB.foods2 = [];
    if (!Array.isArray(DB.meals2)) DB.meals2 = [];
    if (!Array.isArray(DB.fastHistory)) DB.fastHistory = [];
    if (!DB.mealPlan || typeof DB.mealPlan !== "object") DB.mealPlan = {};
    if (!DB.units2 || typeof DB.units2 !== "object") DB.units2 = {};
    if (!DB.yx || typeof DB.yx !== "object") DB.yx = { online: true, micro: false, planDate: "" };
    if (typeof DB.yx.online !== "boolean") DB.yx.online = true;
    if (typeof DB.yx.micro !== "boolean") DB.yx.micro = false;
    if (Array.isArray(DB.customFoods) && DB.customFoods.length) {
      DB.customFoods.forEach(function (f) {
        if (!f || !f.name) return;
        if (DB.foods2.some(function (x) { return x.name === f.name; })) return;
        DB.foods2.push({ id: "cf_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: f.name, aliases: [], cat: f.cat || "other", grams: Math.max(1, Math.round(num(f.grams, 100))), kcal: r1(f.kcal), p: r1(f.p), c: r1(f.c), f: r1(f.f), fiber: r1(f.fiber), sugar: r1(f.sugar), sodium: r1(f.sodium), units: {}, src: "mine" });
      });
      DB.customFoods = [];
      try { save(); } catch (e) { }
    }
  }
  function yxKcal(d) { return DB.diet.filter(function (x) { return x.date === d; }).reduce(function (s, x) { return s + num(x.kcal); }, 0); }
  function yxMacro(d) {
    var m = { p: 0, c: 0, f: 0, fiber: 0, sugar: 0, sodium: 0 };
    DB.diet.filter(function (x) { return x.date === d; }).forEach(function (x) { m.p += num(x.p); m.c += num(x.c); m.f += num(x.fat); m.fiber += num(x.fiber); m.sugar += num(x.sugar); m.sodium += num(x.sodium); });
    return m;
  }
  function yxEx(d) { return (DB.exercise || []).filter(function (e) { return e.date === d; }).reduce(function (s, e) { return s + num(e.kcal); }, 0); }

  /* 索引 */
  var _idx = null;
  function packFoods() {
    var out = [];
    (window.YX_FOOD_PACK || []).forEach(function (t) { out.push({ name: t[0], kcal: num(t[1]), p: num(t[2]), c: num(t[3]), f: num(t[4]), fiber: num(t[5]), cat: t[6] || "other", units: t[7] || {}, aliases: t[8] || [], src: "pack" }); });
    return out;
  }
  function builtinFoods() {
    var out = [];
    (typeof FOODS !== "undefined" ? FOODS : []).forEach(function (a) { out.push({ name: a[0], kcal: num(a[1]), p: num(a[2]), c: num(a[3]), f: num(a[4]), fiber: num(a[5]), cat: "builtin", units: {}, aliases: [], src: "builtin" }); });
    return out;
  }
  function buildIndex(force) {
    if (_idx && !force) return _idx;
    var map = {}, arr = [];
    function add(f) { if (!f || !f.name || map[f.name]) return; map[f.name] = f; arr.push(f); }
    DB.foods2.forEach(add); builtinFoods().forEach(add); packFoods().forEach(add);
    _idx = { arr: arr, map: map };
    return _idx;
  }
  YX.index = function () { return buildIndex(); };
  function freqMap() {
    var m = {};
    DB.diet.forEach(function (d) { if (!d.name) return; var e = m[d.name] || (m[d.name] = { n: 0, grams: 0, kcal: 0 }); e.n++; if (d.grams) e.grams = d.grams; e.kcal = d.kcal; });
    return m;
  }
  function searchLocal(q) {
    var list = buildIndex().arr, freq = freqMap();
    if (q) {
      var qq = q.toLowerCase();
      list = list.filter(function (f) { return f.name.toLowerCase().indexOf(qq) >= 0 || (f.aliases || []).some(function (a) { return String(a).toLowerCase().indexOf(qq) >= 0; }); });
    }
    return list.slice().sort(function (a, b) {
      var fa = (freq[a.name] || {}).n || 0, fb = (freq[b.name] || {}).n || 0;
      if (fa !== fb) return fb - fa;
      if (q) { var ai = a.name.indexOf(q) === 0 ? 0 : 1, bi = b.name.indexOf(q) === 0 ? 0 : 1; if (ai !== bi) return ai - bi; }
      return a.name.localeCompare(b.name, "zh");
    });
  }
  var DEFAULT_UNITS = { "米饭": { "碗": 150 }, "粥": { "碗": 300 }, "面": { "碗": 250 }, "粉": { "碗": 250 }, "馒头": { "个": 100 }, "包子": { "个": 80 }, "饺子": { "个": 20 }, "鸡蛋": { "个": 50 }, "牛奶": { "盒": 250, "杯": 250 }, "酸奶": { "杯": 100 }, "豆浆": { "杯": 300 }, "苹果": { "个": 200 }, "香蕉": { "根": 120 }, "橙子": { "个": 150 }, "橘子": { "个": 100 }, "坚果": { "把": 25 }, "面包": { "片": 35 }, "吐司": { "片": 35 }, "油": { "勺": 10 }, "糖": { "勺": 10 }, "拿铁": { "杯": 350 }, "咖啡": { "杯": 350 }, "奶茶": { "杯": 500 }, "可乐": { "罐": 330 }, "啤酒": { "瓶": 500 } };
  function unitsFor(f) {
    var u = {};
    if (f.units) Object.keys(f.units).forEach(function (k) { u[k] = num(f.units[k]); });
    var mine = DB.units2[f.name];
    if (mine) Object.keys(mine).forEach(function (k) { u[k] = num(mine[k]); });
    Object.keys(DEFAULT_UNITS).forEach(function (kw) { if (f.name.indexOf(kw) >= 0) Object.keys(DEFAULT_UNITS[kw]).forEach(function (k) { if (!u[k]) u[k] = DEFAULT_UNITS[kw][k]; }); });
    u["克"] = 1;
    return u;
  }
  function parseUnits(s) {
    var o = {};
    String(s || "").split(/[,，;；]/).forEach(function (seg) { var p = seg.split(/[:：]/); if (p.length === 2 && p[0].trim() && num(p[1]) > 0) o[p[0].trim()] = num(p[1]); });
    return o;
  }

  /* 样式 */
  var CSS = [
    ".yx-tabs{display:flex;gap:6px;overflow-x:auto;margin:4px 0 10px;padding-bottom:2px;}",
    ".yx-tabs .t{flex:0 0 auto;font-size:13px;padding:7px 12px;border-radius:999px;background:var(--fill2);color:var(--text2);cursor:pointer;white-space:nowrap;}",
    ".yx-tabs .t.on{background:var(--green);color:#fff;font-weight:600;}",
    ".yx-pane{display:none;}.yx-pane.on{display:block;}",
    ".yx-quickrow{display:flex;gap:8px;overflow-x:auto;padding:2px 0 8px;}",
    ".yx-qchip{flex:0 0 auto;background:var(--ghost-bg);color:var(--green-d);border-radius:10px;padding:8px 12px;font-size:13px;cursor:pointer;line-height:1.3;}",
    ".yx-qchip b{display:block;font-size:11px;color:var(--sub);font-weight:500;}",
    ".yx-minirow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;}",
    ".yx-mini{background:var(--fill2);color:var(--text2);border:none;border-radius:10px;padding:8px 10px;font-size:12px;cursor:pointer;}",
    ".yx-badge{display:inline-block;font-size:10px;line-height:1.5;color:var(--green-d);background:var(--ghost-bg);border-radius:6px;padding:0 5px;margin-left:6px;}",
    ".yx-badge.net{color:var(--blue,#3b82f6);background:var(--info-bg,#eff6ff);}",
    ".yx-ico{border:none;background:var(--fill2);color:var(--text2);width:32px;height:32px;flex:0 0 32px;border-radius:9px;font-size:14px;cursor:pointer;}",
    ".yx-ico.danger{background:var(--danger-bg,#fef2f2);color:var(--red,#ef4444);}",
    ".yx-list{max-height:38vh;overflow:auto;}",
    ".yx-item{display:flex;align-items:center;gap:8px;padding:10px 2px;border-bottom:1px solid var(--line);}",
    ".yx-item .nm{font-size:14px;font-weight:600;}",
    ".yx-item .meta{font-size:12px;color:var(--sub);margin-top:2px;line-height:1.4;}",
    ".yx-item .info{flex:1;min-width:0;cursor:pointer;}",
    ".yx-units{display:flex;gap:8px;overflow-x:auto;margin-bottom:10px;}",
    ".yx-unit{flex:0 0 auto;font-size:13px;padding:7px 12px;border-radius:999px;background:var(--fill2);color:var(--text2);cursor:pointer;}",
    ".yx-unit.on{background:var(--green);color:#fff;font-weight:600;}",
    "#yxToast{position:fixed;left:50%;bottom:92px;transform:translate(-50%,14px);background:rgba(17,24,39,.95);color:#fff;font-size:13px;padding:10px 14px;border-radius:999px;opacity:0;pointer-events:none;transition:.22s;z-index:300;max-width:86%;display:flex;align-items:center;gap:10px;}",
    "#yxToast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto;}",
    "#yxToast button{border:none;background:transparent;color:#7ee2b8;font-weight:700;font-size:13px;cursor:pointer;}",
    ".yx-streak{background:var(--card);border-radius:16px;padding:12px 14px;margin-bottom:14px;box-shadow:var(--shadow);display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--text2);}",
    ".yx-streak b{color:var(--green-d);font-size:15px;}",
    ".cal-cell{position:relative;flex-direction:column;}",
    ".yx-dots{position:absolute;bottom:3px;left:0;right:0;display:flex;justify-content:center;gap:2px;}",
    ".yx-dot{width:4px;height:4px;border-radius:50%;display:inline-block;}",
    ".yx-insight{font-size:13.5px;line-height:1.9;color:var(--text2);}",
    ".yx-insight b{color:var(--green-d);}",
    ".yx-kv{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px dashed var(--line);}",
    ".yx-kv:last-child{border-bottom:none;}",
    ".yx-empty{text-align:center;color:var(--sub);padding:22px 0;font-size:13px;}"
  ].join("");
  function injectCSS() { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  /* 记一笔面板 */
  var CATOPTS = [["staple", "主食/谷物"], ["meat", "肉/蛋/水产"], ["dairy", "奶/豆制品"], ["veg", "蔬菜/菌菇"], ["fruit", "水果"], ["nut", "坚果/种子"], ["drink", "饮料"], ["snack", "零食/糕点"], ["fat", "油脂/调味"], ["other", "其他"]].map(function (c) { return '<option value="' + c[0] + '">' + c[1] + "</option>"; }).join("");
  var SHEET = [
    '<span class="close-x" onclick="closeSheet()">×</span>',
    '<h3 id="sheetTitle">记一笔</h3>',
    '<div class="row" style="margin-bottom:10px;overflow:auto;" id="yxMealRow">',
    ["breakfast", "lunch", "dinner", "snack"].map(function (m) { return '<span class="chip' + (m === "breakfast" ? " on" : "") + '" data-yxm="' + m + '" onclick="YX.meal(\'' + m + '\',this)">' + ml(m) + "</span>"; }).join(""),
    "</div>",
    '<div class="yx-tabs" id="yxTabs">',
    ['search:🔍 搜索', 'mine:🍱 我的', 'combo:🍽 套餐', 'custom:＋ 新建', 'scan:📷 扫码', 'ai:✨ AI估算'].map(function (s, i) { var p = s.split(":"); return '<span class="t' + (i === 0 ? " on" : "") + '" data-tab="' + p[0] + '" onclick="YX.go(\'' + p[0] + '\')">' + p[1] + "</span>"; }).join(""),
    "</div>",
    '<div class="yx-pane on" id="yxPaneSearch">',
    '<input class="search-box" id="yxSearch" placeholder="搜食物 / 别名，如 鸡胸、奶茶" oninput="YX.search()">',
    '<div class="yx-quickrow" id="yxQuick"></div>',
    '<div class="yx-list" id="yxResults"></div>',
    '<div class="yx-minirow"><button class="yx-mini" onclick="YX.netSearch()">🌐 联网搜包装食品</button><span class="sub" id="yxCount"></span></div>',
    "</div>",
    '<div class="yx-pane" id="yxPaneMine">',
    '<div class="yx-minirow" style="margin:0 0 8px;"><span class="sub" id="yxMineCount"></span><button class="yx-mini" onclick="YX.importPack()">📥 导入食物包</button></div>',
    '<div class="yx-list" id="yxMineList"></div>',
    "</div>",
    '<div class="yx-pane" id="yxPaneCombo">',
    '<div class="sub" style="margin:0 0 8px;">把一餐存成套餐，下次一键记完。</div>',
    '<button class="btn btn-ghost" style="width:100%;margin-bottom:10px;" onclick="YX.saveComboFromToday()">➕ 把当前餐次存为套餐</button>',
    '<div class="yx-list" id="yxComboList"></div>',
    "</div>",
    '<div class="yx-pane" id="yxPaneCustom">',
    '<div class="field"><label>食物名称</label><input id="cName" placeholder="如：自制番茄牛腩"></div>',
    '<div class="grid2"><div class="field"><label>别名（逗号分隔）</label><input id="cAlias" placeholder="牛腩,番茄炖牛肉"></div>',
    '<div class="field"><label>分类</label><select id="cCat">' + CATOPTS + "</select></div></div>",
    '<div class="row" style="margin-bottom:10px;"><span class="chip on" data-ck="total" onclick="YX.calMode(\'total\',this)">按这一份</span>',
    '<span class="chip" data-ck="per100" onclick="YX.calMode(\'per100\',this)">按每100g</span></div>',
    '<div class="grid2"><div class="field"><label>这一份分量(g)</label><input id="cGrams" type="number" value="100"></div>',
    '<div class="field"><label>热量(千卡)</label><input id="cKcal" type="number" placeholder="200"></div></div>',
    '<div class="grid2"><div class="field"><label>蛋白(g)</label><input id="cP" type="number"></div>',
    '<div class="field"><label>碳水(g)</label><input id="cC" type="number"></div>',
    '<div class="field"><label>脂肪(g)</label><input id="cF" type="number"></div>',
    '<div class="field"><label>纤维(g)</label><input id="cFiber" type="number"></div></div>',
    '<div class="grid2" id="cMicroWrap" style="display:none;">',
    '<div class="field"><label>糖(g)</label><input id="cSugar" type="number"></div>',
    '<div class="field"><label>钠(mg)</label><input id="cSod" type="number"></div></div>',
    '<div class="field"><label>常用分量（如：碗:150,小碗:100）</label><input id="cUnits" placeholder="碗:150"></div>',
    '<div class="grid2"><button class="btn btn-ghost" onclick="closeSheet()">取消</button>',
    '<button class="btn btn-primary" id="cSaveBtn" onclick="YX.saveFood(false)">保存并添加</button></div>',
    '<button class="btn btn-ghost" id="cOnlyBtn" style="width:100%;margin-top:8px;" onclick="YX.saveFood(true)">只保存到我的食物</button>',
    '<button class="btn btn-ghost" id="cDelBtn" style="width:100%;margin-top:8px;display:none;color:#ef4444;background:#fef2f2;" onclick="YX.delEditing()">删除这个食物</button>',
    "</div>",
    '<div class="yx-pane" id="yxPaneScan">',
    '<div class="sub" style="margin:0 0 8px;">扫包装食品条码取营养（Open Food Facts，国内条码覆盖有限）。</div>',
    '<div class="row" style="margin-bottom:10px;"><input class="search-box" id="yxCode" placeholder="条码，如 6901234567890" style="margin:0;">',
    '<button class="btn btn-ghost" style="width:auto;" onclick="YX.lookupCode()">查询</button></div>',
    '<button class="btn btn-ghost" style="width:100%;margin-bottom:10px;" onclick="YX.startScan()">📷 打开摄像头扫码</button>',
    '<video id="yxVideo" playsinline muted style="width:100%;border-radius:12px;display:none;background:#000;"></video>',
    '<div id="yxScanResult"></div>',
    "</div>",
    '<div class="yx-pane" id="yxPaneAi">',
    '<div class="sub" style="margin:0 0 8px;">一句话描述，AI 拆成食物清单（需先在「我的」填 API Key）。</div>',
    '<textarea id="yxAiText" placeholder="例：中午吃了半碗米饭、一份番茄炒蛋、一杯无糖拿铁" style="width:100%;min-height:76px;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--fill);color:var(--text);font-size:14px;"></textarea>',
    '<button class="btn btn-primary" style="margin:10px 0;" onclick="YX.aiEstimate()">✨ 智能识别</button>',
    '<div id="yxAiResult"></div>',
    "</div>",
    '<div class="yx-pane" id="yxPanePortion">',
    '<div id="yxPName" style="font-weight:700;font-size:16px;margin-bottom:2px;"></div>',
    '<div class="sub" id="yxPPer100" style="margin-bottom:10px;"></div>',
    '<div class="yx-units" id="yxUnits"></div>',
    '<div class="portion"><button class="step" onclick="YX.step(-10)">−</button>',
    '<input type="number" id="yxGrams" value="100" oninput="YX.preview()">',
    '<button class="step" onclick="YX.step(10)">＋</button></div>',
    '<div class="sub" style="text-align:center;" id="yxGramHint">克 (g)</div>',
    '<div class="macro-preview">',
    '<div><div class="v" id="yxK">0</div><div class="k">热量</div></div>',
    '<div><div class="v" id="yxP" style="color:#3b82f6">0g</div><div class="k">蛋白</div></div>',
    '<div><div class="v" id="yxC" style="color:#f59e0b">0g</div><div class="k">碳水</div></div>',
    '<div><div class="v" id="yxF" style="color:#ef4444">0g</div><div class="k">脂肪</div></div>',
    '<div><div class="v" id="yxFi" style="color:#84cc16">0g</div><div class="k">纤维</div></div>',
    "</div>",
    '<div class="sub" id="yxPMicro" style="margin-bottom:10px;"></div>',
    '<div class="grid2" style="margin-top:10px;"><button class="btn btn-ghost" onclick="YX.back()">返回</button>',
    '<button class="btn btn-primary" id="yxAddBtn" onclick="YX.confirmAdd()">添加到<span id="yxMealLabel">早餐</span></button></div>',
    '<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="YX.toCustomFromCur()">＋ 存为我的食物</button>',
    "</div>"
  ].join("");
  var cur = null, sheetMode = "log", planDate = "", customMode = "total", editingFood = null, netList = [];
  window._yxResults = [];
  function rebuildSheet() {
    var sh = document.querySelector("#modal .sheet"); if (!sh) return;
    sh.innerHTML = SHEET;
    YX.renderQuick(); YX.renderMine(); YX.renderCombo(); resetCustom();
  }
  function openSheetTo(tab, mode) {
    ensureData();
    sheetMode = mode || "log";
    document.getElementById("modal").classList.add("show");
    document.getElementById("sheetTitle").textContent = mode === "plan" ? "添加到菜单" : "记一笔";
    YX.go(tab || "search");
    var lab = $("#yxMealLabel"); if (lab) lab.textContent = ml(curMeal);
  }
  YX.openSheetTo = openSheetTo;
  window.openFoodSheet = function () { openSheetTo("search", "log"); };
  YX.sheetTab = function (name) {
    ["search", "mine", "combo", "custom", "scan", "ai", "portion"].forEach(function (n) {
      var p = $("#yxPane" + n.charAt(0).toUpperCase() + n.slice(1)); if (p) p.classList.toggle("on", n === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll("#yxTabs .t"), function (t) { t.classList.toggle("on", t.dataset.tab === name); });
    var tabs = $("#yxTabs"); if (tabs) tabs.style.display = name === "portion" ? "none" : "flex";
  };
  YX.go = function (name) {
    if (name === "mine") YX.renderMine();
    if (name === "combo") YX.renderCombo();
    if (name === "search") { YX.renderQuick(); YX.search(); }
    if (name === "custom") { var mw = $("#cMicroWrap"); if (mw) mw.style.display = DB.yx.micro ? "grid" : "none"; }
    YX.sheetTab(name);
  };
  YX.back = function () { YX.go("search"); };
  YX.meal = function (m, el) {
    curMeal = m;
    Array.prototype.forEach.call(document.querySelectorAll("#yxMealRow .chip"), function (c) { c.classList.toggle("on", c.dataset.yxm === m); });
    var lab = $("#yxMealLabel"); if (lab) lab.textContent = ml(m);
  };

  /* 搜索 */
  YX.renderQuick = function () {
    var el = $("#yxQuick"); if (!el) return;
    var fq = freqMap(), arr = [];
    Object.keys(fq).forEach(function (k) { arr.push({ name: k, n: fq[k].n, grams: fq[k].grams, kcal: fq[k].kcal }); });
    arr.sort(function (a, b) { return b.n - a.n; });
    var top = arr.slice(0, 8);
    if (!top.length) { el.innerHTML = '<span class="sub">常吃食物会出现在这里</span>'; return; }
    el.innerHTML = top.map(function (x) { return '<div class="yx-qchip" onclick="YX.quickAdd(\'' + escAttr(x.name) + '\')">' + escx(x.name) + "<b>" + (x.grams || 100) + "g · " + Math.round(x.kcal || 0) + "千卡</b></div>"; }).join("");
  };
  YX.quickAdd = function (name) {
    var f = buildIndex().map[name]; if (!f) return;
    var fq = freqMap()[name] || {}, g = Math.max(1, fq.grams || f.grams || 100);
    closeSheet();
    addToDiet({ name: f.name, grams: g, kcal: Math.round(num(f.kcal) * g / 100), p: r1(num(f.p) * g / 100), c: r1(num(f.c) * g / 100), f: r1(num(f.f) * g / 100), fiber: r1(num(f.fiber) * g / 100), sugar: r1(num(f.sugar) * g / 100), sodium: Math.round(num(f.sodium) * g / 100) }, today(viewDate), curMeal);
    renderAll();
  };
  YX.search = function () {
    var q = ($("#yxSearch") ? $("#yxSearch").value : "").trim();
    if (!q) YX.renderQuick();
    var list = q ? searchLocal(q) : searchLocal("").slice(0, 30);
    if (netList.length && q) list = list.concat(netList.filter(function (f) { return f.name.toLowerCase().indexOf(q.toLowerCase()) >= 0; }));
    renderResults(list, q ? list.length + " 项" : "常吃优先");
  };
  function renderResults(list, note) {
    var el = $("#yxResults"); if (!el) return;
    window._yxResults = list;
    var c = $("#yxCount"); if (c) c.textContent = note || list.length + " 项";
    if (!list.length) { el.innerHTML = '<div class="yx-empty">没找到 · 试试「新建」或「联网搜」</div>'; return; }
    el.innerHTML = list.slice(0, 150).map(function (f, i) {
      var b = f.src === "net" ? '<span class="yx-badge net">联网</span>' : (f.src === "mine" ? '<span class="yx-badge">我的</span>' : "");
      return '<div class="food-row" onclick="YX.pick(' + i + ')"><span>' + escx(f.name) + b + '</span><span class="kcal">' + fx(f.kcal) + "千卡 · 纤维" + fx(f.fiber) + "g</span></div>";
    }).join("");
  }
  YX.pick = function (i) {
    var f = window._yxResults[i]; if (!f) return;
    cur = { food: f, grams: f.grams || 100, unit: "克" };
    $("#yxPName").textContent = f.name;
    $("#yxPPer100").textContent = "每100g：" + fx(f.kcal) + "千卡 · 蛋白" + fx(f.p) + "g · 碳水" + fx(f.c) + "g · 脂肪" + fx(f.f) + "g · 纤维" + fx(f.fiber) + "g";
    var u = unitsFor(f); window._yxUnits = u;
    $("#yxUnits").innerHTML = Object.keys(u).map(function (k) { return '<span class="yx-unit' + (k === "克" ? " on" : "") + '" onclick="YX.unit(\'' + escAttr(k) + '\',this)">' + escx(k) + "</span>"; }).join("");
    $("#yxGrams").value = cur.grams;
    $("#yxMealLabel").textContent = ml(curMeal);
    YX.preview(); YX.sheetTab("portion");
  };
  YX.unit = function (k, el) {
    if (!cur) return;
    var g = (window._yxUnits || {})[k] || 100;
    cur.unit = k; cur.grams = g;
    $("#yxGrams").value = g;
    Array.prototype.forEach.call(document.querySelectorAll("#yxUnits .yx-unit"), function (x) { x.classList.remove("on"); });
    if (el) el.classList.add("on");
    $("#yxGramHint").textContent = k === "克" ? "克 (g)" : "1" + k + " ≈ " + g + "g";
    YX.preview();
  };
  YX.step = function (d) { var i = $("#yxGrams"); i.value = Math.max(1, num(i.value, 100) + d); YX.preview(); };
  YX.preview = function () {
    if (!cur) return;
    var f = cur.food, g = Math.max(1, num($("#yxGrams").value, 100));
    cur.grams = g;
    $("#yxK").textContent = Math.round(num(f.kcal) * g / 100);
    $("#yxP").textContent = r1(num(f.p) * g / 100) + "g";
    $("#yxC").textContent = r1(num(f.c) * g / 100) + "g";
    $("#yxF").textContent = r1(num(f.f) * g / 100) + "g";
    $("#yxFi").textContent = r1(num(f.fiber) * g / 100) + "g";
    var mic = $("#yxPMicro");
    if (DB.yx.micro && (num(f.sugar) || num(f.sodium))) mic.textContent = "糖 " + r1(num(f.sugar) * g / 100) + "g · 钠 " + Math.round(num(f.sodium) * g / 100) + "mg";
    else mic.textContent = "";
  };
  function addToDiet(item, date, meal) {
    DB.diet.push({ id: Date.now() + Math.random(), date: date, meal: meal, name: item.name, kcal: Math.round(num(item.kcal)), p: r1(item.p), c: r1(item.c), fat: r1(item.f), fiber: r1(item.fiber), grams: num(item.grams), sugar: r1(item.sugar), sodium: Math.round(num(item.sodium)) });
    save();
    var id = DB.diet[DB.diet.length - 1].id;
    toastx("已记入" + ml(meal) + "：" + item.name, { label: "撤销", fn: function () { DB.diet = DB.diet.filter(function (x) { return x.id !== id; }); save(); renderAll(); } });
  }
  YX.confirmAdd = function () {
    if (!cur) return;
    var f = cur.food, g = Math.max(1, num($("#yxGrams").value, 100));
    var item = { name: f.name, grams: g, kcal: Math.round(num(f.kcal) * g / 100), p: r1(num(f.p) * g / 100), c: r1(num(f.c) * g / 100), f: r1(num(f.f) * g / 100), fiber: r1(num(f.fiber) * g / 100), sugar: r1(num(f.sugar) * g / 100), sodium: Math.round(num(f.sodium) * g / 100) };
    if (sheetMode === "plan") { addToPlan(item); closeSheet(); YX.renderPlan(); toastx("已加入 " + planDate + " 菜单"); return; }
    closeSheet(); addToDiet(item, today(viewDate), curMeal); renderAll();
  };

  /* 我的食物 */
  YX.renderMine = function () {
    var el = $("#yxMineList"); if (!el) return;
    var n = (DB.foods2 || []).length, c = $("#yxMineCount");
    if (c) c.textContent = "共 " + n + " 项，点一行可编辑";
    if (!n) { el.innerHTML = '<div class="yx-empty">还没有自定义食物<br>切到「＋ 新建」添加</div>'; return; }
    el.innerHTML = DB.foods2.map(function (f, i) {
      return '<div class="yx-item"><div class="info" onclick="YX.editFood(' + i + ')"><div class="nm">' + escx(f.name) + "</div>" +
        '<div class="meta">每100g ' + fx(f.kcal) + "千卡 · 蛋白" + fx(f.p) + "g · 碳水" + fx(f.c) + "g · 脂肪" + fx(f.f) + "g · 纤维" + fx(f.fiber) + "g</div>" +
        '<div class="meta">常用 ' + num(f.grams, 100) + "g ≈ " + Math.round(num(f.kcal) * num(f.grams, 100) / 100) + "千卡</div></div>" +
        '<button class="yx-ico" onclick="YX.editFood(' + i + ')">✎</button>' +
        '<button class="yx-ico danger" onclick="YX.delFood(' + i + ')">🗑</button></div>';
    }).join("");
  };
  function resetCustom() {
    editingFood = null; customMode = "total";
    ["cName", "cAlias", "cKcal", "cP", "cC", "cF", "cFiber", "cSugar", "cSod", "cUnits"].forEach(function (id) { var e = $("#" + id); if (e) e.value = ""; });
    var g = $("#cGrams"); if (g) g.value = 100;
    var cat = $("#cCat"); if (cat) cat.value = "other";
    Array.prototype.forEach.call(document.querySelectorAll("#yxPaneCustom [data-ck]"), function (c) { c.classList.toggle("on", c.dataset.ck === "total"); });
    var b = $("#cSaveBtn"); if (b) b.textContent = "保存并添加";
    var o = $("#cOnlyBtn"); if (o) o.style.display = "";
    var d = $("#cDelBtn"); if (d) d.style.display = "none";
    var mw = $("#cMicroWrap"); if (mw) mw.style.display = DB.yx && DB.yx.micro ? "grid" : "none";
  }
  YX.resetCustom = resetCustom;
  YX.calMode = function (m, el) {
    customMode = m;
    Array.prototype.forEach.call(document.querySelectorAll("#yxPaneCustom [data-ck]"), function (c) { c.classList.remove("on"); });
    if (el) el.classList.add("on");
  };
  YX.editFood = function (i) {
    var f = DB.foods2[i]; if (!f) return;
    editingFood = f; customMode = "per100";
    $("#cName").value = f.name || ""; $("#cAlias").value = (f.aliases || []).join(",");
    $("#cCat").value = f.cat || "other"; $("#cGrams").value = num(f.grams, 100);
    $("#cKcal").value = r1(f.kcal); $("#cP").value = r1(f.p); $("#cC").value = r1(f.c);
    $("#cF").value = r1(f.f); $("#cFiber").value = r1(f.fiber);
    $("#cSugar").value = r1(f.sugar); $("#cSod").value = num(f.sodium);
    $("#cUnits").value = Object.keys(f.units || {}).map(function (k) { return k + ":" + f.units[k]; }).join(",");
    Array.prototype.forEach.call(document.querySelectorAll("#yxPaneCustom [data-ck]"), function (c) { c.classList.toggle("on", c.dataset.ck === "per100"); });
    $("#cSaveBtn").textContent = "保存修改"; $("#cOnlyBtn").style.display = "none"; $("#cDelBtn").style.display = "block";
    YX.go("custom");
  };
  YX.toCustomFromCur = function () {
    if (!cur) return;
    var f = cur.food, g = Math.max(1, num($("#yxGrams").value, 100));
    editingFood = null; customMode = "total";
    $("#cName").value = f.name; $("#cAlias").value = (f.aliases || []).join(",");
    $("#cCat").value = (f.cat === "builtin" || f.cat === "pack") ? "other" : (f.cat || "other");
    $("#cGrams").value = g; $("#cKcal").value = Math.round(num(f.kcal) * g / 100);
    $("#cP").value = r1(num(f.p) * g / 100); $("#cC").value = r1(num(f.c) * g / 100);
    $("#cF").value = r1(num(f.f) * g / 100); $("#cFiber").value = r1(num(f.fiber) * g / 100);
    $("#cSugar").value = r1(num(f.sugar) * g / 100); $("#cSod").value = Math.round(num(f.sodium) * g / 100);
    $("#cUnits").value = "";
    Array.prototype.forEach.call(document.querySelectorAll("#yxPaneCustom [data-ck]"), function (c) { c.classList.toggle("on", c.dataset.ck === "total"); });
    $("#cSaveBtn").textContent = "保存并添加"; $("#cOnlyBtn").style.display = ""; $("#cDelBtn").style.display = "none";
    YX.go("custom");
  };
  YX.saveFood = function (only) {
    var name = $("#cName").value.trim();
    if (!name) { toastx("请输入食物名称"); return; }
    var grams = Math.max(1, num($("#cGrams").value, 100));
    var tK = num($("#cKcal").value);
    if (customMode === "per100") tK = tK * grams / 100;
    var p = num($("#cP").value), c = num($("#cC").value), f = num($("#cF").value), fib = num($("#cFiber").value);
    var sug = num($("#cSugar").value), sod = num($("#cSod").value);
    if (!tK && !p && !c && !f) { toastx("至少填热量或一个营养素"); return; }
    function per(v) { return r1(v / grams * 100); }
    var item = {
      id: (editingFood && editingFood.id) || ("cf_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4)),
      name: name, aliases: $("#cAlias").value.split(/[,，\s]+/).filter(Boolean).slice(0, 6),
      cat: $("#cCat").value, grams: Math.round(grams), kcal: per(tK), p: per(p), c: per(c), f: per(f), fiber: per(fib),
      sugar: per(sug), sodium: Math.round(sod / grams * 100), units: parseUnits($("#cUnits").value), src: "mine", updatedAt: Date.now()
    };
    var dup = DB.foods2.filter(function (x) { return x.name === name && x !== editingFood; })[0];
    if (dup) { if (!confirm("「" + name + "」已存在，用新数据覆盖？")) return; DB.foods2 = DB.foods2.filter(function (x) { return x !== dup; }); }
    if (editingFood) DB.foods2 = DB.foods2.filter(function (x) { return x !== editingFood; });
    DB.foods2.unshift(item); save(); buildIndex(true); resetCustom();
    if (only) { toastx("已保存「" + name + "」到我的食物"); YX.renderMine(); YX.renderQuick(); renderAll(); YX.go("mine"); return; }
    closeSheet();
    addToDiet({ name: name, grams: grams, kcal: Math.round(tK), p: r1(p), c: r1(c), f: r1(f), fiber: r1(fib), sugar: r1(sug), sodium: Math.round(sod) }, today(viewDate), curMeal);
    renderAll();
  };
  YX.delFood = function (i) {
    var f = DB.foods2[i]; if (!f) return;
    if (!confirm("删除「" + f.name + "」？已记录的历史不受影响。")) return;
    DB.foods2.splice(i, 1); save(); buildIndex(true); YX.renderMine(); renderAll();
    toastx("已删除「" + f.name + "」", { label: "撤销", fn: function () { DB.foods2.splice(i, 0, f); save(); buildIndex(true); renderAll(); if ($("#yxPaneMine").classList.contains("on")) YX.renderMine(); } });
  };
  YX.delEditing = function () {
    if (!editingFood) return;
    var f = editingFood;
    if (!confirm("删除「" + f.name + "」？")) return;
    DB.foods2 = DB.foods2.filter(function (x) { return x !== f; });
    save(); buildIndex(true); resetCustom(); closeSheet(); renderAll(); toastx("已删除");
  };

  /* 套餐 */
  YX.renderCombo = function () {
    var el = $("#yxComboList"); if (!el) return;
    if (!DB.meals2.length) { el.innerHTML = '<div class="yx-empty">还没有套餐</div>'; return; }
    el.innerHTML = DB.meals2.map(function (c, i) {
      var k = c.items.reduce(function (s, x) { return s + num(x.kcal); }, 0);
      return '<div class="yx-item"><div class="info" onclick="YX.addCombo(' + i + ')"><div class="nm">' + escx(c.name) + "</div>" +
        '<div class="meta">' + c.items.length + " 项 · 合计 " + Math.round(k) + " 千卡</div></div>" +
        '<button class="yx-ico danger" onclick="YX.delCombo(' + i + ')">🗑</button></div>';
    }).join("");
  };
  YX.saveComboFromToday = function () {
    var date = today(viewDate);
    var items = DB.diet.filter(function (d) { return d.date === date && d.meal === curMeal; });
    if (!items.length) { toastx("这个餐次今天还没有记录"); return; }
    var nm = prompt("套餐名称", ml(curMeal) + "套餐");
    if (!nm) return;
    DB.meals2.unshift({ id: Date.now(), name: nm.trim(), items: items.map(function (d) { return { name: d.name, grams: num(d.grams), kcal: num(d.kcal), p: num(d.p), c: num(d.c), f: num(d.fat), fiber: num(d.fiber) }; }) });
    save(); YX.renderCombo(); toastx("已保存套餐「" + nm + "」");
  };
  YX.addCombo = function (i) {
    var c = DB.meals2[i]; if (!c) return;
    if (sheetMode === "plan") { c.items.forEach(function (x) { addToPlan({ name: x.name, grams: num(x.grams), kcal: num(x.kcal), p: num(x.p), c: num(x.c), f: num(x.f), fiber: num(x.fiber) }); }); closeSheet(); YX.renderPlan(); toastx("套餐已加入菜单"); return; }
    var date = today(viewDate);
    c.items.forEach(function (x) { DB.diet.push({ id: Date.now() + Math.random(), date: date, meal: curMeal, name: x.name, kcal: Math.round(num(x.kcal)), p: r1(x.p), c: r1(x.c), fat: r1(x.f), fiber: r1(x.fiber), grams: num(x.grams) }); });
    save(); closeSheet(); renderAll(); toastx("已记入「" + c.name + "」共 " + c.items.length + " 项");
  };
  YX.delCombo = function (i) {
    var c = DB.meals2[i]; if (!c) return;
    if (!confirm("删除套餐「" + c.name + "」？")) return;
    DB.meals2.splice(i, 1); save(); YX.renderCombo();
  };

  /* 联网 / 扫码 */
  var OFF = "https://world.openfoodfacts.org";
  function offFood(p) {
    var n = p.nutriments || {}, k = num(n["energy-kcal_100g"]) || num(n["energy_100g"]) / 4.184;
    return { name: (p.product_name_zh || p.product_name || "未知商品") + (p.brands ? " · " + p.brands : ""), kcal: Math.round(k), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g), fiber: r1(n.fiber_100g), sugar: r1(n.sugars_100g), sodium: Math.round(num(n.sodium_100g) * 1000), cat: "other", units: {}, aliases: [], src: "net" };
  }
  YX.netSearch = function () {
    if (!DB.yx.online) { toastx("已在「我的」关闭联网搜索"); return; }
    var q = ($("#yxSearch").value || "").trim();
    if (!q) { toastx("先输入食物名"); return; }
    toastx("联网搜索中…");
    fetch(OFF + "/cgi/search.pl?search_terms=" + encodeURIComponent(q) + "&search_simple=1&action=process&json=1&page_size=20&fields=product_name,product_name_zh,brands,nutriments")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var arr = (j.products || []).map(offFood).filter(function (f) { return f.name !== "未知商品" && f.kcal > 0; });
        if (!arr.length) { toastx("没搜到，改用「新建」或「扫码」"); return; }
        netList = arr; renderResults(arr, "联网 " + arr.length + " 项"); toastx("联网结果已加入列表");
      }).catch(function () { toastx("联网失败（跨域/网络限制），改用扫码或新建"); });
  };
  YX.lookupCode = function () { lookupCode(String($("#yxCode").value || "").replace(/\D/g, "")); };
  function lookupCode(code) {
    if (!code) { toastx("请输入条码"); return; }
    if (!DB.yx.online) { toastx("已在「我的」关闭联网搜索"); return; }
    toastx("查询中…");
    fetch(OFF + "/api/v2/product/" + code + ".json?fields=product_name,product_name_zh,brands,nutriments")
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.status !== 1 || !j.product) { $("#yxScanResult").innerHTML = '<div class="yx-empty">没有这个条码的数据<br>可手动「新建」食物</div>'; return; }
        var f = offFood(j.product); window._yxScanFood = f;
        $("#yxScanResult").innerHTML = '<div class="summary-box"><b>' + escx(f.name) + "</b><br>每100g：" + f.kcal + "千卡 · 蛋白" + f.p + "g · 碳水" + f.c + "g · 脂肪" + f.f + "g</div>" +
          '<div class="grid2" style="margin-top:10px;"><button class="btn btn-ghost" onclick="YX.scanPick(false)">按份量记录</button>' +
          '<button class="btn btn-ghost" onclick="YX.scanPick(true)">存为我的食物</button></div>';
      }).catch(function () { toastx("查询失败，请检查网络"); });
  }
  YX.scanPick = function (saveIt) {
    var f = window._yxScanFood; if (!f) return;
    if (saveIt) {
      DB.foods2.unshift({ id: "cf_" + Date.now().toString(36), name: f.name, aliases: [], cat: "other", grams: 100, kcal: f.kcal, p: f.p, c: f.c, f: f.f, fiber: f.fiber, sugar: f.sugar, sodium: f.sodium, units: {}, src: "mine", updatedAt: Date.now() });
      save(); buildIndex(true); YX.renderMine(); toastx("已存入我的食物"); return;
    }
    cur = { food: f, grams: 100, unit: "克" };
    $("#yxPName").textContent = f.name;
    $("#yxPPer100").textContent = "每100g：" + fx(f.kcal) + "千卡 · 蛋白" + fx(f.p) + "g · 碳水" + fx(f.c) + "g";
    window._yxUnits = { "克": 1 };
    $("#yxUnits").innerHTML = '<span class="yx-unit on">克</span>';
    $("#yxGrams").value = 100;
    YX.preview(); YX.sheetTab("portion");
  };
  YX.startScan = function () {
    if (!("BarcodeDetector" in window)) { toastx("此浏览器不支持扫码，请手动输入条码"); return; }
    if (!navigator.mediaDevices) { toastx("无法访问摄像头（需 HTTPS）"); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
      var v = $("#yxVideo"); v.style.display = "block"; v.srcObject = stream; v.play().catch(function () { });
      var det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      var timer = setInterval(function () {
        det.detect(v).then(function (codes) {
          if (!codes || !codes.length) return;
          clearInterval(timer);
          stream.getTracks().forEach(function (t) { t.stop(); });
          v.srcObject = null; v.style.display = "none";
          $("#yxCode").value = codes[0].rawValue;
          lookupCode(codes[0].rawValue);
        }).catch(function () { });
      }, 400);
      setTimeout(function () { clearInterval(timer); }, 30000);
    }).catch(function (e) { toastx("摄像头不可用：" + (e.message || e.name)); });
  };

  /* AI 估算 */
  YX.aiEstimate = function () {
    var txt = ($("#yxAiText").value || "").trim();
    if (!txt) { toastx("先描述你吃了什么"); return; }
    var cfg = DB.ai || {};
    if (!cfg.apiKey) { toastx("请先在「我的」页填 API Key"); return; }
    var base = String(cfg.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "");
    $("#yxAiResult").innerHTML = '<div class="yx-empty">正在识别…</div>';
    fetch(base + "/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || "deepseek-chat", temperature: 0.2,
        messages: [
          { role: "system", content: '你是营养数据库。用户描述吃了什么，你只输出 JSON 数组，不要解释、不要代码块标记。格式:[{"name":"食物名","grams":克数,"kcal":热量,"p":蛋白克,"c":碳水克,"f":脂肪克,"fiber":纤维克}]。按中式常见做法估算，克数给常人一份的合理值。' },
          { role: "user", content: txt }
        ]
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message || "接口错误");
      var s = (j.choices && j.choices[0] && j.choices[0].message.content) || "";
      var m = s.match(/\[[\s\S]*\]/);
      if (!m) throw new Error("返回格式无法解析");
      var arr = JSON.parse(m[0]).filter(function (x) { return x && x.name; });
      if (!arr.length) throw new Error("没识别出食物");
      window._yxAiFoods = arr;
      $("#yxAiResult").innerHTML = arr.map(function (x) {
        return '<div class="yx-item"><div class="info"><div class="nm">' + escx(x.name) + "</div>" +
          '<div class="meta">' + Math.round(num(x.grams, 100)) + "g · " + Math.round(num(x.kcal)) + "千卡 · 蛋白" + r1(x.p) + "g · 碳水" + r1(x.c) + "g · 脂肪" + r1(x.f) + "g</div></div></div>";
      }).join("") + '<button class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="YX.aiCommit()">全部记入 ' + ml(curMeal) + "</button>";
    }).catch(function (e) { $("#yxAiResult").innerHTML = '<div class="yx-empty">识别失败：' + escx(e.message) + "</div>"; });
  };
  YX.aiCommit = function () {
    var arr = window._yxAiFoods || []; if (!arr.length) return;
    var date = today(viewDate);
    arr.forEach(function (x) { DB.diet.push({ id: Date.now() + Math.random(), date: date, meal: curMeal, name: x.name, kcal: Math.round(num(x.kcal)), p: r1(x.p), c: r1(x.c), fat: r1(x.f), fiber: r1(x.fiber), grams: Math.round(num(x.grams, 100)) }); });
    save(); closeSheet(); renderAll(); toastx("已记入 " + arr.length + " 项到" + ml(curMeal));
  };

  /* 食物包导入 */
  YX.importPack = function () {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var data = JSON.parse(rd.result);
          var arr = Array.isArray(data) ? data : (data.foods || data.YX_FOOD_PACK || []);
          if (!Array.isArray(arr)) throw new Error("格式不对");
          var added = 0;
          arr.forEach(function (it) {
            if (Array.isArray(it)) {
              if (!it[0] || DB.foods2.some(function (x) { return x.name === it[0]; })) return;
              DB.foods2.push({ id: "cf_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: String(it[0]), aliases: it[8] || [], cat: it[6] || "other", grams: Object.keys(it[7] || {}).length ? num(Object.values(it[7])[0], 100) : 100, kcal: r1(it[1]), p: r1(it[2]), c: r1(it[3]), f: r1(it[4]), fiber: r1(it[5]), units: it[7] || {}, src: "mine" });
              added++;
            } else if (it && it.name && !DB.foods2.some(function (x) { return x.name === it.name; })) {
              DB.foods2.push({ id: "cf_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: it.name, aliases: it.aliases || [], cat: it.cat || "other", grams: num(it.grams, 100), kcal: r1(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), fiber: r1(it.fiber), sugar: r1(it.sugar), sodium: num(it.sodium), units: it.units || {}, src: "mine" });
              added++;
            }
          });
          save(); buildIndex(true); renderAll(); YX.renderMine(); YX.renderQuick();
          alert("导入完成，新增 " + added + " 条食物");
        } catch (err) { alert("导入失败：" + err.message); }
      };
      rd.readAsText(f);
    };
    inp.click();
  };

  /* 饮食计划 */
  function addToPlan(item) {
    DB.mealPlan[planDate] = DB.mealPlan[planDate] || {};
    DB.mealPlan[planDate][curMeal] = DB.mealPlan[planDate][curMeal] || [];
    DB.mealPlan[planDate][curMeal].push(item);
    save();
  }
  YX.openPlan = function () {
    ensureData();
    if (!DB.yx.planDate) DB.yx.planDate = today(new Date(Date.now() + 86400000));
    planDate = DB.yx.planDate;
    var m = $("#yxPlanModal");
    if (!m) { m = document.createElement("div"); m.id = "yxPlanModal"; m.className = "modal"; document.body.appendChild(m); }
    m.innerHTML = '<div class="sheet"><span class="close-x" onclick="YX.closePlan()">×</span><h3>📅 饮食计划</h3>' +
      '<div class="field"><label>计划日期</label><input type="date" id="yxPlanDate" value="' + planDate + '" onchange="YX.planDateChange(this.value)"></div>' +
      '<div id="yxPlanBody"></div>' +
      '<div class="grid2" style="margin-top:10px;"><button class="btn btn-ghost" onclick="YX.planAdd()">＋ 添加食物</button>' +
      '<button class="btn btn-primary" onclick="YX.planCommit()">一键入账</button></div>' +
      '<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="YX.shopping()">🛒 生成购物清单</button>' +
      '<button class="btn btn-ghost" style="width:100%;margin-top:8px;color:#ef4444;background:#fef2f2;" onclick="YX.planClear()">清空该日计划</button></div>';
    m.classList.add("show");
    YX.renderPlan();
  };
  YX.closePlan = function () { var m = $("#yxPlanModal"); if (m) m.classList.remove("show"); };
  YX.planDateChange = function (v) { planDate = v || planDate; DB.yx.planDate = planDate; save(); YX.renderPlan(); };
  YX.renderPlan = function () {
    var el = $("#yxPlanBody"); if (!el) return;
    var plan = DB.mealPlan[planDate] || {};
    var keys = Object.keys(plan).filter(function (k) { return (plan[k] || []).length; });
    if (!keys.length) { el.innerHTML = '<div class="yx-empty">该日还没有计划</div>'; return; }
    var total = 0;
    el.innerHTML = keys.map(function (k) {
      var items = plan[k], kk = items.reduce(function (s, x) { return s + num(x.kcal); }, 0);
      total += kk;
      return '<div style="margin-top:10px;"><b>' + ml(k) + '</b> <span class="sub">' + Math.round(kk) + " 千卡</span></div>" +
        items.map(function (x, i) {
          return '<div class="yx-item"><div class="info"><div class="nm">' + escx(x.name) + "</div>" +
            '<div class="meta">' + num(x.grams) + "g · " + Math.round(num(x.kcal)) + "千卡</div></div>" +
            '<button class="yx-ico danger" onclick="YX.planDel(\'' + k + '\',' + i + ')">🗑</button></div>';
        }).join("");
    }).join("") + '<div class="summary-box" style="margin-top:10px;">合计 <b>' + Math.round(total) + " 千卡</b>（目标 " + DB.settings.goalKcal + "）</div>";
  };
  YX.planAdd = function () { openSheetTo("search", "plan"); };
  YX.planDel = function (meal, i) { try { DB.mealPlan[planDate][meal].splice(i, 1); save(); YX.renderPlan(); } catch (e) { } };
  YX.planClear = function () {
    if (!confirm("清空 " + planDate + " 的计划？")) return;
    DB.mealPlan[planDate] = {}; save(); YX.renderPlan();
  };
  YX.planCommit = function () {
    var plan = DB.mealPlan[planDate] || {}, n = 0;
    Object.keys(plan).forEach(function (meal) {
      (plan[meal] || []).forEach(function (x) {
        DB.diet.push({ id: Date.now() + Math.random(), date: planDate, meal: meal, name: x.name, kcal: Math.round(num(x.kcal)), p: r1(x.p), c: r1(x.c), fat: r1(x.f), fiber: r1(x.fiber), grams: num(x.grams) });
        n++;
      });
    });
    if (!n) { toastx("该日没有计划"); return; }
    DB.mealPlan[planDate] = {}; save(); YX.closePlan(); renderAll(); toastx("已把 " + n + " 项入账到 " + planDate);
  };
  YX.shopping = function () {
    var plan = DB.mealPlan[planDate] || {}, agg = {};
    Object.keys(plan).forEach(function (mk) { (plan[mk] || []).forEach(function (it) { agg[it.name] = agg[it.name] || { g: 0 }; agg[it.name].g += num(it.grams); }); });
    var names = Object.keys(agg);
    if (!names.length) { toastx("该日还没有计划"); return; }
    var txt = names.map(function (n) { return "· " + n + "  " + Math.round(agg[n].g) + "g"; }).join("\n");
    var m = document.createElement("div");
    m.className = "modal show";
    m.innerHTML = '<div class="sheet"><span class="close-x" onclick="this.closest(\'.modal\').remove()">×</span><h3>🛒 购物清单</h3>' +
      '<div class="summary-box" style="white-space:pre-wrap;">' + escx(txt) + "</div>" +
      '<button class="btn btn-ghost" style="width:100%;margin-top:10px;" onclick="YX.copy(\'' + encodeURIComponent(txt) + '\')">复制清单</button></div>';
    document.body.appendChild(m);
  };
  YX.copy = function (t) {
    var s = decodeURIComponent(t);
    if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { toastx("已复制"); }, function () { toastx("复制失败"); });
    else toastx("请长按手动复制");
  };

  /* 断食 */
  window.startFast = function () { DB.fasting.start = Date.now(); save(); renderAll(); toastx("开始断食！" + DB.fasting.plan + " 小时倒计时"); };
  window.endFast = function () {
    var st = DB.fasting.start, mins = 0;
    if (st) {
      mins = Math.round((Date.now() - st) / 60000);
      if (mins >= 30) {
        DB.fastHistory.push({ start: st, end: Date.now(), mins: mins, plan: DB.fasting.plan });
        if (DB.fastHistory.length > 500) DB.fastHistory = DB.fastHistory.slice(-500);
      }
    }
    DB.fasting.start = null; save(); renderAll();
    if (mins >= 30) toastx("记录一轮断食 " + Math.floor(mins / 60) + " 小时 " + (mins % 60) + " 分");
  };
  YX.fastHistory = function () {
    var h = (DB.fastHistory || []).slice().reverse(), total = h.reduce(function (s, x) { return s + num(x.mins); }, 0);
    var m = document.createElement("div");
    m.className = "modal show";
    m.innerHTML = '<div class="sheet"><span class="close-x" onclick="this.closest(\'.modal\').remove()">×</span><h3>⏱ 断食历史</h3>' +
      '<div class="summary-box">共 <b>' + h.length + "</b> 轮 · 累计 " + Math.floor(total / 60) + " 小时 " + (total % 60) + " 分</div>" +
      (h.length ? h.slice(0, 30).map(function (x) {
        var d = new Date(x.start);
        return '<div class="yx-kv"><span>' + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + "</span><span>" + Math.floor(x.mins / 60) + "h" + (x.mins % 60) + "m</span></div>";
      }).join("") : '<div class="yx-empty">还没有记录</div>') + "</div>";
    document.body.appendChild(m);
  };

  /* 首页包装 */
  function renderStreakBasic() {
    var el = $("#yxStreak"); if (!el) return;
    var n = 0, d = new Date();
    if (!DB.diet.some(function (x) { return x.date === today(d); })) d = new Date(Date.now() - 86400000);
    while (n < 3650) { var ds = today(d); if (!DB.diet.some(function (x) { return x.date === ds; })) break; n++; d = new Date(d.getTime() - 86400000); }
    el.innerHTML = "🔥 连续记录 <b>" + n + "</b> 天";
  }
  function renderFastStage() {
    var el = document.getElementById("fastStatus"); if (!el) return;
    var f = DB.fasting; if (!f || !f.start) return;
    var h = (Date.now() - f.start) / 3600000, st = "";
    if (h >= 18) st = "🔋 脂肪供能为主（18h+）";
    else if (h >= 16) st = "💪 酮体上升（16h+）";
    else if (h >= 12) st = "🔥 进入燃脂期（12h+）";
    if (st && el.textContent.indexOf(st) < 0) el.textContent += " · " + st;
  }

  /* 覆盖原全局 */
  function overrideGlobals() {
    var _rt = window.renderToday;
    window.renderToday = function () {
      try { _rt.apply(this, arguments); } catch (e) { console.error(e); }
      try {
        var s = DB.settings, t = today(), k = yxKcal(t), ex = yxEx(t);
        var left = document.getElementById("kcalLeft"); if (left) left.textContent = Math.max(0, num(s.goalKcal) + ex - k);
        var net = document.getElementById("netKcal"); if (net) net.textContent = Math.max(0, k - ex);
        var burn = document.getElementById("burnShow");
        if (burn && typeof calcBMR === "function") burn.textContent = " · 基础" + Math.round(calcBMR() * 1.2) + " + 运动" + ex;
        renderStreakBasic(); renderFastStage();
      } catch (e) { console.error(e); }
    };
    var _rd = window.renderDiet;
    if (_rd) window.renderDiet = function () { try { _rd.apply(this, arguments); } catch (e) { } try { renderRecentChips(); } catch (e) { } };
    var _rf = window.renderFast;
    if (_rf) window.renderFast = function () { try { _rf.apply(this, arguments); } catch (e) { } try { renderFastStage(); } catch (e) { } };
    var _ra = window.renderAll;
    window.renderAll = function () {
      try { _ra.apply(this, arguments); } catch (e) { console.error(e); }
      try { refreshAll(); } catch (e) { console.error(e); }
    };
    window.openMyFoods = function () { openSheetTo("mine", "log"); };
    window.openCustomFromMine = function () { openSheetTo("custom", "log"); };
  }

  /* UI 注入 */
  function injectTodayBar() {
    var p = document.getElementById("todayDate");
    if (p && !document.getElementById("yxStreak")) p.insertAdjacentHTML("afterend", '<div class="yx-streak" id="yxStreak"></div>');
  }
  function injectDiet() {
    var mEl = document.getElementById("mealList");
    if (mEl && !document.getElementById("yxRecentCard")) {
      mEl.insertAdjacentHTML("beforebegin", '<div class="card" id="yxRecentCard"><div class="row"><h2>⚡ 快速记录</h2><span class="sub">常吃一点即记</span></div><div class="yx-quickrow" id="yxRecentChips" style="margin-top:10px;"></div></div>');
    }
    var btn = document.querySelector('#view-diet [onclick="openRecipes()"]');
    if (btn && !document.getElementById("yxPlanBtn")) btn.insertAdjacentHTML("afterend", '<button class="btn btn-ghost" id="yxPlanBtn" style="width:100%;margin-bottom:14px;" onclick="YX.openPlan()">📅 饮食计划 / 购物清单</button>');
  }
  function renderRecentChips() {
    var el = $("#yxRecentChips"); if (!el) return;
    var fq = freqMap(), arr = Object.keys(fq).map(function (k) { return { n: k, c: fq[k].n, g: fq[k].grams, kc: fq[k].kcal }; });
    arr.sort(function (a, b) { return b.c - a.c; });
    if (!arr.length) { el.innerHTML = '<span class="sub">记几笔后这里会出现你的常吃</span>'; return; }
    el.innerHTML = arr.slice(0, 10).map(function (x) { return '<div class="yx-qchip" onclick="YX.quickAdd(\'' + escAttr(x.n) + '\')">' + escx(x.n) + "<b>" + (x.g || 100) + "g · " + Math.round(x.kc || 0) + "千卡</b></div>"; }).join("");
  }
  function injectMine() {
    var view = document.getElementById("view-mine"); if (!view || document.getElementById("yxLibCard")) return;
    var h1 = view.querySelector("h1");
    h1.insertAdjacentHTML("afterend",
      '<div class="card" id="yxLibCard"><div class="row"><h2>🍱 食物库</h2><span class="sub" id="yxLibCount"></span></div>' +
      '<p class="sub" style="margin:8px 0 12px;">内置食物 + 扩充包 + 我的自定义，可联网查包装食品。</p>' +
      '<div class="grid2"><button class="btn btn-ghost" onclick="YX.openSheetTo(\'mine\')">管理我的食物</button>' +
      '<button class="btn btn-ghost" onclick="YX.importPack()">导入食物包</button></div>' +
      '<div class="row" style="margin-top:14px;"><span style="font-size:14px;">启用联网搜索</span><label class="switch"><input type="checkbox" id="yxOnline" onchange="YX.toggleOnline(this.checked)"><span class="slider"></span></label></div>' +
      '<div class="row" style="margin-top:8px;"><span style="font-size:14px;">显示糖 / 钠</span><label class="switch"><input type="checkbox" id="yxMicro" onchange="YX.toggleMicro(this.checked)"><span class="slider"></span></label></div>' +
      '<button class="btn btn-ghost" style="width:100%;margin-top:12px;" onclick="YX.fastHistory()">⏱ 断食历史</button></div>');
  }
  function injectData() {
    var view = document.getElementById("view-data"); if (!view || document.getElementById("yxTdeeCard")) return;
    view.querySelector("h1").insertAdjacentHTML("afterend",
      '<div class="card" id="yxTdeeCard"><h2>📐 真实代谢与达成预测</h2><div class="yx-insight" id="yxTdeeBox" style="margin-top:10px;"></div>' +
      '<canvas id="yxTrend" style="width:100%;height:170px;margin-top:10px;"></canvas>' +
      '<p class="sub" style="margin:6px 0 0;">虚线=目标体重，浅点=每次记录，深线=7日均值</p></div>' +
      '<div class="card" id="yxInsightCard"><h2>🧠 本周洞察</h2><div class="yx-insight" id="yxInsightBody" style="margin-top:10px;"></div>' +
      '<button class="btn btn-ghost" style="width:100%;margin-top:12px;" onclick="renderAll()">重新分析</button></div>');
  }
  YX.toggleOnline = function (v) { DB.yx.online = !!v; save(); toastx(v ? "已开启联网搜索" : "已关闭联网搜索"); };
  YX.toggleMicro = function (v) { DB.yx.micro = !!v; save(); var mw = $("#cMicroWrap"); if (mw) mw.style.display = v ? "grid" : "none"; };

  /* 趋势图 */
  function series() {
    return (DB.body || []).filter(function (b) { return b && num(b.weight) > 0; }).map(function (b) { return { d: b.date, w: num(b.weight) }; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  }
  function drawTrend() {
    var cv = $("#yxTrend"); if (!cv) return;
    var s = series().slice(-60), w = cv.clientWidth || 300, h = 170;
    if (w < 40) return;
    var dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (s.length < 2) { g.fillStyle = "#94a3b8"; g.font = "12px sans-serif"; g.fillText("再记录 1 次体重就能出趋势", 12, 40); return; }
    var ws = s.map(function (p) { return p.w; }), tgt = num(DB.settings.targetWeight, ws[ws.length - 1]);
    var mn = Math.min.apply(null, ws.concat([tgt])) - 0.8, mx = Math.max.apply(null, ws.concat([tgt])) + 0.8;
    function X(i) { return 26 + (w - 40) * i / (s.length - 1); }
    function Y(v) { return 12 + (h - 34) * (mx - v) / (mx - mn || 1); }
    g.strokeStyle = "#e2e8f0"; g.lineWidth = 1; g.beginPath(); g.moveTo(20, h - 20); g.lineTo(w - 6, h - 20); g.stroke();
    g.setLineDash([4, 4]); g.strokeStyle = "#10b981"; g.beginPath(); g.moveTo(20, Y(tgt)); g.lineTo(w - 6, Y(tgt)); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#10b981"; g.font = "10px sans-serif"; g.fillText("目标 " + tgt, w - 58, Y(tgt) - 4);
    g.fillStyle = "#cbd5e1";
    s.forEach(function (p, i) { g.beginPath(); g.arc(X(i), Y(p.w), 2.2, 0, 7); g.fill(); });
    g.strokeStyle = "#0f766e"; g.lineWidth = 2; g.beginPath();
    var first = true;
    for (var i = 6; i < s.length; i++) {
      var sum = 0; for (var k = i - 6; k <= i; k++) sum += s[k].w;
      var v = sum / 7;
      if (first) { g.moveTo(X(i), Y(v)); first = false; } else g.lineTo(X(i), Y(v));
    }
    g.stroke();
  }
  function renderData() { drawTrend(); }

  /* 日历基础版（yx-fix 会再次覆盖） */
  window.renderCalendar = function () {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    var html = '<div class="cal-grid">';
    ["日", "一", "二", "三", "四", "五", "六"].forEach(function (d) { html += '<div class="cal-head">' + d + "</div>"; });
    for (var i = 0; i < first; i++) html += '<div class="cal-cell"></div>';
    for (var d = 1; d <= days; d++) {
      var ds = today(new Date(y, m, d)), has = DB.diet.some(function (x) { return x.date === ds; });
      var cls = "cal-cell" + (ds === today() ? " today" : "") + (has ? (yxKcal(ds) <= DB.settings.goalKcal ? " ok" : " over") : " none");
      html += '<div class="' + cls + '"><span>' + d + '</span><span class="yx-dots"></span></div>';
    }
    document.getElementById("calendar").innerHTML = html + "</div>";
  };

  function refreshAll() {
    buildIndex(); renderRecentChips(); renderStreakBasic(); renderFastStage(); renderData();
    var lib = $("#yxLibCount"); if (lib) lib.textContent = buildIndex().arr.length + " 种可用";
    var on = $("#yxOnline"); if (on) on.checked = !!DB.yx.online;
    var mi = $("#yxMicro"); if (mi) mi.checked = !!DB.yx.micro;
    if ($("#yxPaneMine") && $("#yxPaneMine").classList.contains("on")) YX.renderMine();
    var pm = $("#yxPlanModal"); if (pm && pm.classList.contains("show")) YX.renderPlan();
  }

  /* PWA */
  function initPWA() {
    try {
      if (!document.querySelector('link[rel="manifest"]')) { var l = document.createElement("link"); l.rel = "manifest"; l.href = "manifest.json"; document.head.appendChild(l); }
      if (!document.querySelector('meta[name="theme-color"]')) { var m = document.createElement("meta"); m.name = "theme-color"; m.content = "#10b981"; document.head.appendChild(m); }
      var at = document.createElement("link"); at.rel = "apple-touch-icon"; at.href = "icon.svg"; document.head.appendChild(at);
      if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () { });
    } catch (e) { }
  }

  function mount() {
    if (window.__YX_MOUNTED) return;
    window.__YX_MOUNTED = true;
    injectCSS(); ensureData(); buildIndex(true);
    if (!curMeal) curMeal = "breakfast";
    var old = document.getElementById("myFoodCount");
    if (old) { var c = old.closest(".card"); if (c) c.remove(); }
    var om = document.getElementById("myFoodsModal"); if (om) om.remove();
    overrideGlobals(); rebuildSheet();
    injectTodayBar(); injectDiet(); injectMine(); injectData(); initPWA();
    renderAll();
    window.addEventListener("resize", function () { try { renderData(); } catch (e) { } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
