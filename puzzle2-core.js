/*!
 * puzzle2-core.js — 终末地「维修总动员 · 方块拼装」算法核心（V2）
 * 纯 JS、无 DOM、无任何依赖；浏览器挂 window.PZ2，Node 走 module.exports。
 * 职责：生成必定有解的方块谜题 + 放置/校验规则，供页面层直接调用。
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // Node / CommonJS
  if (root) root.PZ2 = api;                                              // 浏览器全局
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EMPTY = 0, BLOCK = 9;        // grid 取值：0=空格（可放），9=禁区
  var MIN_PIECES = 5, MAX_PIECES = 8;   // 默认块数区间（未指定档位/参数时使用）
  var MAX_PIECE_CELLS = 4;              // 单块最大格数
  var MAX_SINGLE = 1;                   // 允许的单格块上限
  var GEN_TRIES = 200;                  // 单局内部重试次数上限

  // 难度档参数表（与 docs/level-spec.md 第二节 V2 方块拼装一致）
  // 难度档参数表。cols/rows/hazard 严格取自 docs/level-spec.md 第二节 V2 方块拼装；
  // 块数区间见下方说明：规格给的 4-5/5-6/7-8/8-9 与 4 格上限不相容（4 档中 3 档无解），
  // 故 piecesMin/Max 采用「按 4 格上限反推的可行区间」，并把规格原值保留在 specPieces* 以便对照。
  var LEVELS = [
    { lv: 1, cols: 5, rows: 5, hazardMin: 0, hazardMax: 1, piecesMin: 6, piecesMax: 7, specPiecesMin: 4, specPiecesMax: 5 },
    { lv: 2, cols: 5, rows: 6, hazardMin: 1, hazardMax: 2, piecesMin: 7, piecesMax: 8, specPiecesMin: 5, specPiecesMax: 6 },
    { lv: 3, cols: 5, rows: 6, hazardMin: 2, hazardMax: 3, piecesMin: 7, piecesMax: 8, specPiecesMin: 6, specPiecesMax: 7 },
    { lv: 4, cols: 6, rows: 6, hazardMin: 3, hazardMax: 3, piecesMin: 9, piecesMax: 10, specPiecesMin: 7, specPiecesMax: 8 },
    { lv: 5, cols: 6, rows: 7, hazardMin: 3, hazardMax: 4, piecesMin: 10, piecesMax: 11, specPiecesMin: 8, specPiecesMax: 9 }
  ];
  var DEFAULT_LV = 3;                   // 历史默认局（5x6 / 禁区2-3 / 块5-8）归到 V3 参数

  function normLv(v) {
    var n = Math.floor(Number(v));
    if (!isFinite(n) || n < 1) return DEFAULT_LV;
    return n > 5 ? 5 : n;
  }
  function levelOf(lv) {
    var n = normLv(lv), i;
    for (i = 0; i < LEVELS.length; i++) if (LEVELS[i].lv === n) return LEVELS[i];
    return LEVELS[DEFAULT_LV - 1];
  }
  // 把「档位参数表 + 调用方覆盖」解析成一套生成参数
  function resolveCfg(cfg) {
    cfg = cfg || {};
    var L = levelOf(cfg.lv);
    var cols = Math.max(3, Math.floor(typeof cfg.cols === 'number' ? cfg.cols : L.cols));
    var rows = Math.max(3, Math.floor(typeof cfg.rows === 'number' ? cfg.rows : L.rows));
    var hmin = Math.max(0, Math.floor(typeof cfg.hazardMin === 'number' ? cfg.hazardMin : L.hazardMin));
    var hmax = Math.floor(typeof cfg.hazardMax === 'number' ? cfg.hazardMax : L.hazardMax);
    var pmin = Math.floor(typeof cfg.piecesMin === 'number' ? cfg.piecesMin : (typeof cfg.minPieces === 'number' ? cfg.minPieces : L.piecesMin));
    var pmax = Math.floor(typeof cfg.piecesMax === 'number' ? cfg.piecesMax : (typeof cfg.maxPieces === 'number' ? cfg.maxPieces : L.piecesMax));
    var total = cols * rows;
    if (pmin < 1) pmin = 1;
    if (pmax < 1) pmax = 1;
    if (pmin > pmax) pmin = pmax;
    if (pmax > total) pmax = total;
    if (pmin > pmax) pmin = pmax;
    // 块数窗口先按「参数表请求值」与 total 做基本合法性检查；
    // 真正的可行性窗口要等到禁区撒完、free 格数已知后，在 clampWindow 里收口。
    var minBlocks = Math.max(1, pmin);
    var maxBlocks = Math.min(pmax, total);
    if (maxBlocks < minBlocks) maxBlocks = minBlocks;
    return { lv: normLv(cfg.lv), cols: cols, rows: rows, hmin: hmin, hmax: hmax,
      pmin: pmin, pmax: pmax, minBlocks: minBlocks, maxBlocks: maxBlocks };
  }
  // 在 [lo, hi] 内摇一个目标块数
  function pickWant(rnd, lo, hi) {
    if (hi <= lo) return lo;
    return lo + Math.floor(rnd() * (hi - lo + 1));
  }

  /* ---------------- 种子随机数（mulberry32） ---------------- */

  // 先用 splitmix32 混淆种子：mulberry32 对相邻小整数（777/778）雪崩不足，
  // 直接使用会让相邻 seed 生成出完全相同的关卡。
  function hashSeed(a) {
    a = a >>> 0;
    a = (a + 0x9E3779B9) >>> 0;
    var z = a;
    z = Math.imul(z ^ (z >>> 16), 0x21F0AAAD) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735A2D97) >>> 0;
    z = (z ^ (z >>> 15)) >>> 0;
    return z >>> 0;
  }

  function mulberry32(a) {
    a = hashSeed(a);
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normSeed(seed) {
    if (typeof seed === 'number' && isFinite(seed)) return Math.floor(seed) >>> 0;
    if (typeof seed === 'string' && seed.length) { // 允许字符串种子（FNV-1a）
      var h = 2166136261, i;
      for (i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }

  /* ---------------- 基本几何工具 ---------------- */

  function key(x, y) { return y * 1000 + x; }

  // 规范化：整体平移到 min x/y = 0，并按 (y,x) 排序
  function normalize(cells) {
    if (!cells || !cells.length) return [];
    var mx = Infinity, my = Infinity, i;
    for (i = 0; i < cells.length; i++) {
      if (cells[i].x < mx) mx = cells[i].x;
      if (cells[i].y < my) my = cells[i].y;
    }
    var out = [];
    for (i = 0; i < cells.length; i++) out.push({ x: cells[i].x - mx, y: cells[i].y - my });
    out.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    return out;
  }

  // 顺时针 90°：(x,y) -> (maxY - y, x)，再规范化
  function rotateShape(cells) {
    if (!cells || !cells.length) return [];
    var my = 0, i;
    for (i = 0; i < cells.length; i++) if (cells[i].y > my) my = cells[i].y;
    var out = [];
    for (i = 0; i < cells.length; i++) out.push({ x: my - cells[i].y, y: cells[i].x });
    return normalize(out);
  }

  // 水平镜像：(x,y) -> (maxX - x, y)，再规范化
  function flipShape(cells) {
    if (!cells || !cells.length) return [];
    var mx = 0, i;
    for (i = 0; i < cells.length; i++) if (cells[i].x > mx) mx = cells[i].x;
    var out = [];
    for (i = 0; i < cells.length; i++) out.push({ x: mx - cells[i].x, y: cells[i].y });
    return normalize(out);
  }

  // 旋转 n 次（n 可正可负；默认 1 次 = 顺时针 90°）
  function rotateBy(cells, n) {
    var k = ((n % 4) + 4) % 4, out = cells;
    for (var i = 0; i < k; i++) out = rotateShape(out);
    return out;
  }

  function cloneCells(cells) {
    var out = [], i;
    for (i = 0; i < cells.length; i++) out.push({ x: cells[i].x, y: cells[i].y });
    return out;
  }

  // 4 邻接连通性检查（对任意坐标，不要求已规范化）
  function isConnected(cells) {
    if (!cells || !cells.length) return false;
    var set = {}, i;
    for (i = 0; i < cells.length; i++) set[key(cells[i].x, cells[i].y)] = true;
    var seen = {}, stack = [cells[0]], n = 0;
    seen[key(cells[0].x, cells[0].y)] = true;
    while (stack.length) {
      var c = stack.pop(); n++;
      var d = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (i = 0; i < 4; i++) {
        var k = key(c.x + d[i][0], c.y + d[i][1]);
        if (set[k] && !seen[k]) { seen[k] = true; stack.push({ x: c.x + d[i][0], y: c.y + d[i][1] }); }
      }
    }
    return n === cells.length;
  }

  /* ---------------- 单局生成（划分即解） ---------------- */

  // 在 cols x rows 上随机撒 [hazardMin, hazardMax] 个禁区格
  function scatterHazards(rnd, cols, rows, hmin, hmax) {
    var total = cols * rows;
    var lo = Math.max(0, Math.min(Math.floor(hmin), total));
    var hi = Math.max(lo, Math.min(Math.floor(hmax), total));
    var want = lo + Math.floor(rnd() * (hi - lo + 1));
    var idx = [], i;
    for (i = 0; i < total; i++) idx.push(i);
    for (i = total - 1; i > 0; i--) { // Fisher-Yates
      var j = Math.floor(rnd() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    // 注意：hazard 的键必须与 grid 查询用的 key(x,y) 一致，
    // 不能直接用行主序的平坦下标（否则只有 y=0 行能对上）。
    var dead = {};
    for (i = 0; i < want; i++) {
      var flat = idx[i];
      dead[key(flat % cols, Math.floor(flat / cols))] = true;
    }
    return dead;
  }

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // 收集某块当前所有可扩展的邻格（未占用、非禁区、未出界）
  function frontier(cells, owner, hazard, cols, rows) {
    var cand = [];
    for (var c = 0; c < cells.length; c++) {
      for (var q = 0; q < 4; q++) {
        var nx = cells[c].x + DIRS[q][0], ny = cells[c].y + DIRS[q][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var kk = key(nx, ny);
        if (owner[kk] || hazard[kk]) continue;
        cand.push({ x: nx, y: ny });
      }
    }
    return cand;
  }

  // 用「实际非禁区格数 free」收口块数窗口。
  // free 格切成 p 块且每块 1..MAX_PIECE_CELLS 格、恰好铺满，等价于 free 可写成 p 个 1..4 之和：
  //   ceil(free / 4) <= p <= free
  // 再叠加「单格块至多 MAX_SINGLE 个、其余块至少 2 格」得到更紧的上界。
  // 参数表请求的 [pmin, pmax] 与之求交；交集为空时退回最接近的可行值（优先保住参数表区间端）。
  function clampWindow(free, pmin, pmax) {
    if (free < 1) return null;
    var loFeas = Math.ceil(free / MAX_PIECE_CELLS);
    var hiFeas = Math.floor((free + MAX_SINGLE) / 2);   // 除单格块外每块至少 2 格
    if (hiFeas < loFeas) hiFeas = loFeas;
    var lo = Math.max(pmin, loFeas), hi = Math.min(pmax, hiFeas);
    if (lo > hi) {                                      // 交集空：向可行域收敛，且不越出请求区间两侧太远
      if (pmax < loFeas) { lo = loFeas; hi = loFeas; }
      else { lo = hiFeas; hi = hiFeas; }
    }
    if (hi > free) hi = free;
    if (lo > hi) lo = hi;
    if (hi < 1) return null;
    return { lo: lo, hi: hi };
  }

  // 把非禁区格随机"种子生长"划分成 1..4 格连通块。
  // 目标块数由总格数反推并夹到 [MIN_PIECES, MAX_PIECES]，
  // 生长时按剩余格数动态决定本块大小，避免末段大量零散孤格。
  function partition(rnd, cols, rows, hazard, minBlocks, maxBlocks) {
    var free = [], x, y, i;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (!hazard[key(x, y)]) free.push({ x: x, y: y });
    var total = free.length;
    if (!total) return [];
    for (i = total - 1; i > 0; i--) { // 随机种子顺序
      var j = Math.floor(rnd() * (i + 1)), t = free[i]; free[i] = free[j]; free[j] = t;
    }
    // 窗口已由 attempt 按 free 收口；这里只做一次防御性复查
    var win = clampWindow(total, minBlocks, maxBlocks);
    if (!win) return null;
    var want = pickWant(rnd, win.lo, win.hi);
    var owner = {}, groups = [], remaining = total;
    for (i = 0; i < free.length; i++) {
      var seed = free[i];
      if (owner[key(seed.x, seed.y)]) continue;
      var left = want - groups.length;                 // 还剩几块要放
      if (left <= 0) return null;                      // 配额已满却仍有未覆盖格 -> 本次划分作废
      var maxHere = Math.min(MAX_PIECE_CELLS, remaining - (left - 1)); // 给后续块各留 1 格
      if (maxHere < 1) maxHere = 1;
      // 本块目标大小：在 [1, maxHere] 中偏好较大值，减少单格块
      // 本块目标大小：在 [1, maxHere] 中取偏大的值，偶尔留小块增加形状多样性
      var target = maxHere <= 1 ? 1 : 1 + Math.floor(rnd() * maxHere);
      if (rnd() < 0.5) target = maxHere;               // 一半概率吃满上限（减少单格块）
      var cells = [{ x: seed.x, y: seed.y }];
      owner[key(seed.x, seed.y)] = 1;
      remaining--;
      while (cells.length < target) {
        var cand = frontier(cells, owner, hazard, cols, rows);
        if (!cand.length) break;
        var pick = cand[Math.floor(rnd() * cand.length)];
        owner[key(pick.x, pick.y)] = 1;
        remaining--;
        cells.push(pick);
      }
      groups.push(cells);
    }
    return groups;
  }

  // 单局：随机种子 -> 划分 -> 约束校验，返回候选解或 null。
  // 优先用确定性构造的 splitRegion（命中率高、天然连通且不超 4 格），
  // 它偶发失败（网格被禁区切得过碎）时才回落到旧的随机生长 partition。
  function attempt(rnd, cols, rows, hazard, pmin, pmax) {
    var freeCount = 0;
    for (var yy = 0; yy < rows; yy++) for (var xx = 0; xx < cols; xx++) if (!hazard[key(xx, yy)]) freeCount++;
    var win = clampWindow(freeCount, pmin, pmax);
    if (!win) return null;
    var lo = win.lo, hi = win.hi;
    var groups = splitRegion(hazard, cols, rows, rnd, lo, hi);
    if (!groups || !groups.length) groups = partition(rnd, cols, rows, hazard, lo, hi);
    if (!groups || !groups.length) return null;
    if (groups.length < lo || groups.length > hi) return null;
    var single = 0, i;
    for (i = 0; i < groups.length; i++) if (groups[i].length === 1) single++;
    if (single > MAX_SINGLE) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, covered = 0;
    for (i = 0; i < groups.length; i++) {
      for (var c = 0; c < groups[i].length; c++) {
        var p = groups[i][c];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      covered += groups[i].length;
    }
    // 划分必须铺满全部非禁区格（这样行列提示才与解一一对应）
    if (minX !== 0 || minY !== 0 || maxX !== cols - 1 || maxY !== rows - 1) return null;
    if (covered !== freeCount) return null;
    return groups;
  }

  /* ---------------- 关卡组装 ---------------- */

  // 把划分组装成完整 puzzle 对象（含 rows/cols 提示与解）
  function buildPuzzle(cols, rows, hazard, groups, rnd, seedUsed) {
    var grid = [], y, x, i;
    for (y = 0; y < rows; y++) { var row = []; for (x = 0; x < cols; x++) row.push(hazard[key(x, y)] ? BLOCK : EMPTY); grid.push(row); }

    var pieces = [], solution = [];
    for (i = 0; i < groups.length; i++) {
      var cells = normalize(groups[i]);
      pieces.push({ id: 'p' + i, cells: cells, color: rnd() < 0.5 ? 'green' : 'blue' });
      // 生成姿态即正解姿态：锚点 = 该块生成位置包围盒左上角，rot = 0
      var mx = Infinity, my = Infinity;
      for (var c = 0; c < groups[i].length; c++) {
        if (groups[i][c].x < mx) mx = groups[i][c].x;
        if (groups[i][c].y < my) my = groups[i][c].y;
      }
      solution.push({ id: 'p' + i, x: mx, y: my, rot: 0 });
    }

    // 分色计数：每行/列记录 {green, blue} 两种颜色的目标格数
    var rowHints = [], colHints = [];
    for (y = 0; y < rows; y++) rowHints.push({ green: 0, blue: 0 });
    for (x = 0; x < cols; x++) colHints.push({ green: 0, blue: 0 });
    for (i = 0; i < groups.length; i++) {
      var gc = pieces[i].color === 'blue' ? 'blue' : 'green';
      for (var gc2 = 0; gc2 < groups[i].length; gc2++) {
        var gx = groups[i][gc2].x, gy = groups[i][gc2].y;
        if (grid[gy][gx] === BLOCK) continue;
        rowHints[gy][gc]++; colHints[gx][gc]++;
      }
    }

    return {
      cols: cols, rows: rows, grid: grid,
      rowHints: rowHints, colHints: colHints,
      pieces: pieces, solution: solution, seedUsed: seedUsed
    };
  }

  /* ---------------- 唯一对外生成入口 ---------------- */

  // 生成必定有解的谜题；solveReject 内部累计（genPuzzle 不返回该字段，统计在 selftest）
  var _solveReject = 0;

  function genPuzzle(cfg) {
    cfg = cfg || {};
    var R = resolveCfg(cfg);
    var cols = R.cols, rows = R.rows, hmin = R.hmin, hmax = R.hmax;
    var minBlocks = R.minBlocks, maxBlocks = R.maxBlocks;
    var seed = normSeed(cfg.seed);
    var puzzle = null, rnd = null;

    for (var r = 0; r < GEN_TRIES; r++) {
      // 重试步长取一个大奇数并做位混淆：若直接用 (seed + r)，
      // seed=0 的第 14 次尝试会与 seed=1 的第 13 次落在同一个值上，
      // 相邻 seed 就会生成出完全相同的关卡。
      rnd = mulberry32((seed ^ Math.imul(r + 1, 0x9E3779B1)) >>> 0);
      var hazard = scatterHazards(rnd, cols, rows, hmin, hmax);
      var groups = attempt(rnd, cols, rows, hazard, minBlocks, maxBlocks);
      if (!groups) continue;
      var cand = buildPuzzle(cols, rows, hazard, groups, rnd, (seed ^ Math.imul(r + 1, 0x9E3779B1)) >>> 0);
      // 防无解检测：把"解"原样放回去，必须判定为已解开
      if (!verifySolution(cand)) { _solveReject++; continue; }
      puzzle = cand; break;
    }

    // 兜底：换一批种子继续试，但始终尊重 hazardMin..hazardMax 契约。
    // 走"构造式 splitRegion"而非随机生长，命中概率远高于主体路径。
    if (!puzzle) {
      for (var r2 = 0; r2 < GEN_TRIES && !puzzle; r2++) {
        rnd = mulberry32((seed + 7919 + r2) >>> 0);
        var hz = scatterHazards(rnd, cols, rows, hmin, hmax);
        var gs = splitRegion(hz, cols, rows, rnd, minBlocks, maxBlocks);
        if (!gs || !gs.length) continue;
        if (gs.length < minBlocks || gs.length > maxBlocks) continue;
        var singleN = 0, si;
        for (si = 0; si < gs.length; si++) if (gs[si].length === 1) singleN++;
        if (singleN > MAX_SINGLE) continue;
        var c2 = buildPuzzle(cols, rows, hz, gs, rnd, (seed + 7919 + r2) >>> 0);
        if (verifySolution(c2)) puzzle = c2;
        else _solveReject++;
      }
    }
    return puzzle;
  }

  // 外层安全网：极端情况下（例如网格过小、种子极不巧）仍保证返回可解关卡。
  // 逐次放宽"单格块上限 / 块数区间"等风格约束，但绝不放宽可解性与禁区契约。
  function genPuzzleSafe(cfg) {
    var p = genPuzzle(cfg);
    if (p) return p;
    cfg = cfg || {};
    var R = resolveCfg(cfg);
    for (var relax = 1; relax <= 4 && !p; relax++) {
      var cols = R.cols, rows = R.rows, hmin = R.hmin, hmax = R.hmax;
      var minBlocks = R.minBlocks, maxBlocks = R.maxBlocks;
      var seed = normSeed(cfg.seed);
      var rnd = mulberry32((seed + 31337 * relax) >>> 0);
      var hz = scatterHazards(rnd, cols, rows, hmin, hmax);
      var gs = splitRegion(hz, cols, rows, rnd, minBlocks, maxBlocks);
      if (gs && gs.length) {
        var cand = buildPuzzle(cols, rows, hz, gs, rnd, (seed + 31337 * relax) >>> 0);
        if (verifySolution(cand)) p = cand;
      }
    }
    return p;
  }

  // 确定性划分（构造式，不可能失败）：采用"重划分"策略——
  // 先贪心合并（快速接近目标块数），若停在碎片态（如 [2,2,3,3,4,4,4,4,4]），
  // 则改用"区域二分"把连通区域递归对半切开，直到块数恰好为 want。
  // 二分保证每个区域连通、无重叠、不丢格；只要 want <= 格数就能精确达成。
  function splitRegion(hazard, cols, rows, rnd, minBlocks, maxBlocks) {
    var free = [], x, y;
    for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) if (!hazard[key(x, y)]) free.push({ x: x, y: y });
    var total = free.length;
    if (!total) return null;

    var win = clampWindow(total, typeof minBlocks === 'number' ? minBlocks : MIN_PIECES, typeof maxBlocks === 'number' ? maxBlocks : MAX_PIECES);
    if (!win) return null;
    var want = pickWant(rnd, win.lo, win.hi);

    // 先按连通分量切开，再在每个分量内部二分到目标块数
    var compsGlobal = connectedComponents(free);
    var comps = [], ci;
    for (ci = 0; ci < compsGlobal.length; ci++) comps.push(compsGlobal[ci]);

    // 把 want 块按各分量格数比例分摊（每块至少 1 格、至多 4 格）
    var quota = [], sumQuota = 0;
    for (ci = 0; ci < comps.length; ci++) {
      var q = Math.max(1, Math.round(want * comps[ci].length / total));
      var loQ = Math.ceil(comps[ci].length / MAX_PIECE_CELLS);
      if (q < loQ) q = loQ;
      if (q > comps[ci].length) q = comps[ci].length;
      quota.push(q);
      sumQuota += q;
    }
    // 配额总和可能因取整偏离 want：向方差最大的分量借/还，直到吻合
    var fixGuard = 0;
    while (sumQuota !== want && fixGuard++ < 2000) {
      if (sumQuota < want) {                                // 需要更多块：挑格数最富余的分量 +1
        var bi = -1, bSlack = 0;
        for (ci = 0; ci < comps.length; ci++) {
          var slack = comps[ci].length - quota[ci];         // 还能拆出几块（每块至少 1 格）
          if (slack > bSlack) { bSlack = slack; bi = ci; }
        }
        if (bi < 0) break;
        quota[bi]++; sumQuota++;
      } else {                                              // 需要更少块：挑块数最多的分量 -1
        var bj = -1, bQ = 1;
        for (ci = 0; ci < comps.length; ci++) {
          if (quota[ci] - 1 >= Math.ceil(comps[ci].length / MAX_PIECE_CELLS) && quota[ci] > bQ) { bQ = quota[ci]; bj = ci; }
        }
        if (bj < 0) break;
        quota[bj]--; sumQuota--;
      }
    }
    if (sumQuota !== want) return null;

    // 逐分量：反复把"最大且 >=2 格"的区域对半切开，直到达到配额
    var out = [];
    for (ci = 0; ci < comps.length; ci++) {
      var parts = [comps[ci]];
      var need = quota[ci];
      var bisectGuard = 0;
      while (parts.length < need && bisectGuard++ < 5000) {
        var bi2 = -1, bs2 = 1;
        for (var i2 = 0; i2 < parts.length; i2++) if (parts[i2].length > bs2) { bs2 = parts[i2].length; bi2 = i2; }
        if (bi2 < 0) break;                                 // 已无可切区域
        var reg = parts[bi2];
        // 沿长边方向排序后对半切（按行或按列），保证两半各自连通
        var w = 0, h = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (var c3 = 0; c3 < reg.length; c3++) {
          if (reg[c3].x < minX) minX = reg[c3].x;
          if (reg[c3].x > maxX) maxX = reg[c3].x;
          if (reg[c3].y < minY) minY = reg[c3].y;
          if (reg[c3].y > maxY) maxY = reg[c3].y;
        }
        w = maxX - minX + 1; h = maxY - minY + 1;
        // 切点不取正中：在保证两半都连通的前提下，随机选择切点与切轴，
        // 否则同一网格布局每次都会切出完全相同的划分（相邻 seed 结果雷同）。
        var half = Math.floor(reg.length / 2);
        if (reg.length >= 4) {
          var spread = Math.max(1, Math.floor(reg.length / 4));
          half = Math.floor(reg.length / 2) + Math.floor(rnd() * (2 * spread + 1)) - spread;
          if (half < 1) half = 1;
          if (half > reg.length - 1) half = reg.length - 1;
        }
        // 优先沿长边切；任一轴切出的两半若不连通（U 形等），换另一轴再试
        var order = (h >= w) ? ['row', 'col'] : ['col', 'row'];
        if (rnd() < 0.35) order = [order[1], order[0]];   // 偶尔逆着长边切，增加形状多样性
        var halves = null;
        for (var oi = 0; oi < order.length && !halves; oi++) {
          var sorted = reg.slice();
          if (order[oi] === 'row') sorted.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
          else sorted.sort(function (a, b) { return a.x - b.x || a.y - b.y; });
          var h1 = sorted.slice(0, half), h2 = sorted.slice(half);
          if (isConnected(h1) && isConnected(h2)) halves = [h1, h2];
        }
        // 两轴都不连通：用 BFS 生长出恰好 half 格的连通前缀，余下即为另一半
        // （余下部分可能不连通，那就再多切一次，直到全部连通）
        if (!halves) {
          // 用 BFS 生长出恰好 half 格的连通前缀；余下部分若被切成多个连通分量，
          // 就把它们都收下（都连通），只是本次产出多于 2 个部分。
          var grown = bfsPrefix(reg.slice(), half);
          var inGrown = {};
          for (var gg = 0; gg < grown.length; gg++) inGrown[key(grown[gg].x, grown[gg].y)] = 1;
          var restArr = [];
          for (var rr = 0; rr < reg.length; rr++) if (!inGrown[key(reg[rr].x, reg[rr].y)]) restArr.push(reg[rr]);
          var restComps = connectedComponents(restArr);
          halves = [grown];
          for (var rc = 0; rc < restComps.length; rc++) halves.push(restComps[rc]);
        }
        parts.splice(bi2, 1);
        for (var hh = 0; hh < halves.length; hh++) parts.push(halves[hh]);
      }
      if (parts.length !== need) return null;
      for (var p3 = 0; p3 < parts.length; p3++) out.push(parts[p3]);
    }

    // 二分产物每块格数可能 >4（长条分量），统一拆回 1..4 格连通块。
    // bfsPrefix 只在输入连通时保证输出连通，因此每次取完前缀后都对残余部分
    // 重新求连通分量，逐分量继续切——否则残余可能已被切成多片，
    // 再对它调 bfsPrefix 会产出"看起来是一块、实则不连通"的碎片。
    var norm = [], ni;
    for (ni = 0; ni < out.length; ni++) {
      var queue = [out[ni]];
      while (queue.length) {
        var cur = queue.shift();
        if (cur.length <= MAX_PIECE_CELLS) { norm.push(cur); continue; }
        var take = bfsPrefix(cur, MAX_PIECE_CELLS);
        norm.push(take);
        // 残余部分可能不连通：拆成连通分量后各自入队
        var remain = [], inTake = {};
        for (var tk = 0; tk < take.length; tk++) inTake[key(take[tk].x, take[tk].y)] = 1;
        for (var cu = 0; cu < cur.length; cu++) if (!inTake[key(cur[cu].x, cur[cu].y)]) remain.push(cur[cu]);
        var remComps = connectedComponents(remain);
        for (var rc2 = 0; rc2 < remComps.length; rc2++) queue.push(remComps[rc2]);
      }
    }
    // 终检：块数在区间内，且每块 1..4 格、连通——任一不满足即弃用本次划分
    if (norm.length < win.lo || norm.length > win.hi) return null;
    for (ni = 0; ni < norm.length; ni++) {
      if (norm[ni].length < 1 || norm[ni].length > MAX_PIECE_CELLS) return null;
      if (!isConnected(norm[ni])) return null;
    }
    return norm;
  }
  // 连通分量拆分
  function connectedComponents(cells) {
    var set = {}, i;
    for (i = 0; i < cells.length; i++) set[key(cells[i].x, cells[i].y)] = cells[i];
    var seen = {}, out = [];
    for (i = 0; i < cells.length; i++) {
      var ks = key(cells[i].x, cells[i].y);
      if (seen[ks]) continue;
      var comp = [], stack = [cells[i]];
      seen[ks] = 1;
      while (stack.length) {
        var c = stack.pop(); comp.push(c);
        for (var q = 0; q < 4; q++) {
          var kk = key(c.x + DIRS[q][0], c.y + DIRS[q][1]);
          if (set[kk] && !seen[kk]) { seen[kk] = 1; stack.push(set[kk]); }
        }
      }
      out.push(comp);
    }
    return out;
  }

  // 从区域内取一个连通前缀（BFS 生长 take 格），返回块并从 rest 中移除这些格
  function bfsPrefix(rest, take) {
    var idx = {}, i, k;
    for (i = 0; i < rest.length; i++) idx[key(rest[i].x, rest[i].y)] = i;
    var start = 0, group = [], queued = {};
    var startCell = rest[0];
    group.push(startCell);
    queued[key(startCell.x, startCell.y)] = 1;
    var head = 0;
    while (group.length < take && head < group.length) {
      var c = group[head++];
      for (var q = 0; q < 4; q++) {
        var kk = key(c.x + DIRS[q][0], c.y + DIRS[q][1]);
        if (idx[kk] === undefined || queued[kk]) continue;
        queued[kk] = 1;
        group.push(rest[idx[kk]]);
        if (group.length >= take) break;
      }
    }
    var drop = {};
    for (i = 0; i < group.length; i++) drop[key(group[i].x, group[i].y)] = 1;
    var left = [];
    for (i = 0; i < rest.length; i++) if (!drop[key(rest[i].x, rest[i].y)]) left.push(rest[i]);
    rest.length = 0;
    for (i = 0; i < left.length; i++) rest.push(left[i]);
    return group;
  }

  // 用接口自身的规则模拟"逐块摆放整份解"，校验 allPlaced && rowsOk && colsOk
  function verifySolution(puzzle) {
    var placed = {};
    for (var i = 0; i < puzzle.solution.length; i++) {
      var s = puzzle.solution[i], pc = getPiece(puzzle, s.id);
      if (!pc) return false;
      var cells = rotateBy(pc.cells, s.rot);
      var res = canPlace(puzzle, placed, s.id, cells, s.x, s.y);
      if (!res.ok) return false;
      placed = place(puzzle, placed, s.id, cells, s.x, s.y);
    }
    var st = checkSolved(puzzle, placed);
    return !!(st.allPlaced && st.rowsOk && st.colsOk && st.solved);
  }

  function getPiece(puzzle, id) {
    for (var i = 0; i < puzzle.pieces.length; i++) if (puzzle.pieces[i].id === id) return puzzle.pieces[i];
    return null;
  }

  /* ---------------- 放置规则 ---------------- */

  // 绝对占格坐标（无越界检查，仅做平移）
  function absCells(cells, ax, ay) {
    var out = [], i;
    for (i = 0; i < cells.length; i++) out.push({ x: ax + cells[i].x, y: ay + cells[i].y });
    return out;
  }

  function placedKeys(placed) {
    var map = {}, id;
    for (id in placed) {
      if (!Object.prototype.hasOwnProperty.call(placed, id)) continue;
      var cs = placed[id].cells, i;
      for (i = 0; i < cs.length; i++) map[key(cs[i].x, cs[i].y)] = id;
    }
    return map;
  }

  function canPlace(puzzle, placed, pieceId, cells, ax, ay) {
    if (!puzzle || !cells || !cells.length) return { ok: false, reason: 'empty' };
    var occ = placedKeys(placed || {}), i;
    for (i = 0; i < cells.length; i++) {
      var x = ax + cells[i].x, y = ay + cells[i].y;
      if (x < 0 || y < 0 || x >= puzzle.cols || y >= puzzle.rows) return { ok: false, reason: 'out-of-bounds' };
      if (puzzle.grid[y][x] === BLOCK) return { ok: false, reason: 'hazard' };
      var k = key(x, y);
      if (occ[k] && occ[k] !== pieceId) return { ok: false, reason: 'occupied' };
    }
    return { ok: true, reason: 'ok' };
  }

  // 放置：返回新 placed，不修改入参
  function place(puzzle, placed, pieceId, cells, ax, ay) {
    var next = {}, id;
    for (id in placed) {
      if (Object.prototype.hasOwnProperty.call(placed, id)) {
        next[id] = { x: placed[id].x, y: placed[id].y, cells: cloneCells(placed[id].cells) };
      }
    }
    next[pieceId] = { x: ax, y: ay, cells: absCells(cells, ax, ay) };
    return next;
  }

  // 移除：返回新 placed，不修改入参
  function remove(placed, pieceId) {
    var next = {}, id;
    for (id in placed) {
      if (!Object.prototype.hasOwnProperty.call(placed, id)) continue;
      if (id === pieceId) continue;
      next[id] = { x: placed[id].x, y: placed[id].y, cells: cloneCells(placed[id].cells) };
    }
    return next;
  }

  // 逐行 / 逐列统计当前占用的分色计数：{rows:[{green,blue}], cols:[{green,blue}]}
  // （禁区天然不会被占，不计入）
  function rowColCounts(puzzle, placed) {
    var rowsA = [], colsA = [], y, x;
    for (y = 0; y < puzzle.rows; y++) rowsA.push({ green: 0, blue: 0 });
    for (x = 0; x < puzzle.cols; x++) colsA.push({ green: 0, blue: 0 });
    var occ = placedKeys(placed || {});
    for (y = 0; y < puzzle.rows; y++) {
      for (x = 0; x < puzzle.cols; x++) {
        if (puzzle.grid[y][x] === BLOCK) continue;
        var pid = occ[key(x, y)];
        if (!pid) continue;
        var col = pieceColorOf(puzzle, pid) === 'blue' ? 'blue' : 'green';
        rowsA[y][col]++; colsA[x][col]++;
      }
    }
    return { rows: rowsA, cols: colsA };
  }

  function pieceColorOf(puzzle, id) {
    var pc = getPiece(puzzle, id);
    return (pc && pc.color) || 'green';
  }

  // 提示值的容错读取：兼容旧的总计数写法（number）与新的分色写法（{green,blue}）
  function hintOf(h, c) {
    if (typeof h === 'number') return c === 'green' ? h : 0;
    if (!h) return 0;
    return h[c] || 0;
  }

  function checkSolved(puzzle, placed) {
    var allPlaced = true, i;
    for (i = 0; i < puzzle.pieces.length; i++) {
      if (!placed || !placed[puzzle.pieces[i].id]) { allPlaced = false; break; }
    }
    var rc = rowColCounts(puzzle, placed || {});
    var rowsOk = true, colsOk = true;
    for (i = 0; i < puzzle.rows; i++) {
      if (rc.rows[i].green !== hintOf(puzzle.rowHints[i], 'green') ||
          rc.rows[i].blue !== hintOf(puzzle.rowHints[i], 'blue')) { rowsOk = false; break; }
    }
    for (i = 0; i < puzzle.cols; i++) {
      if (rc.cols[i].green !== hintOf(puzzle.colHints[i], 'green') ||
          rc.cols[i].blue !== hintOf(puzzle.colHints[i], 'blue')) { colsOk = false; break; }
    }
    return { allPlaced: allPlaced, rowsOk: rowsOk, colsOk: colsOk, solved: allPlaced && rowsOk && colsOk };
  }

  /* ---------------- 自检 ---------------- */

  // 逐局校验：可解、连通、分色 hints 与解的分色统计逐格吻合
  function checkOne(pz, lv) {
    var j;
    for (j = 0; j < pz.pieces.length; j++) {
      if (pz.pieces[j].cells.length < 1 || pz.pieces[j].cells.length > MAX_PIECE_CELLS)
        throw new Error('piece size out of range at lv ' + lv + ' seed ' + pz.seedUsed);
      if (!isConnected(pz.pieces[j].cells))
        throw new Error('piece not connected at lv ' + lv + ' seed ' + pz.seedUsed + ' ' + pz.pieces[j].id);
    }
    var rcExpect = rowColCounts(pz, replay(pz));
    for (j = 0; j < pz.rows; j++) {
      if (typeof pz.rowHints[j] !== 'object' || pz.rowHints[j] === null) throw new Error('rowHints not colorized at seed ' + pz.seedUsed);
      if (pz.rowHints[j].green !== rcExpect.rows[j].green || pz.rowHints[j].blue !== rcExpect.rows[j].blue)
        throw new Error('rowHint mismatch at lv ' + lv + ' seed ' + pz.seedUsed + ' row ' + j);
    }
    for (j = 0; j < pz.cols; j++) {
      if (typeof pz.colHints[j] !== 'object' || pz.colHints[j] === null) throw new Error('colHints not colorized at seed ' + pz.seedUsed);
      if (pz.colHints[j].green !== rcExpect.cols[j].green || pz.colHints[j].blue !== rcExpect.cols[j].blue)
        throw new Error('colHint mismatch at lv ' + lv + ' seed ' + pz.seedUsed + ' col ' + j);
    }
    var st = checkSolved(pz, replay(pz));
    if (!st.solved) throw new Error('unsolvable puzzle at lv ' + lv + ' seed ' + pz.seedUsed);
  }

  // 5 档各 n 局（默认 60/档 = 300 局）；每档独立统计 solveReject / colorized / 块数
  function selftest(n) {
    n = Math.max(1, Math.floor(n || 60));
    var out = { generated: 0, solveReject: 0, colorized: true, singleCellBlocks: 0, avgPieces: 0, perLevel: [], samples: [] };
    var pieceSum = 0, lv, i;
    for (lv = 1; lv <= 5; lv++) {
      var L = levelOf(lv);
      var before = _solveReject, gen = 0, psum = 0;
      for (i = 0; i < n; i++) {
        var pz = genPuzzle({ lv: lv, seed: 1000 + lv * 100000 + i * 37 });
        gen++; psum += pz.pieces.length;
        if (pz.cols !== L.cols || pz.rows !== L.rows)
          throw new Error('grid mismatch at lv ' + lv + ' seed ' + pz.seedUsed);
        for (var j = 0; j < pz.pieces.length; j++) {
          if (pz.pieces[j].cells.length === 1) out.singleCellBlocks++;
        }
        checkOne(pz, lv);
        if (lv === 1 && i < 2) out.samples.push(pz);
      }
      out.perLevel.push({
        lv: lv, cols: L.cols, rows: L.rows,
        piecesMin: L.piecesMin, piecesMax: L.piecesMax,
        generated: gen, solveReject: _solveReject - before,
        colorized: true, avgPieces: +(psum / gen).toFixed(3)
      });
      out.generated += gen; pieceSum += psum;
    }
    out.avgPieces = pieceSum / out.generated;
    out.solveReject = _solveReject;
    return out;
  }

  // 按 solution 重放一遍，得到 placed 结构（供 checkSolved 使用）
  function replay(puzzle) {
    var placed = {};
    for (var i = 0; i < puzzle.solution.length; i++) {
      var s = puzzle.solution[i];
      placed = place(puzzle, placed, s.id, rotateBy(getPiece(puzzle, s.id).cells, s.rot), s.x, s.y);
    }
    return placed;
  }

  var API = {
    genPuzzle: genPuzzleSafe,
    genPuzzleRaw: genPuzzle,
    rotateShape: rotateShape,
    flipShape: flipShape,
    canPlace: canPlace,
    place: place,
    remove: remove,
    rowColCounts: rowColCounts,
    checkSolved: checkSolved,
    selftest: selftest,
    levelParams: function (lv) {
      var L = levelOf(lv);
      return { lv: L.lv, cols: L.cols, rows: L.rows, hazardMin: L.hazardMin, hazardMax: L.hazardMax,
        piecesMin: L.piecesMin, piecesMax: L.piecesMax, specPiecesMin: L.specPiecesMin, specPiecesMax: L.specPiecesMax };
    },
    LEVELS: LEVELS.slice(),
    COLORIZED: true
  };
  return API;
});

// Node 直接运行：执行 selftest(300) 并打印统计
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  var _r = module.exports.selftest(60);   // 5 档 × 60 局 = 300 局
  console.log('=== puzzle2-core selftest(60/level, 5 levels = ' + _r.generated + ' puzzles) ===');
  for (var _li = 0; _li < _r.perLevel.length; _li++) {
    var _L = _r.perLevel[_li];
    console.log('V' + _L.lv + '  ' + _L.cols + 'x' + _L.rows + '  pieces ' + _L.piecesMin + '-' + _L.piecesMax
      + '  generated=' + _L.generated + '  solveReject=' + _L.solveReject
      + '  colorized=' + _L.colorized + '  avgPieces=' + _L.avgPieces.toFixed(3));
  }
  console.log('generated        = ' + _r.generated);
  console.log('solveReject      = ' + _r.solveReject);
  console.log('colorized        = ' + _r.colorized);
  console.log('singleCellBlocks = ' + _r.singleCellBlocks);
  console.log('avgPieces        = ' + _r.avgPieces.toFixed(3));
  console.log('samples          = ' + _r.samples.length + ' (first puzzle objects)');
  console.log('sample0 pieces   = ' + JSON.stringify(_r.samples[0].pieces.map(function (p) { return { id: p.id, n: p.cells.length, c: p.color }; })));
  console.log('sample0 hints    = rows ' + JSON.stringify(_r.samples[0].rowHints) + ' cols ' + JSON.stringify(_r.samples[0].colHints));
  console.log('sample0 sol      = ' + JSON.stringify(_r.samples[0].solution));
}
