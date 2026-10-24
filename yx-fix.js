/* =========================================================
   小叶健康 · 口径 / 洞察 / 诊断修正  yx-fix.js  (v2.1)
   加载顺序：foods-extra.js → yx-plus.js → yx-fix.js
   作用：修正"达标"口径、TDEE 闸门、断食文案、暗色模式；
        新增周预算、用手比份量、新手引导、诊断面板、备份提醒。
   ========================================================= */
(function () {
  "use strict";
  var YX = window.YX;
  if (!YX || window.__YXF_MOUNTED) return;
  window.__YXF_MOUNTED = true;
  var YXF = window.YXF = {};

  /* ---------------- 0. 工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function r1(v) { return Math.round(num(v) * 10) / 10; }
  function fx(v) { var n = r1(v); return Number.isInteger(n) ? String(n) : n.toFixed(1); }
  function escx(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function today(d) { return todayStr(d || new Date()); }
  var MN = (typeof MEALS !== "undefined" && MEALS) || { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
  function ml(m) { return MN[m] || "餐次"; }

  var _tmr = null;
  function toast(msg, act) {
    if (YX && typeof YX.toast === "function") return YX.toast(msg, act);   // 复用同一套 toast，避免抢定时器
    var el = $("#yxToast");
    if (!el) { el = document.createElement("div"); el.id = "yxToast"; document.body.appendChild(el); }
    el.innerHTML = "<span>" + escx(msg) + "</span>" + (act ? '<button id="yxToastBtn">' + escx(act.label) + "</button>" : "");
    el.classList.add("show"); clearTimeout(_tmr);
    if (act) { var b = $("#yxToastBtn"); if (b) b.onclick = function () { el.classList.remove("show"); act.fn(); }; }
    _tmr = setTimeout(function () { el.classList.remove("show"); }, act ? 5200 : 1900);
  }
  function row(k, v) { return '<div class="yx-kv"><span>' + k + "</span><span>" + v + "</span></div>"; }
  function warn(s) { return '<div class="yxf-warn">⚠️ ' + s + "</div>"; }
  function floorKcal() { return DB.settings.gender === "male" ? 1500 : 1200; }

  /* ---------------- 1. 数据工具 ---------------- */
  function kcal(d) {
    return DB.diet.filter(function (x) { return x.date === d; })
      .reduce(function (s, x) { return s + num(x.kcal); }, 0);
  }
  function exKcal(d) {
    return (DB.exercise || []).filter(function (e) { return e.date === d; })
      .reduce(function (s, e) { return s + num(e.kcal); }, 0);
  }
  function macro(d) {
    var m = { p: 0, c: 0, f: 0, fiber: 0 };
    DB.diet.filter(function (x) { return x.date === d; }).forEach(function (x) {
      m.p += num(x.p); m.c += num(x.c); m.f += num(x.fat); m.fiber += num(x.fiber);
    });
    return m;
  }
  function goal() { return num(DB.settings.goalKcal, 1800); }

  /* 有效日：有记录 且 热量在目标的 60%~105%，防止"少吃就达标" */
  function effective(d) {
    var k = kcal(d);
    return DB.diet.some(function (x) { return x.date === d; }) && k >= goal() * 0.6 && k <= goal() * 1.05;
  }

  function migrate() {
    if (!DB.yx || typeof DB.yx !== "object") DB.yx = { online: true, micro: false, planDate: "" };
    if (DB.schemaVer == null) DB.schemaVer = 0;
    if (DB.schemaVer < 3) {
      DB.yx.flags = DB.yx.flags || {};
      DB.yx.exportedAt = num(DB.yx.exportedAt);
      DB.yx.lastBackupAsk = DB.yx.lastBackupAsk || "";
      DB.yx.lastMissAsk = DB.yx.lastMissAsk || "";
      DB.yx.budgetOn = DB.yx.budgetOn !== false;
      DB.schemaVer = 3;
      try { save(); } catch (e) { }
    }
  }

  /* ---------------- 2. 样式补丁 ---------------- */
  var CSS = [
    ".yxf-warn{background:rgba(245,158,11,.13);color:#b45309;border-radius:10px;padding:8px 10px;font-size:12.5px;line-height:1.65;margin-top:8px;}",
    '[data-theme="dark"] .yxf-warn{color:#fcd34d;}',
    ".yxf-conf{font-size:11px;border-radius:6px;padding:1px 6px;background:var(--fill2);color:var(--sub);margin-left:4px;}",
    ".yxf-budget{margin-top:8px;width:100%;}",
    ".yxf-budget .bar{height:8px;border-radius:4px;background:var(--bar-bg);overflow:hidden;}",
    ".yxf-budget .fill{height:100%;border-radius:4px;}",
    ".yxf-field{margin-bottom:10px;}",
    ".yxf-field label{display:block;font-size:12px;color:var(--sub);margin-bottom:5px;}",
    ".yxf-field input,.yxf-field select{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:var(--fill);color:var(--text);font-size:15px;}",
    ".yxf-flag{float:right;border:none;background:var(--fill2);color:var(--sub);font-size:11px;padding:4px 8px;border-radius:8px;cursor:pointer;}",
    ".yxf-ver{text-align:center;font-size:11px;color:var(--sub);margin:2px 0 14px;cursor:pointer;line-height:1.7;}",
    ".yxf-code{font-family:ui-monospace,Menlo,monospace;font-size:11px;background:var(--fill2);border-radius:8px;padding:8px;color:var(--text2);white-space:pre-wrap;max-height:150px;overflow:auto;}"
  ].join("");
  function injectCSS() { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  /* ---------------- 3. 连续记录 + 周预算 ---------------- */
  function streakDays() {
    var n = 0, d = new Date();
    if (!DB.diet.some(function (x) { return x.date === today(d); })) d = new Date(Date.now() - 86400000);
    while (n < 3650) {
      var ds = today(d);
      if (!DB.diet.some(function (x) { return x.date === ds; })) break;
      n++; d = new Date(d.getTime() - 86400000);
    }
    return n;
  }
  function weekStats() {
    var ok = 0, rec = 0, sum = 0, over = 0, partial = 0;
    for (var i = 0; i < 7; i++) {
      var d = today(new Date(Date.now() - i * 86400000));
      if (!DB.diet.some(function (x) { return x.date === d; })) continue;
      rec++;
      var k = kcal(d); sum += k;
      if (effective(d)) ok++;
      if (k > goal() * 1.05) over++;
      if (k < goal() * 0.6) partial++;
    }
    return { ok: ok, rec: rec, sum: sum, over: over, partial: partial };
  }
  function renderStreak() {
    var el = $("#yxStreak"); if (!el) return;
    var w = weekStats(), left = goal() * 7 - w.sum;
    var html = "🔥 连续 " + streakDays() + " 天 · 近7天有效 <b>" + w.ok + "/" + w.rec + "</b> 天";
    if (DB.yx.budgetOn !== false) {
      var pct = Math.max(0, Math.min(100, Math.round(left / (goal() * 7) * 100)));
      html += '<div class="yxf-budget"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--sub);margin-bottom:4px;"><span>本周预算</span><span>' +
        (left >= 0
          ? '还剩 <b style="color:var(--green-d)">' + Math.round(left) + "</b> 千卡"
          : '已超 <b style="color:#ef4444">' + Math.round(-left) + "</b> 千卡（明天少 300 就能拉回）") +
        '</span></div><div class="bar"><div class="fill" style="width:' + pct + "%;background:" +
        (left >= 0 ? "var(--green)" : "#ef4444") + ';"></div></div></div>';
    }
    el.innerHTML = html;
  }

  /* ---------------- 4. 真实 TDEE ---------------- */
  function series() {
    return (DB.body || []).filter(function (b) { return b && num(b.weight) > 0; })
      .map(function (b) { return { d: b.date, w: num(b.weight) }; })
      .sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  }
  function avgIntake(days) {
    var sum = 0, n = 0;
    for (var i = 0; i < days; i++) {
      var d = today(new Date(Date.now() - i * 86400000));
      if (DB.diet.some(function (x) { return x.date === d; })) { sum += kcal(d); n++; }
    }
    return n ? { avg: sum / n, n: n } : null;
  }
  function tdeeFix() {
    var s = series();
    if (s.length < 2) return { state: "noweight" };

    var base = Date.parse(s[0].d);
    var lastTs = Date.parse(s[s.length - 1].d);
    var pts = s.filter(function (p) { return Date.parse(p.d) >= lastTs - 27 * 86400000; });
    if (pts.length < 2) return { state: "noweight" };

    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) {
      var x = (Date.parse(p.d) - base) / 86400000;
      sx += x; sy += p.w; sxx += x * x; sxy += x * p.w;
    });
    var den = n * sxx - sx * sx;
    if (!den) return { state: "noweight" };

    var slope = (n * sxy - sx * sy) / den;          // kg/天
    var kg28 = r1(slope * 28), slopeW = r1(slope * 7);
    var ai = avgIntake(28);

    if (!ai) return { state: "nofood", kg28: kg28, slopeW: slopeW };
    if (ai.n < 20) return { state: "lowdata", days: ai.n, kg28: kg28, slopeW: slopeW };

    var tdee = ai.avg + (-slope) * 7700;
    return {
      state: "ok",
      tdee: Math.round(tdee),
      avgKcal: Math.round(ai.avg),
      days: ai.n,
      confidence: ai.n >= 26 ? "高" : (ai.n >= 22 ? "中" : "偏低"),
      kg28: kg28,
      slopeW: slopeW,
      platform: Math.abs(slopeW) < 0.1,
      regain: slopeW > 0.15 && num(DB.settings.targetWeight) < num(DB.settings.weight),
      floorHit: goal() < floorKcal(),
      formula: Math.round((typeof calcBMR === "function" ? calcBMR() : 0) * 1.2)
    };
  }
  function predLine(t) {
    var remain = num(DB.settings.weight) - num(DB.settings.targetWeight);
    if (!(remain > 0)) return '<b style="color:var(--green-d)">已达成目标</b>';
    var def = Math.max(80, t.tdee - goal());
    var days = Math.round(remain * 7700 / def);
    var d = new Date(Date.now() + days * 86400000);
    return "还需减 " + fx(remain) + " kg · 约 <b>" + (d.getMonth() + 1) + "月" + d.getDate() + "日</b>";
  }

  /* ---------------- 5. 洞察 ---------------- */
  function freqMap() {
    var m = {};
    DB.diet.forEach(function (d) {
      if (!d.name) return;
      var e = m[d.name] || (m[d.name] = { n: 0 });
      e.n++;
    });
    return m;
  }
  function builtinNames() {
    var set = {};
    (typeof FOODS !== "undefined" ? FOODS : []).forEach(function (a) { set[a[0]] = 1; });
    return set;
  }
  function sumPlan(date) {
    var p = DB.mealPlan[date] || {}, s = 0;
    Object.keys(p).forEach(function (k) { (p[k] || []).forEach(function (x) { s += num(x.kcal); }); });
    return s;
  }
  function insightLines() {
    var w = weekStats(), out = [], s = DB.settings;
    if (!w.rec) return ["近 7 天还没有记录，先连记 3 天我就能开始分析了。"];

    var avgK = w.sum / w.rec, diff = avgK - goal();
    out.push("近 7 天记录 <b>" + w.rec + " 天</b>，其中有效记录 <b>" + w.ok + " 天</b>（热量在目标 60%–105% 才算数）。");
    if (w.rec - w.ok >= 2) {
      out.push("有 <b>" + (w.rec - w.ok) + " 天记录不完整</b>" +
        (w.partial ? "（其中 " + w.partial + " 天明显吃少了）" : "") +
        "，这会让人误以为达标，也会让 TDEE 偏高。");
    }
    if (Math.abs(diff) <= 100) {
      out.push("日均摄入 <b>" + Math.round(avgK) + " 千卡</b>，与目标基本吻合，节奏很稳。");
    } else if (diff > 0) {
      out.push("日均比目标高 <b>" + Math.round(diff) + " 千卡</b>，按这个节奏一个月约 +" +
        (diff * 30 / 7700).toFixed(1) + " kg（理论值）。先从饮料和主食各减 10% 试一周。");
    } else {
      out.push("日均比目标低 <b>" + Math.round(-diff) + " 千卡</b>，" +
        (diff < -400 ? "幅度偏大，容易掉肌肉和代谢，建议上调到只差 300–500。" : "属于健康节奏，保持。"));
    }

    var pSum = 0, fSum = 0, dN = 0;
    for (var i = 0; i < 7; i++) {
      var d = today(new Date(Date.now() - i * 86400000));
      if (DB.diet.some(function (x) { return x.date === d; })) {
        var m = macro(d); pSum += m.p; fSum += m.fiber; dN++;
      }
    }
    if (dN) {
      var pAvg = pSum / dN, pTar = num(s.macroP, 100) || 1;
      out.push(pAvg / pTar < 0.85
        ? "蛋白质日均 <b>" + Math.round(pAvg) + "g</b>，只有目标的 " + Math.round(pAvg / pTar * 100) + "%。减脂期每餐加一份蛋白，别只减热量。"
        : "蛋白质日均 <b>" + Math.round(pAvg) + "g</b>（目标 " + Math.round(pAvg / pTar * 100) + "%）✅");
      var fAvg = fSum / dN, fTar = num(s.fiberGoal, 25);
      if (fTar && fAvg / fTar < 0.7) {
        out.push("膳食纤维日均 <b>" + Math.round(fAvg) + "g</b>，目标 " + fTar + "g。蔬菜/粗粮/豆类每天补一份。");
      }
    }
    if (w.over) out.push("本周有 <b>" + w.over + " 天</b>明显超标——看周预算比纠结某一天有用。");

    var fq = freqMap();
    var top = Object.keys(fq).sort(function (a, b) { return fq[b].n - fq[a].n; }).slice(0, 3);
    if (top.length) {
      out.push("最常吃：<b>" + top.map(escx).join(" / ") + "</b>。体重卡住时优先从这里找 10% 的热量。");
    }

    var bn = builtinNames(), estN = 0, tot = 0, since = today(new Date(Date.now() - 6 * 86400000));
    DB.diet.forEach(function (x) {
      if (!x.date || x.date < since) return;
      tot++; if (!bn[x.name]) estN++;
    });
    if (tot && estN / tot > 0.25) {
      out.push("近 7 天 <b>" + Math.round(estN / tot * 100) + "%</b> 的记录来自自定义/估算食物，误差可能偏大，常吃的那几样建议核对一次。");
    }

    var pd = DB.yx.planDate, planned = pd ? sumPlan(pd) : 0;
    if (pd && pd <= today() && planned > 0 && kcal(pd) > 0) {
      var actual = kcal(pd);
      out.push("计划当天 " + Math.round(planned) + " 千卡，实际 " + Math.round(actual) +
        (actual > planned ? "，超 <b>" + Math.round(actual - planned) + "</b> 千卡。" : "，控制得不错 ✅"));
    }
    out.push("连续记录 <b>" + streakDays() + "</b> 天。");
    return out;
  }

  function renderSmart() {
    var t = tdeeFix(), box = $("#yxTdeeBox");
    if (box) {
      if (t.state === "noweight") {
        box.innerHTML = "记录 <b>2 次以上</b>体重后，这里会用你的真实数据反推 TDEE（比公式准）。";
      } else if (t.state === "nofood") {
        box.innerHTML = "体重趋势 <b>" + (t.kg28 > 0 ? "+" : "") + t.kg28 + " kg / 28天</b>。还需要 20 天饮食记录才能反推 TDEE。";
      } else if (t.state === "lowdata") {
        box.innerHTML = row("已积累饮食记录", "<b>" + t.days + " / 28 天</b>") +
          row("体重趋势", (t.kg28 > 0 ? "+" : "") + t.kg28 + " kg") +
          warn("数据还不够（需 20 天以上），现在算的 TDEE 偏差很大，先别按它调目标。还差 " + (20 - t.days) + " 天。");
      } else {
        var html = row("真实 TDEE（实测）", "<b>" + t.tdee + ' 千卡</b><span class="yxf-conf">' + t.confidence + " · " + t.days + "/28天</span>") +
          row("公式估算（BMR×1.2）", t.formula + " 千卡") +
          row("近 28 天体重", (t.kg28 > 0 ? "+" : "") + t.kg28 + " kg（" + t.slopeW + " kg/周）") +
          row("日均摄入", t.avgKcal + " 千卡") +
          row("目标热量", goal() + " 千卡") +
          row("距目标", predLine(t));
        if (t.platform) {
          html += warn("近 3 周体重均线基本不动（" + t.slopeW + " kg/周）。建议目标下调 100–150 千卡，或每周加 2 次力量训练——只减饭量会同时掉肌肉和代谢。");
        }
        if (t.regain) {
          html += warn("近 28 天体重回升 " + t.kg28 + " kg。先检查记录是否完整：漏记会让数据谎报「其实没吃多」。");
        }
        if (t.floorHit) {
          html += warn("当前目标低于安全下限（" + floorKcal() + " 千卡），长期会伤代谢，建议上调。");
        }
        box.innerHTML = html;
      }
    }
    var ins = $("#yxInsightBody");
    if (ins) ins.innerHTML = insightLines().map(function (x) { return "· " + x; }).join("<br>");
  }

  /* ---------------- 6. 日历（有效日 + 多指标） ---------------- */
  window.renderCalendar = function () {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    var html = '<div class="cal-grid">';
    ["日", "一", "二", "三", "四", "五", "六"].forEach(function (d) {
      html += '<div class="cal-head">' + d + "</div>";
    });
    for (var i = 0; i < first; i++) html += '<div class="cal-cell"></div>';
    for (var d = 1; d <= days; d++) {
      var ds = today(new Date(y, m, d));
      var has = DB.diet.some(function (x) { return x.date === ds; });
      var cls = "cal-cell" + (ds === today() ? " today" : "") + (has ? (effective(ds) ? " ok" : " over") : " none");
      var dots = "";
      if (has) {
        if (macro(ds).p >= num(DB.settings.macroP, 100) * 0.8) dots += '<i class="yx-dot" style="background:#3b82f6"></i>';
        if (exKcal(ds) > 0) dots += '<i class="yx-dot" style="background:#f59e0b"></i>';
        if ((DB.fastHistory || []).some(function (f) { return today(new Date(f.start)) === ds; })) dots += '<i class="yx-dot" style="background:#14b8a6"></i>';
        if ((DB.water[ds] || 0) >= num(DB.settings.goalWater, 2000) * 0.9) dots += '<i class="yx-dot" style="background:#0ea5e9"></i>';
      }
      html += '<div class="' + cls + '"><span>' + d + '</span><span class="yx-dots">' + dots + "</span></div>";
    }
    var el = document.getElementById("calendar");
    if (el) el.innerHTML = html + "</div>";
  };

  /* ---------------- 7. 份量：用手比 + 数据纠错 ---------------- */
  var curFood = null;
  var PRESETS = [
    ["一掌心（肉/鱼）", 100],
    ["一个拳头（主食）", 150],
    ["两捧（蔬菜）", 100],
    ["一汤勺（油）", 10],
    ["一小把（坚果）", 25]
  ];
  function injectPresets() {
    var u = $("#yxUnits");
    if (!u || $("#yxPresets")) return;
    u.insertAdjacentHTML("afterend",
      '<div class="yx-units" id="yxPresets">' +
      PRESETS.map(function (p) {
        return '<span class="yx-unit" onclick="YXF.preset(' + p[1] + ',this)">' + p[0] + "</span>";
      }).join("") + "</div>" +
      '<div class="sub" style="margin:-4px 0 8px;font-size:11.5px;">拿不准克数就用手比：掌心≈100g 肉，拳头≈150g 主食，两捧≈100g 菜</div>');
  }
  YXF.preset = function (g, el) {
    var i = $("#yxGrams"); if (!i) return;
    i.value = g;
    Array.prototype.forEach.call(document.querySelectorAll("#yxUnits .yx-unit,#yxPresets .yx-unit"), function (x) {
      x.classList.remove("on");
    });
    if (el) el.classList.add("on");
    var h = $("#yxGramHint"); if (h) h.textContent = "按 " + g + "g 估算";
    try { YX.preview(); } catch (e) { }
  };

  function injectFlag() {
    var p = $("#yxPanePortion");
    if (!p || $("#yxFlagBtn")) return;
    p.insertAdjacentHTML("afterbegin", '<button class="yxf-flag" id="yxFlagBtn" onclick="YXF.flag()">?! 数据不对</button>');
  }
  YXF.flag = function () {
    if (!curFood) return;
    DB.yx.flags = DB.yx.flags || {};
    DB.yx.flags[curFood.name] = Date.now();
    try { save(); } catch (e) { }
    var idx = (DB.foods2 || []).map(function (f) { return f.name; }).indexOf(curFood.name);
    if (idx >= 0) {
      toast("已标记「" + curFood.name + "」数据有误", { label: "去修改", fn: function () { YX.editFood(idx); } });
    } else {
      toast("已标记「" + curFood.name + "」，会降低它的推荐权重");
    }
  };

  /* ---------------- 8. 计划偏差 ---------------- */
  var _rp = YX.renderPlan;
  YX.renderPlan = function () {
    _rp.apply(YX, arguments);
    try {
      var body = $("#yxPlanBody"); if (!body) return;
      var pd = DB.yx.planDate;
      if (!pd || !DB.diet.some(function (x) { return x.date === pd; })) return;
      var planned = sumPlan(pd), actual = kcal(pd);
      if (!planned) return;
      body.insertAdjacentHTML("beforeend",
        '<div class="yx-kv" style="margin-top:8px;"><span>实际已记录</span><span>' + Math.round(actual) + " 千卡</span></div>" +
        (actual > planned
          ? '<div class="yxf-warn">已超计划 ' + Math.round(actual - planned) + " 千卡。可以把明天的加餐提前砍掉补回来。</div>"
          : '<div class="yx-kv"><span>剩余额度</span><span>' + Math.round(planned - actual) + " 千卡</span></div>"));
    } catch (e) { }
  };

  /* ---------------- 9. 新手引导 ---------------- */
  function onboarding() {
    if (DB.yx.onboarded) return;
    var m = document.createElement("div");
    m.className = "modal show"; m.id = "yxOnboard";
    m.innerHTML = '<div class="sheet"><h3>先花 20 秒设好目标</h3>' +
      '<p class="sub" style="margin:0 0 12px;">只用来算基础代谢和热量目标，随时可在「我的」修改。</p>' +
      '<div class="yxf-field"><label>性别</label><select id="obGender"><option value="female">女</option><option value="male">男</option></select></div>' +
      '<div class="grid2"><div class="yxf-field"><label>年龄</label><input id="obAge" type="number" value="' + num(DB.settings.age, 28) + '"></div>' +
      '<div class="yxf-field"><label>身高 cm</label><input id="obHeight" type="number" value="' + num(DB.settings.height, 165) + '"></div></div>' +
      '<div class="grid2"><div class="yxf-field"><label>当前体重 kg</label><input id="obWeight" type="number" step="0.1" value="' + num(DB.settings.weight, 60) + '"></div>' +
      '<div class="yxf-field"><label>目标体重 kg</label><input id="obTarget" type="number" step="0.1" value="' + num(DB.settings.targetWeight, 55) + '"></div></div>' +
      '<button class="btn btn-primary" style="width:100%;margin-top:6px;" onclick="YXF.finishOnboard()">生成目标并开始记录</button>' +
      '<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="YXF.skipOnboard()">以后再说</button>' +
      '<p class="sub" style="margin:12px 0 0;font-size:11.5px;">减脂缺口按 400 千卡/天算；目标不会低于安全下限（女 1200 / 男 1500 千卡）。</p></div>';
    document.body.appendChild(m);
  }
  YXF.skipOnboard = function () {
    DB.yx.onboarded = Date.now();
    try { save(); } catch (e) { }
    var m = $("#yxOnboard"); if (m) m.remove();
  };
  YXF.finishOnboard = function () {
    var g = $("#obGender").value;
    var age = num($("#obAge").value, 28), h = num($("#obHeight").value, 165);
    var w = num($("#obWeight").value, 60), tw = num($("#obTarget").value, w);
    if (h < 100 || h > 230 || w < 25 || w > 250) { toast("身高/体重看起来不太对，检查一下"); return; }

    var bmr = Math.round(10 * w + 6.25 * h - 5 * age + (g === "male" ? 5 : -161));
    var tdee = Math.round(bmr * 1.2);
    var want = tw < w ? 400 : 0;
    var gk = Math.round((tdee - want) / 10) * 10;
    var floor = g === "male" ? 1500 : 1200, adjusted = false;
    if (want > 0 && gk < floor) { gk = floor; adjusted = true; }

    DB.settings.gender = g;
    DB.settings.age = age;
    DB.settings.height = h;
    DB.settings.weight = w;
    DB.settings.targetWeight = tw;
    DB.settings.goalKcal = gk;
    DB.settings.macroP = Math.round(gk * 0.2 / 4);
    DB.settings.macroC = Math.round(gk * 0.5 / 4);
    DB.settings.macroF = Math.round(gk * 0.3 / 9);
    DB.settings.fiberGoal = Math.max(20, Math.round(gk / 1000 * 14));
    DB.yx.onboarded = Date.now();
    try { save(); } catch (e) { }
    try { if (typeof loadSettingsToForm === "function") loadSettingsToForm(); } catch (e) { }

    var m = $("#yxOnboard"); if (m) m.remove();
    renderAll();
    toast("目标 " + gk + " 千卡" + (adjusted ? "（已抬到安全下限）" : "，缺口 " + want), {
      label: "记第一笔", fn: function () { YX.openSheetTo("search", "log"); }
    });
  };

  /* ---------------- 10. 版本 / 备份提醒 / 漏记提醒 / 诊断 ---------------- */
  function ago(ts) {
    var d = Math.floor((Date.now() - ts) / 86400000);
    return d <= 0 ? "今天" : (d + " 天前");
  }
  function injectVer() {
    var view = document.getElementById("view-mine");
    if (!view || $("#yxVer")) return;
    view.insertAdjacentHTML("beforeend", '<p class="yxf-ver" id="yxVer"></p>');
    var taps = 0, t = null;
    $("#yxVer").addEventListener("click", function () {
      taps++; clearTimeout(t);
      t = setTimeout(function () { taps = 0; }, 900);
      if (taps >= 5) { taps = 0; YXF.diag(); }
    });
  }
  function renderVer() {
    var el = $("#yxVer"); if (!el) return;
    var sw = "SW 未启用";
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) sw = "SW 已启用";
      else if (navigator.serviceWorker) sw = "SW 注册中";
    } catch (e) { }
    el.innerHTML = "v2.1 · 数据 v" + (DB.schemaVer || 0) + " · " + sw + " · 备份 " +
      (DB.yx.exportedAt ? ago(DB.yx.exportedAt) : '<b style="color:#ef4444">从未</b>') +
      '<br><span style="font-size:10px;">连点 5 次打开诊断</span>';
  }

  var ERRS = window.__YX_ERRS = [];
  function hookErrors() {
    window.addEventListener("error", function (e) {
      ERRS.push(new Date().toISOString().slice(5, 19) + " " + (e.message || "error") +
        " @" + ((e.filename || "").split("/").pop() || "") + ":" + (e.lineno || 0));
      if (ERRS.length > 20) ERRS.shift();
    });
    window.addEventListener("unhandledrejection", function (e) {
      ERRS.push(new Date().toISOString().slice(5, 19) + " promise: " +
        ((e.reason && e.reason.message) || String(e.reason)));
      if (ERRS.length > 20) ERRS.shift();
    });
  }

  function checkData() {
    var issues = [], ids = {}, dup = 0, bad = 0, mismatch = 0;
    DB.diet.forEach(function (x) {
      if (ids[x.id]) dup++; else ids[x.id] = 1;
      var k = num(x.kcal);
      if (!(k >= 0) || !x.date || !x.name) bad++;
      var mk = num(x.p) * 4 + num(x.c) * 4 + num(x.fat) * 9;
      if (k > 50 && mk > 0 && Math.abs(mk - k) / k > 0.45) mismatch++;
    });
    if (dup) issues.push("重复 id：" + dup + " 条");
    if (bad) issues.push("字段缺失/异常：" + bad + " 条");
    if (mismatch) issues.push("宏量与热量不自洽（可能单位填错）：" + mismatch + " 条");
    if (!DB.settings.goalKcal) issues.push("目标热量为空");
    return issues;
  }
  function diagText() {
    return [
      "版本 v2.1 / 数据 v" + (DB.schemaVer || 0),
      "饮食记录 " + DB.diet.length + " 条 · 自定义食物 " + (DB.foods2 || []).length + " 条",
      "体重记录 " + (DB.body || []).length + " 条 · 运动 " + (DB.exercise || []).length + " 条",
      "断食历史 " + (DB.fastHistory || []).length + " 轮 · 套餐 " + (DB.meals2 || []).length + " 个",
      "存储约 " + Math.round(JSON.stringify(DB).length / 1024) + " KB",
      "上次导出 " + (DB.yx.exportedAt ? ago(DB.yx.exportedAt) : "从未")
    ].join("\n");
  }
  YXF.closeDiag = function () { var m = $("#yxDiag"); if (m) m.remove(); };
  YXF.reDiag = function () { YXF.closeDiag(); YXF.diag(); };
  YXF.diag = function () {
    var issues = checkData();
    var m = document.createElement("div");
    m.className = "modal show"; m.id = "yxDiag";
    m.innerHTML = '<div class="sheet"><span class="close-x" onclick="YXF.closeDiag()">×</span>' +
      "<h3>🛠 诊断</h3>" +
      '<div class="yxf-code">' + escx(diagText()) + "</div>" +
      '<div style="margin-top:10px;font-size:13px;">' +
      (issues.length
        ? '<div class="yxf-warn">发现问题：<br>' + issues.map(escx).join("<br>") + "</div>"
        : '<div class="yx-kv"><span>数据自检</span><span style="color:var(--green-d);font-weight:600;">通过 ✅</span></div>') +
      "</div>" +
      '<div class="yxf-code" style="margin-top:10px;">' + escx(ERRS.length ? ERRS.join("\n") : "无异常记录") + "</div>" +
      '<div class="grid2" style="margin-top:12px;">' +
      '<button class="btn btn-ghost" onclick="exportData()">立即导出</button>' +
      '<button class="btn btn-ghost" onclick="YXF.copyDiag()">复制诊断</button></div>' +
      '<button class="btn btn-ghost" style="width:100%;margin-top:8px;" onclick="YXF.reDiag()">重新检查</button></div>';
    document.body.appendChild(m);
  };
  YXF.copyDiag = function () {
    var txt = "小叶健康诊断\n" + diagText() + "\n" + checkData().join("; ") + "\n" + ERRS.join("\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(
        function () { toast("已复制诊断信息"); },
        function () { toast("复制失败，请长按选择"); }
      );
    } else toast("复制失败，请长按选择");
  };

  function reminders() {
    var askKey = today();
    var stale = !DB.yx.exportedAt || (Date.now() - DB.yx.exportedAt) > 7 * 86400000;
    if (stale && DB.diet.length > 10 && DB.yx.lastBackupAsk !== askKey) {
      DB.yx.lastBackupAsk = askKey;
      try { save(); } catch (e) { }
      toast("数据只在这台手机上，已 " + (DB.yx.exportedAt ? ago(DB.yx.exportedAt) : "很久") + "没备份", {
        label: "导出", fn: function () { try { exportData(); } catch (e) { } }
      });
      return;
    }
    var y = today(new Date(Date.now() - 86400000));
    var hadYesterday = DB.diet.some(function (x) { return x.date === y; });
    var active = DB.diet.some(function (x) { return x.date >= today(new Date(Date.now() - 6 * 86400000)); });
    if (!hadYesterday && active && DB.yx.lastMissAsk !== askKey) {
      DB.yx.lastMissAsk = askKey;
      try { save(); } catch (e) { }
      toast("昨天没有记录，补一下？", {
        label: "去补记",
        fn: function () { try { switchTab("diet"); changeDay(-1); } catch (e) { } }
      });
    }
  }

  /* ---------------- 11. 静态文案修正 ---------------- */
  function injectNotes() {
    var chat = document.getElementById("view-chat");
    if (chat && !document.getElementById("yxAiNote")) {
      var h = chat.querySelector("h1");
      if (h) h.insertAdjacentHTML("afterend", '<p class="sub" id="yxAiNote">AI 内容仅供参考，不构成医疗建议；身体不适请就医。</p>');
    }
    var fi = document.getElementById("fastInfo");
    if (fi && !document.getElementById("yxFastNote")) {
      fi.insertAdjacentHTML("afterend", '<p class="sub" id="yxFastNote" style="margin:6px 0 0;">断食存在个体差异，不适用于孕期、糖尿病或进食障碍人群。</p>');
    }
    var sc = document.querySelector('[onclick="YX.startScan()"]');
    if (sc && sc.textContent.indexOf("仅安卓") < 0) sc.textContent += "（仅安卓 Chrome）";
  }
  function syncFastingText() {
    var el = document.getElementById("fastStatus");
    if (!el) return;
    var t = el.textContent;
    if (t.indexOf("自噬") < 0) return;
    el.textContent = t
      .replace(/🌀\s*自噬上升期（18h\+）/g, "🔋 深度燃脂期（18h+）")
      .replace(/自噬上升期/g, "深度燃脂期")
      .replace(/自噬/g, "脂肪供能");
  }

  /* ---------------- 12. 接线 ---------------- */
  function gramsLabel(txt) {
    var i = $("#cGrams"); if (!i) return;
    var l = i.parentElement && i.parentElement.querySelector("label");
    if (l) l.textContent = txt;
  }
  function wrapAll() {
    var _ra = window.renderAll;
    window.renderAll = function () {
      try { _ra.apply(this, arguments); } catch (e) { console.error(e); }
      try { renderStreak(); } catch (e) { }
      try { renderSmart(); } catch (e) { }
      try { renderVer(); } catch (e) { }
      try { syncFastingText(); } catch (e) { }
    };

    var _rt = window.renderToday;
    window.renderToday = function () {
      try { _rt.apply(this, arguments); } catch (e) { console.error(e); }
      try { renderStreak(); } catch (e) { }
    };

    var _pick = YX.pick;
    YX.pick = function (i) {
      try { curFood = (window._yxResults || [])[i] || null; } catch (e) { }
      _pick.call(YX, i);
      try { injectPresets(); injectFlag(); } catch (e) { }
    };

    var _ef = YX.editFood;
    YX.editFood = function (i) { _ef.call(YX, i); gramsLabel("常用份量(g)"); };

    var _tc = YX.toCustomFromCur;
    if (_tc) YX.toCustomFromCur = function () { _tc.call(YX); gramsLabel("这一份分量(g)"); };

    var _os = YX.openSheetTo;
    YX.openSheetTo = function (a, b) { _os.call(YX, a, b); gramsLabel("这一份分量(g)"); };

    var _exp = window.exportData;
    if (_exp) {
      window.exportData = function () {
        try { _exp.apply(this, arguments); DB.yx.exportedAt = Date.now(); save(); renderVer(); } catch (e) { }
      };
    }

    ["renderToday", "renderAll", "renderCalendar", "startFast", "endFast"].forEach(function (n) {
      if (typeof window[n] !== "function") console.warn("[yx] 全局函数 " + n + " 不存在，增强模块可能失效");
    });
  }

  /* ---------------- 13. 启动 ---------------- */
  function mount() {
    injectCSS();
    migrate();
    hookErrors();
    injectNotes();
    wrapAll();
    injectVer();
    renderVer();
    renderAll();
    setTimeout(onboarding, 300);
    setTimeout(reminders, 1800);
    window.addEventListener("resize", function () { try { renderSmart(); } catch (e) { } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
