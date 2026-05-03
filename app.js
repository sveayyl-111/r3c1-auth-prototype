/* R3C1 Authorization Prototype v5 — mobile shopping app
   Spec source: instruments/figma_prototype_spec.md (Round 10)
   Decisions locked (2026-04-28):
     1. Indigo gradient aesthetic, ✨ AI mark
     2. PC center renders 414x896 phone frame
     3. Generic "AI 购物助手" name (no fake brand)
     4. **Welcome split into 3 pages (v5)**: A=what is this / B=who you're buying for / C=preview+cue+start
     5. Shopping preference setup screen (4 options) before authorization
     6. Focal-category pick (1 of 8) — entire compare/shortlist/select/order/sub/replenish demo locked to this category
     7. 3-tier auth flow (browse / order / long-term mgmt) with tier intro pages
     8. **All 8 auth item titles in question form (v5)**: "是否允许 AI 助手 [X]?" instead of declarative
     9. Recourse cue exposure: welcome-C anchor → persistent ambient banner → confirm anchor
     10. auth_6_pay = 4-level payment-authorization ladder (ordinal 0-3)
     11. **Monthly cap = ALL-CATEGORY total (v5)**: explicitly framed as cross-category cumulative budget, NOT focal-category-only — avoids cap value being anchored to focal product unit price
     12. Anti-cheat = 3 mechanisms: phone frame + cue triple exposure + back-to-modify count
   Primary DV: final_breadth_sum (0–10 composite) = 7 binary + ladder_level (0-3)
*/

(() => {
  'use strict';

  // ============================== CONFIG ==============================
  const TOOL_VERSION = "v5.0_2026-04-28";

  // OPTIONAL serverless logging endpoint (null = self-contained mode).
  const LOGGING_ENDPOINT = null;

  // Credamo "return" URL fallback (best practice: pass via ?return=...)
  const FALLBACK_RETURN_URL = "https://www.credamo.com/";

  // Anchor exposure for payment cap (constant across cells/cues — non-confounding)
  const PAY_CAP_ANCHOR = "普通家庭日用品 + 营养食补 + 其它常买类目合计约 ¥1000–¥2000/月（仅供参考）";

  // Total logical pages: 0..18 (3 welcome + preference + focal-pick + 3 tier intros + 8 auth + cap + confirm + end = 19 + redirect guard 20)
  const TOTAL_PAGES = 20;

  // ============================== SHOPPING PREFERENCES ==============================
  // 4 options held constant across cells/cues. User MUST pick one (default highlighted = cost_effective).
  // Pre-registered as descriptive covariate, not in H1-H3 primary models.
  const PREFERENCES = [
    { id: "cost_effective", icon: "💰", label: "性价比优先",      sub: "在质量过得去的前提下，优先选最划算的" },
    { id: "quality",        icon: "✨", label: "品质优先",         sub: "优先选评分高、口碑好的，可接受较高价格" },
    { id: "speed",          icon: "🚚", label: "配送速度优先",      sub: "优先选当日 / 次日达；价格次要" },
    { id: "brand_trust",    icon: "🏛️", label: "大品牌信任优先",   sub: "优先选熟悉的知名品牌，回避新兴品牌" }
  ];
  const DEFAULT_PREFERENCE = "cost_effective";

  // ============================== AUTH ITEMS ==============================
  // type:
  //   "binary"  → allow / deny radio buttons (records auth_choices[id].final_choice)
  //   "ladder"  → 4-level ordinal payment-authorization ladder (records auth_choices[id].ladder_level 0-3)
  // hold: hold-to-confirm 2s gate on the most permissive choice (allow for binary, level-3 for ladder)
  const AUTH_ITEMS = [
    // Tier 1: 浏览与比较 (browse) — low friction
    { id: "auth_1_search",     tier: "search",         tierGroup: 1, icon: "🔍",
      type: "binary",
      title: "是否允许 AI 助手搜索多个平台的候选商品？",
      sub:   "AI 助手将在多个购物平台同时搜索符合您需求的商品。",
      detail: [
        "<strong>工作方式：</strong>AI 助手可在淘宝、京东、拼多多等平台同时搜索符合您需求的商品。",
        "<strong>您的控制：</strong>这是基础浏览权限，您可以随时在「我的 → AI 助手」中关闭。",
        "<strong>隐私：</strong>搜索过程不会上传您的账号或支付信息。"
      ],
      hold: false
    },
    { id: "auth_2_compare",    tier: "compare",        tierGroup: 1, icon: "⚖️",
      type: "binary",
      title: "是否允许 AI 助手比较同类目内主要候选品牌的价格、销量和评价？",
      sub:   "AI 助手将在同一品类内汇总主要候选品牌的价格、销量、评分与近期评价。",
      detail: [
        "<strong>工作方式：</strong>AI 助手按品类锁定后，对该品类内主要候选品牌进行价格 / 销量 / 评分对比（通常 5 个左右）。",
        "<strong>您的控制：</strong>对比结果将在结果页展示，您可查看完整明细。"
      ],
      hold: false
    },
    { id: "auth_3_shortlist",  tier: "compare",        tierGroup: 1, icon: "📋",
      type: "binary",
      title: "是否允许 AI 助手自动筛选到 3 个候选？",
      sub:   "AI 助手根据综合评分筛选出排名前 3 的候选商品。",
      detail: [
        "<strong>工作方式：</strong>AI 助手按性价比综合分（价格 + 评分 + 销量加权）筛出 Top 3 候选。",
        "<strong>您的控制：</strong>您仍可查看完整搜索列表，并随时手动覆盖 AI 的筛选结果。"
      ],
      hold: false
    },

    // Tier 2: 下单与支付 (place_order)
    { id: "auth_4_select",     tier: "place_order",    tierGroup: 2, icon: "✅",
      type: "binary",
      title: "是否允许 AI 助手在您设定规则内自动选最终 SKU？",
      sub:   "AI 助手按您设定的规则从候选中选出最终下单的 SKU。",
      detail: [
        "<strong>工作方式：</strong>AI 助手按您选择的规则（价格优先 / 销量优先 / 评分优先）从 Top 3 候选中选出最终商品。",
        "<strong>您的控制：</strong>您可以在每次下单前预览 AI 的最终选择并撤回。"
      ],
      hold: false
    },
    { id: "auth_5_order",      tier: "place_order",    tierGroup: 2, icon: "🛒",
      type: "binary",
      title: "是否允许 AI 助手直接下单？",
      sub:   "选定商品后 AI 助手将直接提交订单，无需您再次确认。",
      detail: [
        "<strong>工作方式：</strong>AI 助手将自动填写收货地址、提交订单。",
        "<strong>您的控制：</strong>订单详情可在「我的 → 订单」中查看，下单 30 分钟内可取消。",
        "<strong>不涉及：</strong>本权限不包含支付授权（支付权限单独开通）。"
      ],
      hold: false
    },
    { id: "auth_6_pay",        tier: "place_order",    tierGroup: 2, icon: "💳",
      type: "ladder",
      title: "您允许 AI 助手在多大金额范围内自动支付？",
      sub:   "请从下方 4 个梯度中选 1 项。",
      detail: [
        "<strong>工作方式：</strong>AI 助手在您选定的金额阈值内使用绑定支付方式（支付宝 / 微信 / 银行卡）自动支付；超出阈值的订单仍需您手动确认。",
        "<strong>独立于支付额度：</strong>下一页的「最高单次自动支付额度」是另一个独立的总额上限，二者同时生效。",
        "<strong>通知：</strong>每笔自动支付都会发送通知到您的微信。",
        "<strong>您的控制：</strong>您可以随时在「我的 → AI 助手」中调整或关闭此权限。"
      ],
      hold: false,
      ladder: [
        { level: 0, label: "每次都让我确认",       sub: "即使 ¥10 的订单也要先问我" },
        { level: 1, label: "单笔 ≤ ¥100 才自动付款", sub: "超过 ¥100 的订单仍需我确认" },
        { level: 2, label: "单笔 ≤ ¥500 才自动付款", sub: "超过 ¥500 的订单仍需我确认" },
        { level: 3, label: "任意金额都可自动付款",  sub: "在我设的总额度内 AI 全权决定" }
      ]
    },

    // Tier 3: 长期管理 (auto_replenish)
    { id: "auth_7_substitute", tier: "auto_replenish", tierGroup: 3, icon: "🔄",
      type: "binary",
      title: "是否允许 AI 助手在商品缺货时自动替换同类目内的另一品牌？",
      sub:   "原商品缺货时 AI 助手将自动选择同类目内评分相近的另一品牌。",
      detail: [
        "<strong>工作方式：</strong>如原品牌缺货，AI 助手将选择同类目内评分最高的另一品牌下单（例如同款含钙奶粉的另一品牌）。",
        "<strong>您的控制：</strong>替换订单将在「我的 → 订单」中标注为「自动替换」，您可在收货前 24 小时内拒绝并取消。",
        "<strong>边界：</strong>替换商品需与原商品类目和功能一致，价格不超过原商品的 ±20%。"
      ],
      hold: false
    },
    { id: "auth_8_replenish",  tier: "auto_replenish", tierGroup: 3, icon: "📅",
      type: "binary",
      title: "是否允许 AI 助手对您选的这一类产品开启每月自动补货？",
      sub:   "AI 助手将根据使用频率对您本次 demo 选定的那一类产品按月自动补货。",
      detail: [
        "<strong>工作方式：</strong>仅对您本次选的这一类产品（如「中老年高钙奶粉」）每月自动补货 1 次；其它类目不在此自动补货范围内。",
        "<strong>补货日历：</strong>您可以在「我的 → AI 助手 → 补货日历」中查看下次补货时间，并随时取消任意一次。",
        "<strong>您的控制：</strong>每次补货前 3 天会发送预告通知；您可随时跳过或取消。",
        "<strong>边界：</strong>仅本类目；如需扩展到其它类目，需另外开通。"
      ],
      hold: false
    }
  ];

  // ============================== CATEGORY POOL (Round 6 — 8 categories × 3 cells) ==============================
  // Across-cell constant: 8 categories. Within each, SKU + brand age-graded per cell.
  // Prices matched within ±20% across cells per category to avoid cell × payment-norm confound.
  // Locked at preregistration; aligned with paper §4.4 / OSF Appendix A2.
  const CATEGORIES = [
    { id: "vit",     icon: "🍬", bg: "#FEF3C7",
      nameByCell: { self: "成人复合维生素软糖", older_parent: "中老年复合维生素", minor_child: "儿童维生素软糖" },
      priceByCell: { self: 78,  older_parent: 88,  minor_child: 68 },
      origByCell:  { self: 98,  older_parent: 118, minor_child: 88 },
      metaByCell:  { self: "60 粒 · 月销 5w+", older_parent: "90 粒 · 银发款", minor_child: "60 粒 · 4-12 岁" } },
    { id: "milk",    icon: "🥛", bg: "#DBEAFE",
      nameByCell: { self: "成人高钙奶粉", older_parent: "中老年高钙奶粉", minor_child: "儿童成长奶粉" },
      priceByCell: { self: 168, older_parent: 188, minor_child: 178 },
      origByCell:  { self: 220, older_parent: 240, minor_child: 230 },
      metaByCell:  { self: "900g · 罐装", older_parent: "900g · 加钙加铁", minor_child: "900g · 3-7 岁配方" } },
    { id: "prob",    icon: "🦠", bg: "#D1FAE5",
      nameByCell: { self: "成人益生菌冲剂", older_parent: "中老年益生菌冲剂", minor_child: "婴幼儿益生菌冲剂" },
      priceByCell: { self: 88,  older_parent: 98,  minor_child: 108 },
      origByCell:  { self: 118, older_parent: 128, minor_child: 138 },
      metaByCell:  { self: "30 袋 · 200 亿活菌", older_parent: "30 袋 · 中老年配方", minor_child: "30 袋 · 婴幼儿适用" } },
    { id: "dha",     icon: "🐟", bg: "#FEE2E2",
      nameByCell: { self: "深海鱼油 Omega-3", older_parent: "中老年深海鱼油", minor_child: "儿童藻油 DHA" },
      priceByCell: { self: 158, older_parent: 168, minor_child: 148 },
      origByCell:  { self: 198, older_parent: 218, minor_child: 188 },
      metaByCell:  { self: "100 粒 · 1500mg", older_parent: "100 粒 · 中老年配方", minor_child: "60 粒 · 儿童配方" } },
    { id: "protein", icon: "💪", bg: "#FCE7F3",
      nameByCell: { self: "成人乳清蛋白粉", older_parent: "中老年蛋白粉", minor_child: "儿童成长蛋白粉" },
      priceByCell: { self: 198, older_parent: 218, minor_child: 178 },
      origByCell:  { self: 258, older_parent: 278, minor_child: 228 },
      metaByCell:  { self: "1kg · 香草味", older_parent: "1kg · 中老年配方", minor_child: "500g · 儿童配方" } },
    { id: "tonic",   icon: "🍵", bg: "#FED7AA",
      nameByCell: { self: "黑芝麻糊冲饮", older_parent: "红枣枸杞核桃粉", minor_child: "儿童核桃粉" },
      priceByCell: { self: 58,  older_parent: 68,  minor_child: 58 },
      origByCell:  { self: 88,  older_parent: 98,  minor_child: 88 },
      metaByCell:  { self: "30 包 · 速溶", older_parent: "30 包 · 银发养生", minor_child: "20 包 · 儿童版" } },
    { id: "grain",   icon: "🌾", bg: "#E0F2FE",
      nameByCell: { self: "成人即食燕麦片", older_parent: "中老年八宝粥礼盒", minor_child: "儿童营养米粉" },
      priceByCell: { self: 68,  older_parent: 78,  minor_child: 78 },
      origByCell:  { self: 98,  older_parent: 108, minor_child: 108 },
      metaByCell:  { self: "1kg · 高纤维", older_parent: "8 罐礼盒装", minor_child: "500g · 6 月+" } },
    { id: "nuts",    icon: "🥜", bg: "#CFFAFE",
      nameByCell: { self: "综合每日坚果", older_parent: "红枣枸杞核桃礼盒", minor_child: "儿童每日坚果" },
      priceByCell: { self: 88,  older_parent: 98,  minor_child: 98 },
      origByCell:  { self: 128, older_parent: 138, minor_child: 138 },
      metaByCell:  { self: "30 包 · 独立小袋", older_parent: "1kg · 礼盒装", minor_child: "30 包 · 儿童独包" } }
  ];

  // Resolve a category to a flat product object for the active cell.
  function productFor(catId, cell) {
    const c = CATEGORIES.find(x => x.id === catId);
    if (!c) return null;
    return {
      id: c.id, icon: c.icon, bg: c.bg,
      name:  c.nameByCell[cell],
      price: c.priceByCell[cell],
      orig:  c.origByCell[cell],
      meta:  c.metaByCell[cell]
    };
  }
  // 3 brand variants of one category for compare/shortlist (price ±10% within cell).
  function brandsFor(catId, cell) {
    const base = productFor(catId, cell);
    if (!base) return [];
    return [
      { ...base, name: base.name + " · 品牌 A", price: Math.round(base.price * 1.05), orig: Math.round(base.orig * 1.05) },
      { ...base, name: base.name + " · 品牌 B", price: base.price,                     orig: base.orig },
      { ...base, name: base.name + " · 品牌 C", price: Math.round(base.price * 0.92), orig: Math.round(base.orig * 0.92) }
    ];
  }

  // ============================== TIER METADATA ==============================
  const TIERS = {
    1: {
      group: 1,
      label: "浏览与比较",
      icon: "🔎",
      description: "AI 助手将根据您设定的规则浏览候选商品并进行比较。这是基础浏览权限，不涉及任何下单或支付操作。",
      preview: ["搜索多个平台", "比较价格与评价", "筛选出 3 个候选"]
    },
    2: {
      group: 2,
      label: "下单与支付",
      icon: "💼",
      description: "AI 助手将代您完成最终选品、下单、支付。每个权限您都可以单独决定是否允许。",
      preview: ["自动选最终商品", "直接下单", "使用已绑定支付方式付款"]
    },
    3: {
      group: 3,
      label: "长期管理",
      icon: "♻️",
      description: "AI 助手代您处理日常补货与缺货应对。这是开通后助手长期运行的两类权限。",
      preview: ["缺货时自动替换", "每月自动补货"]
    }
  };

  // ============================== CUE TEXTS ==============================
  // Round 4 wording-controlled (paper §4.4 + osf prereg)
  const CUE_TEXT = {
    high: {
      label: "平台担保 / Platform Protection",
      summary: "若 AI 代理下单出错，平台将全额报销相应费用。",
      full: "如果本平台 AI 购物代理代您下单出错，平台将全额报销相应费用；任何退款仍按商家标准退货政策处理。",
      en: "If this platform's AI shopping agent places an incorrect order on your behalf, the platform reimburses you in full; any refund still follows the merchant's standard return policy."
    },
    low: {
      label: "商家条款 / Merchant Terms",
      summary: "若 AI 代理下单出错，相应费用由您承担。",
      full: "如果本平台 AI 购物代理代您下单出错，相应费用由您承担；任何退款仍按商家标准退货政策处理。",
      en: "If this platform's AI shopping agent places an incorrect order on your behalf, you remain financially responsible for the cost; any refund still follows the merchant's standard return policy."
    }
  };

  // ============================== VIGNETTE TEXTS (cell-specific, Round 6 — 月度营养食补) ==============================
  const VIGNETTE = {
    self: {
      icon: "🙋",
      label: "为自己设置",
      title: "为您自己准备 1 个月的日常健康与营养补给",
      sub: "成人复合维生素、含钙奶粉、益生菌、鱼油、蛋白粉、滋补冲饮、营养谷物、坚果礼盒等 8 类。"
    },
    older_parent: {
      icon: "👨‍🦳",
      label: "为高龄父母设置",
      title: "为一位 55 岁以上、已退休或半退休的父母准备 1 个月的健康与营养补给",
      sub: "在征得对方同意的前提下代为购买。中老年维生素 / 高钙奶粉 / 益生菌 / 深海鱼油 / 蛋白粉 / 滋补冲饮 / 八宝粥礼盒 / 红枣枸杞核桃礼盒 等 8 类。"
    },
    minor_child: {
      icon: "🧒",
      label: "为未成年子女设置",
      title: "为一位 18 岁以下、由您日常照料的孩子准备 1 个月的健康与营养补给",
      sub: "儿童维生素 / 成长奶粉 / 婴幼儿益生菌 / 藻油 DHA / 儿童蛋白粉 / 儿童核桃粉 / 儿童营养米粉 / 儿童每日坚果 等 8 类。"
    }
  };

  // Cell label for ambient banner (kept short — only the named beneficiary varies)
  const CELL_LABEL = {
    self:         "为自己购买",
    older_parent: "为长辈购买",
    minor_child:  "为小孩购买"
  };

  // ============================== TRUST SIGNALS (constant across all cells/cues) ==============================
  const TRUST_SIGNALS = [
    { icon: "★",  text: "4.8 (1.2M 评分)" },
    { icon: "🛡️", text: "国家支付清算认证" },
    { icon: "🔒", text: "端到端加密" },
    { icon: "✨", text: "AI 智能引擎" }
  ];

  // ============================== URL PARAMS ==============================
  const urlParams = new URLSearchParams(window.location.search);
  const ctx = {
    pid:          urlParams.get("pid")          || ("anon-" + Math.random().toString(36).slice(2, 10)),
    cell:         urlParams.get("cell")         || "self",
    cue:          urlParams.get("cue")          || "low",
    jurisdiction: urlParams.get("jurisdiction") || "mainland",
    scenario:     urlParams.get("scenario")     || "A",
    return_url:   urlParams.get("return")       || FALLBACK_RETURN_URL,
    return_id:    urlParams.get("return_id")    || "",
    iframe_mode:  urlParams.get("mode") === "iframe" || (window.self !== window.top)
  };
  if (ctx.iframe_mode) document.documentElement.classList.add("in-iframe");
  const _s = ctx.iframe_mode; // short-text flag
  // Validate cell + cue fall back gracefully
  if (!VIGNETTE[ctx.cell]) ctx.cell = "self";
  if (!CUE_TEXT[ctx.cue])  ctx.cue  = "low";

  // ============================== STATE ==============================
  const STATE_KEY = `r3c1_state_v5_${ctx.pid}`;

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.tool_version === TOOL_VERSION) return s;
      }
    } catch (e) { /* fresh */ }
    return freshState();
  }

  function freshState() {
    return {
      tool_version: TOOL_VERSION,
      pid: ctx.pid,
      cell: ctx.cell,
      cue: ctx.cue,
      jurisdiction: ctx.jurisdiction,
      scenario: ctx.scenario,
      preference: null,           // user picks on preference page; null until then
      preference_change_count: 0,
      focal_category: null,       // user picks on focal-category page; null until then
      focal_change_count: 0,
      start_ts: Date.now(),
      current_page_index: 0,
      pages: {},
      auth_choices: {},
      payment_cap: {
        final_value: null,
        slider_adjust_count: 0,
        max_value_seen: 0,
        min_value_seen: 0,
        first_touched: false
      },
      confirm: { back_to_modify_count: 0 },
      cue_interactions: {
        intro:   { expanded: false, expand_count: 0, total_dwell_ms: 0, ack_clicked: false },
        confirm: { expanded: false, expand_count: 0, total_dwell_ms: 0, ack_clicked: false }
      },
      tier_dwells: { 1: {}, 2: {}, 3: {} },
      submission_code: null,
      submitted: false
    };
  }

  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
    catch (e) {}
  }

  let state = loadState();
  if (state.submitted) {
    try { localStorage.removeItem(STATE_KEY); } catch (e) {}
    state = freshState();
  }

  // ============================== PAGE INDEXING ==============================
  // 0:  welcome_a — "What is this" (hero + context-frame)
  // 1:  welcome_b — "Who you're buying for" (vignette)
  // 2:  welcome_c — "Categories preview + cue anchor + trust + start"
  // 3:  preference  (pick 1 of 4 shopping preferences)
  // 4:  focal_pick  (pick 1 of 8 focal nutrition categories)
  // 5:  tier 1 intro
  // 6:  auth_1_search
  // 7:  auth_2_compare
  // 8:  auth_3_shortlist
  // 9:  tier 2 intro
  // 10: auth_4_select
  // 11: auth_5_order
  // 12: auth_6_pay (4-level ladder)
  // 13: tier 3 intro
  // 14: auth_7_substitute
  // 15: auth_8_replenish
  // 16: payment cap
  // 17: confirm summary (with cue reshow)
  // 18: end / submitted
  // 19: redirected
  function pageMeta(idx) {
    const m = [
      { key: "welcome_a",    kind: "welcome_a" },
      { key: "welcome_b",    kind: "welcome_b" },
      { key: "welcome_c",    kind: "welcome_c" },
      { key: "preference",   kind: "preference" },
      { key: "focal_pick",   kind: "focal_pick" },
      { key: "tier_1_intro", kind: "tier_intro", tier: 1 },
      { key: "auth_1_search",     kind: "auth", itemIdx: 0 },
      { key: "auth_2_compare",    kind: "auth", itemIdx: 1 },
      { key: "auth_3_shortlist",  kind: "auth", itemIdx: 2 },
      { key: "tier_2_intro", kind: "tier_intro", tier: 2 },
      { key: "auth_4_select",     kind: "auth", itemIdx: 3 },
      { key: "auth_5_order",      kind: "auth", itemIdx: 4 },
      { key: "auth_6_pay",        kind: "auth", itemIdx: 5 },
      { key: "tier_3_intro", kind: "tier_intro", tier: 3 },
      { key: "auth_7_substitute", kind: "auth", itemIdx: 6 },
      { key: "auth_8_replenish",  kind: "auth", itemIdx: 7 },
      { key: "payment_cap",  kind: "cap" },
      { key: "final_confirm", kind: "confirm" },
      { key: "end",          kind: "end" }
    ];
    return m[idx];
  }

  function enterPage(idx) {
    const meta = pageMeta(idx);
    if (!meta) return;
    const k = meta.key;
    if (!state.pages[k]) state.pages[k] = {};
    state.pages[k].enter_ts = Date.now();
    if (state.pages[k].exit_ts) {
      state.pages[k].back_to_modify = (state.pages[k].back_to_modify || 0) + 1;
    }
    saveState();
  }

  function exitPage(idx) {
    const meta = pageMeta(idx);
    if (!meta) return;
    const k = meta.key;
    if (!state.pages[k]) state.pages[k] = { enter_ts: Date.now() };
    state.pages[k].exit_ts = Date.now();
    saveState();
  }

  function goTo(newIdx) {
    if (newIdx < 0 || newIdx > TOTAL_PAGES) return;
    exitPage(state.current_page_index);
    state.current_page_index = newIdx;
    saveState();
    render();
  }

  // ============================== RENDERING ==============================
  const $app = document.getElementById("app");

  function render() {
    enterPage(state.current_page_index);
    updateAmbientBanner();
    const meta = pageMeta(state.current_page_index);
    if (!meta) return;
    $app.scrollTop = 0;
    switch (meta.kind) {
      case "welcome_a":   return renderWelcomeA();
      case "welcome_b":   return renderWelcomeB();
      case "welcome_c":   return renderWelcomeC();
      case "preference":  return renderPreference();
      case "focal_pick":  return renderFocalPick();
      case "tier_intro":  return renderTierIntro(meta.tier);
      case "auth":        return renderAuthItem(meta.itemIdx);
      case "cap":         return renderPayCap();
      case "confirm":     return renderConfirm();
      case "end":         return renderEnd();
    }
  }

  // ============================== AMBIENT BANNER (Round 6) ==============================
  // Persistent below status bar. Wording symmetric across cells (only beneficiary varies)
  // and across cue conditions (only valence glyph + one verb varies). Read-only reminder;
  // full cue policy text is anchored at welcome and confirm screens (paper §4.4).
  function updateAmbientBanner() {
    const $banner = document.getElementById("ambient-banner");
    if (!$banner) return;
    const cellLabel = CELL_LABEL[ctx.cell] || "";
    const isHigh = ctx.cue === "high";
    const glyph  = isHigh ? "✓" : "✗";
    const cueText = isHigh ? "平台报销" : "您承担";
    $banner.className = `ambient-banner cue-${ctx.cue}`;
    $banner.innerHTML = `
      <div class="ab-left"><span class="ab-icon" aria-hidden="true">👤</span><span>${escapeHtml(cellLabel)}</span></div>
      <div class="ab-right" role="note" aria-label="赔付提示"><span class="ab-glyph" aria-hidden="true">${glyph}</span><span>${escapeHtml(cueText)}</span></div>
    `;
  }

  function bottomAction(html) {
    return `<div class="bottom-action">${html}</div>`;
  }
  const _backW = _s ? '60px' : '100px';

  // ----- Page 0: Welcome A — "What is this" -----
  function renderWelcomeA() {
    const html = `
      <div class="page-content fade-in">
        <div class="step-label">引导 · 1 / 3</div>
        <div class="hero">
          <div class="ai-avatar" aria-hidden="true">✨</div>
          <h1>开通 AI 购物助手</h1>
          <p class="hero-sub">一种能<strong>自动</strong>代您下单的智能代理</p>
        </div>

        <div class="context-frame" role="region" aria-label="情景说明">
          <div class="cf-row"><span class="cf-key">这是什么</span><span class="cf-val">${_s ? '一次授权，<strong>长期自动采购</strong>的 AI 代理。' : 'AI 购物助手是一种<strong>您一次授权、长期为您自动采购</strong>的代理。开通后，它会按您设定的范围在多个购物平台搜索、比价、下单、自动补货——<strong>不需要您每一步都亲自确认</strong>。'}</span></div>
          <div class="cf-row"><span class="cf-key">您要做什么</span><span class="cf-val">${_s ? '设置 <strong>8 项授权</strong>权限。' : '接下来的设置决定 AI 助手能为您做什么、不能做什么。共 <strong>8 项授权</strong>权限。'}</span></div>
          <div class="cf-row"><span class="cf-key">您始终可控</span><span class="cf-val">所有授权可<strong>即时撤销或调整</strong>。</span></div>
        </div>
      </div>

      ${bottomAction(`<button class="btn btn-primary btn-block" id="btn-next">${_s ? '下一步 →' : '下一步：为谁购物 →'}</button>`)}
    `;
    $app.innerHTML = html;
    document.getElementById("btn-next").addEventListener("click", () => goTo(state.current_page_index + 1));
  }

  // ----- Page 1: Welcome B — "Who you're buying for" -----
  function renderWelcomeB() {
    const v = VIGNETTE[ctx.cell];
    const html = `
      <div class="page-content fade-in">
        <div class="step-label">引导 · 2 / 3</div>
        <h1>本次为谁购物</h1>
        <p class="page-subtitle">${_s ? '请阅读以下情景：' : '本次开通是针对一个特定的购物对象。请阅读以下情景：'}</p>

        <div class="vignette-card" role="region" aria-label="本次设置的场景">
          <div class="v-icon" aria-hidden="true">${v.icon}</div>
          <div class="v-text">
            <div class="v-label">${escapeHtml(v.label)}</div>
            <div class="v-title">${escapeHtml(v.title)}</div>
            <div class="v-sub">${escapeHtml(v.sub)}</div>
          </div>
        </div>

        ${_s ? '' : '<p class="page-subtitle" style="margin-top:14px;font-size:13px;color:var(--fg-soft);">在做后面 8 项授权决策时，请始终以这个购物对象为准。屏幕顶部的横条会持续提醒。</p>'}
      </div>

      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-primary" id="btn-next">${_s ? '下一步 →' : '下一步：商品与赔付政策 →'}</button>
      `)}
    `;
    $app.innerHTML = html;
    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));
    document.getElementById("btn-next").addEventListener("click", () => goTo(state.current_page_index + 1));
  }

  // ----- Page 2: Welcome C — "Categories preview + cue + trust + start" -----
  function renderWelcomeC() {
    const html = `
      <div class="page-content fade-in">
        <div class="step-label">引导 · 3 / 3</div>
        <h1>商品与赔付政策</h1>

        <div class="scenario-preview" role="region" aria-label="本月将为您准备的商品">
          <div class="sp-label">${_s ? '8 类营养与食补品（选 1 类体验）' : '本月将为您准备 · 8 类营养与食补品（下一步您将选 1 类作为本次 demo）'}</div>
          <div class="sp-row">
            ${CATEGORIES.map(c => {
              const p = productFor(c.id, ctx.cell);
              return `
              <div class="sp-card">
                <div class="sp-img" style="background: ${p.bg};">${p.icon}</div>
                <div class="sp-name">${escapeHtml(p.name)}</div>
                <div class="sp-price">¥${p.price}</div>
              </div>
            `;}).join("")}
          </div>
        </div>

        ${cueBannerHtml("intro")}

        <div class="trust-row" aria-label="平台资质">
          ${TRUST_SIGNALS.map(t => `<span class="trust-item"><span class="icon">${t.icon}</span>${escapeHtml(t.text)}</span>`).join("")}
        </div>

        <p class="page-subtitle" style="margin-top:8px;">${_s ? '<strong>2 个设置</strong> + <strong>3 步授权</strong>即可完成开通。' : '接下来 <strong>2 个简单设置</strong>（购物偏好 + 选 1 个类目）+ <strong>3 步授权</strong>（浏览 / 下单 / 长期管理）完成开通。'}</p>
      </div>

      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-primary" id="btn-next">开始设置 →</button>
      `)}
    `;
    $app.innerHTML = html;
    bindCueBanner("intro");
    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));
    document.getElementById("btn-next").addEventListener("click", () => goTo(state.current_page_index + 1));
  }

  // ----- Page 1: Preference setup -----
  function renderPreference() {
    const current = state.preference || DEFAULT_PREFERENCE;
    const cardsHtml = PREFERENCES.map(p => `
      <div class="pref-card ${current === p.id ? "selected" : ""}" data-pref="${p.id}">
        <div class="pref-icon" aria-hidden="true">${p.icon}</div>
        <div class="pref-body">
          <div class="pref-label">${escapeHtml(p.label)}</div>
          <div class="pref-sub">${escapeHtml(p.sub)}</div>
        </div>
        <div class="pref-radio"></div>
      </div>
    `).join("");

    const html = `
      <div class="page-content fade-in">
        <div class="step-label">前置设置 · 1 / 2</div>
        <h1>您的购物偏好</h1>
        <p class="page-subtitle">${_s ? '选 1 项，AI 按此规则筛选。' : 'AI 助手在替您选品时会按这条规则筛选。请选 1 项；后续可在「我的 → AI 助手」中调整。'}</p>
        <div class="pref-list">${cardsHtml}</div>
      </div>
      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-primary" id="btn-next">下一步 →</button>
      `)}
    `;
    $app.innerHTML = html;

    let picked = current;
    function paint() {
      document.querySelectorAll(".pref-card").forEach(c => {
        c.classList.toggle("selected", c.dataset.pref === picked);
      });
    }
    paint();

    document.querySelectorAll(".pref-card").forEach(c => {
      c.addEventListener("click", () => {
        const id = c.dataset.pref;
        if (state.preference && state.preference !== id) {
          state.preference_change_count = (state.preference_change_count || 0) + 1;
        }
        picked = id;
        paint();
      });
    });

    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));
    document.getElementById("btn-next").addEventListener("click", () => {
      state.preference = picked;
      saveState();
      goTo(state.current_page_index + 1);
    });
  }

  // ----- Page 2: Focal-category pick -----
  function renderFocalPick() {
    const current = state.focal_category;
    const tilesHtml = CATEGORIES.map(c => {
      const p = productFor(c.id, ctx.cell);
      return `
        <div class="cat-tile ${current === c.id ? "selected" : ""}" data-cat="${c.id}">
          <div class="cat-img" style="background: ${c.bg};">${c.icon}</div>
          <div class="cat-name">${escapeHtml(p.name)}</div>
          <div class="cat-price">¥${p.price}</div>
        </div>
      `;
    }).join("");

    const html = `
      <div class="page-content fade-in">
        <div class="step-label">前置设置 · 2 / 2</div>
        <h1>本次 demo 选 1 类产品</h1>
        <p class="page-subtitle">${_s ? '选 1 类，后续授权以此为例。' : '从下面 8 类营养/食补品中挑 1 类——后续 8 项授权将以您选的<strong>这一类</strong>为例演示 AI 助手如何工作。其它 7 类不在本次 demo 中展示。'}</p>
        <div class="cat-grid">${tilesHtml}</div>
      </div>
      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-primary" id="btn-next" ${current ? "" : "disabled"}>下一步 →</button>
      `)}
    `;
    $app.innerHTML = html;

    let picked = current;
    const $next = document.getElementById("btn-next");
    document.querySelectorAll(".cat-tile").forEach(t => {
      t.addEventListener("click", () => {
        const id = t.dataset.cat;
        if (state.focal_category && state.focal_category !== id) {
          state.focal_change_count = (state.focal_change_count || 0) + 1;
        }
        picked = id;
        document.querySelectorAll(".cat-tile").forEach(x => x.classList.toggle("selected", x.dataset.cat === picked));
        if ($next) $next.disabled = false;
      });
    });

    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));
    $next.addEventListener("click", () => {
      if (!picked) return;
      state.focal_category = picked;
      saveState();
      goTo(state.current_page_index + 1);
    });
  }

  // ----- Tier intro (pages 1, 5, 9) -----
  function renderTierIntro(tierNum) {
    if (!state.tier_dwells[tierNum]) state.tier_dwells[tierNum] = {};
    if (!state.tier_dwells[tierNum].enter_ts) state.tier_dwells[tierNum].enter_ts = Date.now();
    saveState();

    const t = TIERS[tierNum];
    const html = `
      <div class="page-content fade-in">
        <div class="tier-intro">
          <div class="step-label">第 ${tierNum} / 3 步</div>
          <div class="tier-icon" aria-hidden="true">${t.icon}</div>
          <h1>${escapeHtml(t.label)}</h1>
          <p>${escapeHtml(t.description)}</p>
          <ul class="preview-list" aria-label="本步骤包含的权限">
            ${t.preview.map(p => `<li><span class="dot"></span>${escapeHtml(p)}</li>`).join("")}
          </ul>
        </div>
      </div>
      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back">返回</button>
        <button class="btn btn-primary" id="btn-next">开始设置 →</button>
      `)}
    `;
    $app.innerHTML = html;
    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));
    document.getElementById("btn-next").addEventListener("click", () => {
      state.tier_dwells[tierNum].exit_ts = Date.now();
      saveState();
      goTo(state.current_page_index + 1);
    });
  }

  // ----- Auth item pages (2..4, 6..8, 10..11) -----
  function renderAuthItem(itemIdx) {
    const item = AUTH_ITEMS[itemIdx];
    if (item.type === "ladder") return renderLadderAuthItem(itemIdx);
    const tier = TIERS[item.tierGroup];
    // tier-relative item number, 1-indexed
    const tierItemsBefore = AUTH_ITEMS.filter(x => x.tierGroup === item.tierGroup).indexOf(item) + 1;
    const tierItemsTotal  = AUTH_ITEMS.filter(x => x.tierGroup === item.tierGroup).length;

    const prior = state.auth_choices[item.id];
    const currentChoice = prior ? prior.final_choice : null;

    const html = `
      <div class="page-content fade-in auth-page">
        <div class="step-label">第 ${item.tierGroup} 步 · ${escapeHtml(tier.label)} · ${tierItemsBefore} / ${tierItemsTotal}</div>
        <div class="auth-icon" aria-hidden="true">${item.icon}</div>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="auth-sub">${escapeHtml(item.sub)}</p>

        ${authItemContent(item.id)}

        <div class="auth-detail" id="auth-detail">
          <div class="detail-head">
            <span>详细说明</span>
            <span class="chevron">⌄</span>
          </div>
          <div class="detail-body">
            ${item.detail.map(p => `<p>${p}</p>`).join("")}
          </div>
        </div>

        <div class="auth-trust">
          <span class="pellet">🔒 加密传输</span>
          <span class="pellet">✨ AI 助手</span>
          <span class="pellet">📋 可随时关闭</span>
        </div>
      </div>

      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-secondary" id="btn-deny">不允许</button>
        <button class="btn btn-primary" id="btn-allow">允许</button>
      `)}
    `;
    $app.innerHTML = html;

    const detailEl = document.getElementById("auth-detail");
    detailEl.querySelector(".detail-head").addEventListener("click", () => {
      detailEl.classList.toggle("open");
    });

    const $allow = document.getElementById("btn-allow");
    const $deny  = document.getElementById("btn-deny");
    if (currentChoice === "allow") {
      $allow.style.boxShadow = "0 0 0 3px rgba(80, 80, 229, 0.18)";
    } else if (currentChoice === "deny") {
      $deny.style.borderColor = "var(--qwen-primary)";
      $deny.style.color = "var(--qwen-primary)";
    }

    $deny.addEventListener("click",  () => commitChoice("deny"));
    $allow.addEventListener("click", () => commitChoice("allow"));
    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));

    function commitChoice(choice) {
      const prev = state.auth_choices[item.id];
      if (!prev) {
        state.auth_choices[item.id] = { final_choice: choice, change_count: 0 };
      } else {
        if (prev.final_choice !== choice) prev.change_count = (prev.change_count || 0) + 1;
        prev.final_choice = choice;
      }
      saveState();
      goTo(state.current_page_index + 1);
    }
  }

  // ----- Ladder auth item (auth_6_pay) -----
  function renderLadderAuthItem(itemIdx) {
    const item = AUTH_ITEMS[itemIdx];
    const tier = TIERS[item.tierGroup];
    const tierItemsBefore = AUTH_ITEMS.filter(x => x.tierGroup === item.tierGroup).indexOf(item) + 1;
    const tierItemsTotal  = AUTH_ITEMS.filter(x => x.tierGroup === item.tierGroup).length;
    const prior = state.auth_choices[item.id];
    const startLevel = prior && typeof prior.ladder_level === "number" ? prior.ladder_level : null;

    const rowsHtml = item.ladder.map(opt => `
      <div class="pl-row ${startLevel === opt.level ? "selected" : ""}" data-level="${opt.level}">
        <span class="pl-radio"></span>
        <div class="pl-body">
          <div class="pl-title">${escapeHtml(opt.label)}</div>
          <div class="pl-sub">${escapeHtml(opt.sub)}</div>
        </div>
        <span class="pl-level">L${opt.level}</span>
      </div>
    `).join("");

    const html = `
      <div class="page-content fade-in auth-page">
        <div class="step-label">第 ${item.tierGroup} 步 · ${escapeHtml(tier.label)} · ${tierItemsBefore} / ${tierItemsTotal}</div>
        <div class="auth-icon" aria-hidden="true">${item.icon}</div>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="auth-sub">${escapeHtml(item.sub)}</p>

        ${authItemContent(item.id)}

        <div class="pay-ladder" id="pay-ladder">${rowsHtml}</div>

        <div class="auth-detail" id="auth-detail">
          <div class="detail-head">
            <span>详细说明</span>
            <span class="chevron">⌄</span>
          </div>
          <div class="detail-body">
            ${item.detail.map(p => `<p>${p}</p>`).join("")}
          </div>
        </div>

        <div class="auth-trust">
          <span class="pellet">🔒 加密传输</span>
          <span class="pellet">✨ AI 助手</span>
          <span class="pellet">📋 可随时关闭</span>
        </div>
      </div>

      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-primary" id="btn-confirm" ${startLevel === null ? "disabled" : ""}>
          <span id="confirm-label">${startLevel === null ? "请先选择一项" : "确认 →"}</span>
        </button>
      `)}
    `;
    $app.innerHTML = html;

    const detailEl = document.getElementById("auth-detail");
    detailEl.querySelector(".detail-head").addEventListener("click", () => {
      detailEl.classList.toggle("open");
    });

    const $confirm = document.getElementById("btn-confirm");
    const $confirmLabel = document.getElementById("confirm-label");
    let pickedLevel = startLevel;

    function selectLevel(level) {
      pickedLevel = level;
      document.querySelectorAll(".pl-row").forEach(r => {
        r.classList.toggle("selected", parseInt(r.dataset.level, 10) === level);
      });
      $confirm.disabled = false;
      $confirmLabel.textContent = "确认 →";
    }

    document.querySelectorAll(".pl-row").forEach(r => {
      r.addEventListener("click", () => {
        const lvl = parseInt(r.dataset.level, 10);
        selectLevel(lvl);
      });
    });

    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));

    function commitLevel() {
      if (pickedLevel === null) return;
      const prev = state.auth_choices[item.id];
      if (!prev) {
        state.auth_choices[item.id] = { ladder_level: pickedLevel, change_count: 0 };
      } else {
        if (prev.ladder_level !== pickedLevel) prev.change_count = (prev.change_count || 0) + 1;
        prev.ladder_level = pickedLevel;
      }
      saveState();
      goTo(state.current_page_index + 1);
    }

    $confirm.addEventListener("click", commitLevel);
  }

  // ----- Page 12: Payment cap -----
  function renderPayCap() {
    const cap = state.payment_cap;
    const currentValue = cap.final_value !== null ? cap.final_value : 0;
    const html = `
      <div class="page-content fade-in cap-page">
        <div class="step-label">最后 1 步 · 设置月度预算上限</div>
        <h1>整月累计自动支付预算（**全类目**）</h1>
        <p class="page-subtitle">这是 AI 购物助手在<strong>未来可能开通的所有类目</strong>整月累计可自动支付的金额总上限——<strong>不限于您本次 demo 选的那 1 类</strong>。请按一个全 AI 购物授权场景下您能接受的<strong>全月总预算</strong>来设置；<strong>不要</strong>按单类商品的单价来锚定。独立于上一步的"单次支付授权梯度"——两者同时生效：单次受梯度约束，月累计受这里约束。</p>

        <div class="anchor-hint">
          <span class="anchor-icon">💡</span>
          <span>${escapeHtml(PAY_CAP_ANCHOR)}</span>
        </div>

        <div class="cap-display">
          <span class="cap-currency">¥</span><span class="cap-number" id="cap-number">${currentValue}</span>
          <div class="cap-label">全类目整月累计预算上限</div>
        </div>

        <div class="cap-slider-wrap">
          <input id="cap-slider" class="cap-slider" type="range" min="0" max="5000" step="100" value="${currentValue}" />
          <div class="cap-ticks">
            <span>¥0</span><span>¥1000</span><span>¥2000</span><span>¥3000</span><span>¥4000</span><span>¥5000</span>
          </div>
        </div>

        <div class="cap-explainer">
          <span class="icon">🔔</span>
          <div>这个上限<strong>横跨 AI 助手的所有可购类目</strong>。每笔自动支付完成后会发送通知。月累计达到此上限后，后续订单将提示您手动确认，不会被自动扣款；下个月预算自动重置。</div>
        </div>
      </div>

      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-primary" id="btn-next" ${cap.first_touched ? "" : "disabled"}>确认预算 →</button>
      `)}
    `;
    $app.innerHTML = html;

    const $slider = document.getElementById("cap-slider");
    const $num = document.getElementById("cap-number");
    const $next = document.getElementById("btn-next");
    let dragging = false;

    $slider.addEventListener("pointerdown", () => { dragging = true; });
    $slider.addEventListener("pointerup",   () => {
      if (dragging) cap.slider_adjust_count = (cap.slider_adjust_count || 0) + 1;
      dragging = false;
      saveState();
    });
    $slider.addEventListener("input", () => {
      const v = parseInt($slider.value, 10);
      $num.textContent = v;
      cap.final_value = v;
      cap.first_touched = true;
      cap.max_value_seen = Math.max(cap.max_value_seen ?? v, v);
      cap.min_value_seen = Math.min(cap.min_value_seen ?? v, v);
      saveState();
      $next.disabled = false;
    });

    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));
    $next.addEventListener("click", () => {
      if (cap.first_touched || cap.final_value !== null) goTo(state.current_page_index + 1);
    });
  }

  // ----- Page 13: Confirm (with cue reshow) -----
  function renderConfirm() {
    const groups = [1, 2, 3].map(g => {
      const items = AUTH_ITEMS.filter(x => x.tierGroup === g);
      return { tier: TIERS[g], items };
    });
    const cap = state.payment_cap.final_value ?? 0;

    const groupsHtml = groups.map(g => `
      <div class="summary-group" role="region" aria-label="${escapeHtml(g.tier.label)}">
        <div class="group-head">${escapeHtml(g.tier.label)}</div>
        ${g.items.map((it) => {
          const c = state.auth_choices[it.id];
          const idx = AUTH_ITEMS.indexOf(it);
          const targetPage = pageIndexForAuthItem(idx);
          let glyph, glyphClass, summaryText;
          if (it.type === "ladder") {
            const lvl = c && typeof c.ladder_level === "number" ? c.ladder_level : null;
            const opt = lvl !== null ? it.ladder.find(l => l.level === lvl) : null;
            const allowed = lvl !== null && lvl >= 1;
            glyph = allowed ? "✓" : "✗";
            glyphClass = allowed ? "allow" : "deny";
            summaryText = `${escapeHtml(it.title)}：` +
              (opt ? `<strong>${escapeHtml(opt.label)}</strong>` : "<em>未设置</em>");
          } else {
            const isAllow = c && c.final_choice === "allow";
            glyph = isAllow ? "✓" : "✗";
            glyphClass = isAllow ? "allow" : "deny";
            summaryText = escapeHtml(it.title);
          }
          return `
            <div class="summary-row">
              <span class="check ${glyphClass}" aria-hidden="true">${glyph}</span>
              <span class="summary-text">${summaryText}</span>
              <span class="modify-link" data-jump="${targetPage}">修改</span>
            </div>
          `;
        }).join("")}
      </div>
    `).join("");

    const html = `
      <div class="page-content fade-in confirm-page">
        <h1>请确认您的助手设置</h1>
        <p class="confirm-sub">检查以下设置后提交。点击"修改"可返回任意一项调整。</p>

        ${groupsHtml}

        <div class="summary-cap-card">
          <div class="cap-icon" aria-hidden="true">💳</div>
          <div class="cap-block">
            <div class="lbl">全类目整月累计自动支付预算</div>
            <div class="val">¥ ${cap}</div>
          </div>
          <span class="modify-link" data-jump="16">修改</span>
        </div>

        ${cueBannerHtml("confirm")}
      </div>

      ${bottomAction(`
        <button class="btn btn-secondary" id="btn-back" style="flex:0 0 ${_backW};">返回</button>
        <button class="btn btn-primary" id="btn-submit">立即开通 →</button>
      `)}
    `;
    $app.innerHTML = html;

    bindCueBanner("confirm");

    $app.querySelectorAll(".modify-link").forEach(link => {
      link.addEventListener("click", () => {
        const jump = parseInt(link.dataset.jump, 10);
        state.confirm.back_to_modify_count = (state.confirm.back_to_modify_count || 0) + 1;
        saveState();
        goTo(jump);
      });
    });

    document.getElementById("btn-back").addEventListener("click", () => goTo(state.current_page_index - 1));
    document.getElementById("btn-submit").addEventListener("click", handleSubmit);
  }

  function pageIndexForAuthItem(itemIdx) {
    // map AUTH_ITEMS index -> overall page index (v5: shifted +2 because 3 welcome pages)
    const m = [6, 7, 8, 10, 11, 12, 14, 15];
    return m[itemIdx];
  }

  // ----- Page 16: End -----
  function renderEnd() {
    const code = state.submission_code || "------";
    const msg = ctx.iframe_mode
      ? "感谢您完成设置。请记住以下提交码，然后向下滚动继续作答。"
      : "感谢您完成设置。系统将自动跳转回问卷页面…";
    const note = ctx.iframe_mode
      ? "请将此提交码填入下方问卷中。"
      : "如果 5 秒后未自动跳转，请截图保留以上提交码并联系研究人员。";
    $app.innerHTML = `
      <div class="page-content end-page fade-in">
        <div class="check-circle" aria-hidden="true">✓</div>
        <h1>您的 AI 购物助手已开通</h1>
        <p>${msg}</p>
        <div class="submission-code" aria-label="提交码">${escapeHtml(code)}</div>
        <p class="small-note">${note}</p>
      </div>
    `;
  }

  // ============================== CUE BANNER ==============================
  function cueBannerHtml(slot) {
    const cueData = CUE_TEXT[ctx.cue];
    const stateRec = state.cue_interactions[slot] || {};
    const expanded = stateRec.expanded;
    return `
      <div class="cue-banner ${ctx.cue} ${expanded ? "expanded" : ""}" id="cue-${slot}" data-slot="${slot}">
        <div class="cue-row">
          <div class="cue-icon">${ctx.cue === "high" ? "🛡️" : "⚠️"}</div>
          <div style="flex:1; min-width:0;">
            <div class="cue-label">${escapeHtml(cueData.label)}</div>
            <div class="cue-summary">${escapeHtml(cueData.summary)}</div>
          </div>
          <div class="cue-chevron">⌄</div>
        </div>
        <div class="cue-body">
          <div class="cue-full">${escapeHtml(cueData.full)}</div>
          <div class="cue-en">${escapeHtml(cueData.en)}</div>
          <div class="cue-ack">
            <button type="button" data-ack="${slot}">已阅读</button>
          </div>
        </div>
      </div>
    `;
  }

  function bindCueBanner(slot) {
    const $el = document.getElementById(`cue-${slot}`);
    if (!$el) return;
    const rec = state.cue_interactions[slot];

    let expandStartMs = null;

    function expand() {
      $el.classList.add("expanded");
      rec.expanded = true;
      rec.expand_count = (rec.expand_count || 0) + 1;
      expandStartMs = Date.now();
      saveState();
    }
    function collapse() {
      if (expandStartMs != null) {
        rec.total_dwell_ms = (rec.total_dwell_ms || 0) + (Date.now() - expandStartMs);
        expandStartMs = null;
      }
      $el.classList.remove("expanded");
      rec.expanded = false;
      saveState();
    }

    // Tap row -> toggle
    $el.querySelector(".cue-row").addEventListener("click", () => {
      if ($el.classList.contains("expanded")) collapse();
      else expand();
    });

    // Ack button
    const $ack = $el.querySelector(`button[data-ack="${slot}"]`);
    if ($ack) {
      $ack.addEventListener("click", (e) => {
        e.stopPropagation();
        rec.ack_clicked = true;
        saveState();
        collapse();
      });
    }

    // Auto-record dwell on page exit (best-effort)
    window.addEventListener("beforeunload", () => {
      if (expandStartMs != null) {
        rec.total_dwell_ms = (rec.total_dwell_ms || 0) + (Date.now() - expandStartMs);
        saveState();
      }
    }, { once: true });
  }

  // ============================== SUBMIT ==============================
  async function handleSubmit() {
    const $submit = document.getElementById("btn-submit");
    if ($submit) {
      $submit.disabled = true;
      $submit.textContent = "提交中…";
    }
    exitPage(state.current_page_index);

    state.end_ts = Date.now();
    state.submitted = true;
    state.submission_code = generateCode();
    saveState();

    const payload = buildPayload();

    let logSent = false;
    if (LOGGING_ENDPOINT) {
      try {
        const r = await fetch(LOGGING_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          mode: "cors",
          keepalive: true
        });
        logSent = r.ok;
      } catch (e) { /* fall back to URL params */ }
    }

    state.current_page_index = 18;  // end page (v5: shifted +2 due to 3 welcome pages)
    saveState();
    render();

    if (ctx.iframe_mode) {
      redirectToCredamo(payload, logSent);
    } else {
      setTimeout(() => redirectToCredamo(payload, logSent), 1500);
    }
  }

  function buildPayload() {
    // 0–10 composite = 7 binary + 1 ladder (0-3)
    const ladderItem = AUTH_ITEMS.find(x => x.type === "ladder");
    const ladderRec  = ladderItem ? state.auth_choices[ladderItem.id] : null;
    const ladderLevel = ladderRec && typeof ladderRec.ladder_level === "number" ? ladderRec.ladder_level : 0;
    const binarySum = AUTH_ITEMS.reduce((s, it) => {
      if (it.type === "ladder") return s;
      const c = state.auth_choices[it.id];
      return s + (c && c.final_choice === "allow" ? 1 : 0);
    }, 0);
    const breadthSum = binarySum + ladderLevel;
    const totalChange = AUTH_ITEMS.reduce((s, it) => {
      const c = state.auth_choices[it.id];
      return s + ((c && c.change_count) || 0);
    }, 0);
    const totalBack = Object.values(state.pages)
      .reduce((s, p) => s + (p.back_to_modify || 0), 0);
    const clickOrder = AUTH_ITEMS.map(it => {
      const c = state.auth_choices[it.id];
      const num = it.id.split("_")[1];
      if (!c) return `none_${num}`;
      if (it.type === "ladder") return `level${c.ladder_level}_${num}`;
      return `${c.final_choice}_${num}`;
    });

    return {
      schema_version: TOOL_VERSION,
      participant_id: state.pid,
      cell: state.cell,
      cue: state.cue,
      jurisdiction: state.jurisdiction,
      scenario: state.scenario,
      preference: state.preference,
      preference_change_count: state.preference_change_count || 0,
      focal_category: state.focal_category,
      focal_change_count: state.focal_change_count || 0,
      submission_code: state.submission_code,
      start_ts: state.start_ts,
      end_ts: state.end_ts,
      total_duration_ms: state.end_ts - state.start_ts,
      pages: state.pages,
      auth_choices: state.auth_choices,
      payment_cap: state.payment_cap,
      confirm: state.confirm,
      cue_interactions: state.cue_interactions,
      tier_dwells: state.tier_dwells,
      summary: {
        final_breadth_sum: breadthSum,                 // 0–10 composite (PRIMARY DV per paper §4.4)
        final_breadth_binary_sum: binarySum,           // 0–7 (robustness mixed-effects logistic input)
        final_payment_ladder_level: ladderLevel,       // 0–3 (ordered logit input)
        final_payment_cap: state.payment_cap.final_value ?? 0,
        click_order: clickOrder,
        total_change_count: totalChange,
        total_back_count: totalBack,
        slider_adjust_count: state.payment_cap.slider_adjust_count || 0,
        cue_intro_expanded: !!state.cue_interactions.intro.ack_clicked || !!state.cue_interactions.intro.expand_count,
        cue_confirm_expanded: !!state.cue_interactions.confirm.ack_clicked || !!state.cue_interactions.confirm.expand_count,
        cue_intro_dwell_ms: state.cue_interactions.intro.total_dwell_ms || 0,
        cue_confirm_dwell_ms: state.cue_interactions.confirm.total_dwell_ms || 0
      }
    };
  }

  function redirectToCredamo(payload, logSent) {
    const s = payload.summary;
    const summaryData = {
      pid: state.pid,
      cell: state.cell,
      cue: state.cue,
      jurisdiction: state.jurisdiction,
      scenario: state.scenario,
      preference: state.preference || "",
      focal_category: state.focal_category || "",
      submission_code: state.submission_code,
      breadth_sum: s.final_breadth_sum,
      breadth_binary_sum: s.final_breadth_binary_sum,
      payment_ladder_level: s.final_payment_ladder_level,
      payment_cap: s.final_payment_cap,
      total_duration_ms: payload.total_duration_ms,
      total_change_count: s.total_change_count,
      total_back_count: s.total_back_count,
      slider_adjust_count: s.slider_adjust_count,
      cue_intro_dwell_ms: s.cue_intro_dwell_ms,
      cue_confirm_dwell_ms: s.cue_confirm_dwell_ms,
      cue_intro_expanded: s.cue_intro_expanded ? 1 : 0,
      cue_confirm_expanded: s.cue_confirm_expanded ? 1 : 0,
      log_sent: logSent ? 1 : 0
    };

    if (ctx.iframe_mode) {
      try { window.parent.postMessage({ type: "r3c1_complete", data: summaryData, payload: payload }, "*"); } catch (e) {}
      try { localStorage.removeItem(STATE_KEY); } catch (e) {}
      return;
    }

    const params = new URLSearchParams();
    Object.entries(summaryData).forEach(([k, v]) => params.set(k, String(v)));
    if (state.return_id || ctx.return_id) params.set("return_id", state.return_id || ctx.return_id);
    const sep = ctx.return_url.includes("?") ? "&" : "?";
    const finalUrl = `${ctx.return_url}${sep}${params.toString()}`;
    try { localStorage.removeItem(STATE_KEY); } catch (e) {}
    window.location.href = finalUrl;
  }

  // ============================== UI HELPERS ==============================

  function aiBubble(text, reason) {
    return `
      <div class="ai-bubble">
        <div class="ai-avatar-mini" aria-hidden="true">✨</div>
        <div class="ai-msg">
          ${escapeHtml(text)}
          ${reason ? `<span class="reason">${escapeHtml(reason)}</span>` : ""}
        </div>
      </div>
    `;
  }

  function productCardSmall(p, opts = {}) {
    const badge = opts.badge ? `<div class="pc-badge ${opts.badgeClass || ""}">${escapeHtml(opts.badge)}</div>` : "";
    const status = opts.status ? `<div class="pc-status ${opts.statusClass || ""}">${escapeHtml(opts.status)}</div>` : "";
    const showMeta = opts.showMeta !== false;
    return `
      <div class="product-card">
        <div class="pc-img" style="background: ${p.bg};">
          ${badge}
          <span aria-hidden="true">${p.icon}</span>
        </div>
        <div class="pc-name">${escapeHtml(p.name)}</div>
        ${showMeta ? `<div class="pc-meta">${escapeHtml(p.meta)}</div>` : ""}
        <div class="pc-price">
          <span class="now"><span class="yuan">¥</span>${p.price}</span>
          <span class="orig">¥${p.orig}</span>
        </div>
        ${status}
      </div>
    `;
  }

  function productCardLarge(p) {
    return `
      <div class="product-card-large">
        <div class="pc-img" style="background: ${p.bg};">${p.icon}</div>
        <div class="pc-body">
          <div class="pc-name">${escapeHtml(p.name)}</div>
          <div class="pc-meta"><span class="star">★</span> ${escapeHtml(p.meta)}</div>
          <div class="pc-price">
            <span class="now"><span class="yuan">¥</span>${p.price}</span>
            <span class="orig">¥${p.orig}</span>
          </div>
        </div>
      </div>
    `;
  }

  function mockOrderCard(p) {
    const ship = 6;
    const total = (p.price + ship).toFixed(2);
    const discount = (p.orig - p.price).toFixed(0);
    return `
      <div class="mock-order">
        <div class="mo-store"><span class="store-icon">购</span>营养食补优选店 · 包邮</div>
        <div class="mo-product">
          <div class="pc-img" style="background: ${p.bg};">${p.icon}</div>
          <div class="mo-info">
            <div class="mo-name">${escapeHtml(p.name)}</div>
            <div class="mo-spec">${escapeHtml(p.meta)} × 1</div>
          </div>
          <div class="mo-price">¥${p.price}</div>
        </div>
        <div class="mo-rows">
          <div class="mo-row"><span class="label">送达时间</span><span class="val">明日送达</span></div>
          <div class="mo-row"><span class="label">配送至</span><span class="val">您的默认收货地址</span></div>
          <div class="mo-row"><span class="label">优惠</span><span class="val" style="color:#DC2626;">-¥${discount}</span></div>
        </div>
        <div class="mo-total"><span class="label">合计</span><span class="val">¥${total}</span></div>
      </div>
    `;
  }

  function mockPaymentModal(p) {
    const total = (p.price + 6).toFixed(2);
    return `
      <div class="mock-payment">
        <div class="pay-title">本次订单金额</div>
        <div class="pay-amount"><span class="yuan">¥</span>${total}</div>
        <div class="pay-method">
          <div class="pm-left">
            <div class="pm-icon">支</div>
            <div>
              <div class="pm-name">支付宝</div>
              <div class="pm-sub">绑定的支付方式 · 余额充足</div>
            </div>
          </div>
          <div class="pm-check">✓</div>
        </div>
        <div class="pay-disclaimer">仅为示意，本流程不会真实扣款</div>
      </div>
    `;
  }

  function substitutePair(orig, replacement) {
    return `
      <div class="sub-pair">
        ${productCardSmall(orig, { showMeta: false, status: "缺货", statusClass: "oos" })}
        <div class="arrow" aria-hidden="true">→</div>
        ${productCardSmall(replacement, { showMeta: false, status: "✓ 已自动替换", statusClass: "replaced" })}
      </div>
    `;
  }

  // Replenish calendar narrowed to focal category only (v4)
  function replenishCalendar(cell, focalCatId) {
    let days = "";
    for (let i = 1; i <= 28; i++) {
      const isReplen = (i === 1);  // monthly = 1 day per month for one category
      days += `<div class="day ${isReplen ? "replenish" : ""}">${i}</div>`;
    }
    const focalProduct = productFor(focalCatId, cell);
    return `
      <div class="cal-grid">
        <div class="cal-month">下月自动补货安排（仅本次选定的类目）</div>
        <div class="cal-headers">
          <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div>
        </div>
        <div class="cal-days">${days}</div>
        <div class="cal-legend">
          <div class="swatch" aria-hidden="true"></div>
          <div class="replen-list"><strong>每月 1 号自动补货 1 次</strong>: ${escapeHtml(focalProduct.name)}（仅本类目；其它 7 类不在自动补货范围内）</div>
        </div>
      </div>
    `;
  }

  // 5-brand comparison table for auth_2_compare (v4)
  function brandComparisonTable(catId, cell) {
    const brands = brandsFor(catId, cell);
    // Generate 5 brand rows by extending the 3-brand variant list with 2 synthetic ones
    const ext = [
      { ...brands[0] },
      { ...brands[1] },
      { ...brands[2] },
      { ...brands[1], name: brands[1].name.replace("品牌 B", "品牌 D"), price: Math.round(brands[1].price * 1.12), orig: Math.round(brands[1].orig * 1.12) },
      { ...brands[2], name: brands[2].name.replace("品牌 C", "品牌 E"), price: Math.round(brands[2].price * 0.88), orig: Math.round(brands[2].orig * 0.88) }
    ];
    const sales  = [52000, 38000, 41000, 18000, 27000];
    const rating = [4.8, 4.6, 4.7, 4.4, 4.5];
    const rows = ext.map((p, i) => {
      const displayName = _s ? p.name.replace(/^.+?(品牌)/, '$1') : p.name;
      return `
      <tr>
        <td class="bc-name"><span class="bc-icon" style="background: ${p.bg};">${p.icon}</span>${escapeHtml(displayName)}</td>
        <td class="bc-price"><span class="now">¥${p.price}</span><span class="orig">¥${p.orig}</span></td>
        <td class="bc-sales">${sales[i].toLocaleString()}</td>
        <td class="bc-rating">★ ${rating[i]}</td>
      </tr>
    `;}).join("");
    return `
      <table class="brand-compare">
        <thead>
          <tr>
            <th>品牌</th>
            <th>价格</th>
            <th>月销</th>
            <th>评分</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function preferenceLabel() {
    const p = PREFERENCES.find(x => x.id === state.preference);
    return p ? p.label : "性价比优先";
  }

  // 4-platform search tiles for auth_1_search (v4 — replaces 8-category preview)
  function platformSearchTiles(p) {
    const platforms = [
      { name: "淘宝",   tone: "#FF6A00", priceMul: 1.00 },
      { name: "京东",   tone: "#E1251B", priceMul: 1.05 },
      { name: "拼多多", tone: "#E02E24", priceMul: 0.92 },
      { name: "天猫",   tone: "#FF0036", priceMul: 1.03 }
    ];
    return `
      <div class="platform-row">
        ${platforms.map(pl => `
          <div class="platform-tile">
            <div class="pt-platform" style="color:${pl.tone};">${escapeHtml(pl.name)}</div>
            <div class="pt-img" style="background: ${p.bg};">${p.icon}</div>
            <div class="pt-name">${escapeHtml(p.name)}</div>
            <div class="pt-price"><span class="yuan">¥</span>${Math.round(p.price * pl.priceMul)}</div>
            <div class="pt-meta">实时报价</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  /** Per-auth-item content (chat bubble + product preview, cell-adaptive, focal-category locked). */
  function authItemContent(itemId) {
    const cell = ctx.cell;
    const focalId = state.focal_category || "milk";  // fallback if user skipped pick (shouldn't happen)
    const focal   = productFor(focalId, cell);
    const focalBrands = brandsFor(focalId, cell);
    const prefLabel   = preferenceLabel();
    switch (itemId) {
      case "auth_1_search":
        return `
          ${aiBubble("您选了「" + escapeHtml(focal.name) + "」；如允许，我会同时在多个电商平台搜索该类目的报价 ↓")}
          ${platformSearchTiles(focal)}
          <p class="page-note" style="margin-top:10px;font-size:12px;color:var(--fg-soft);">↑ 同一商品在 4 个平台的实时报价对比；AI 会跨平台搜索，下一步进入品牌对比</p>
        `;
      case "auth_2_compare":
        return `
          ${aiBubble("我会汇总该类目内主要候选品牌的价格 / 月销 / 评分明细 ↓")}
          ${brandComparisonTable(focalId, cell)}
        `;
      case "auth_3_shortlist":
        return `
          ${aiBubble("从上一步对比的所有候选品牌中，我会按规则筛出 Top 3 推荐给您 ↓",
                     "（基于您的购物偏好「" + prefLabel + "」+ 综合评分 + 价格性价比）")}
          <div class="shortlist-header">从 24 个候选品牌中筛出 Top 3</div>
          <div class="product-compare">
            ${productCardSmall(focalBrands[0], { badge: "Top 1", badgeClass: "ai-pick", showMeta: false })}
            ${productCardSmall(focalBrands[1], { badge: "Top 2", badgeClass: "ai-pick", showMeta: false })}
            ${productCardSmall(focalBrands[2], { badge: "Top 3", badgeClass: "ai-pick", showMeta: false })}
          </div>
        `;
      case "auth_4_select":
        return `
          ${aiBubble("根据您选的偏好「" + prefLabel + "」，我从 Top 3 中选出这一款 ↓",
                     "推荐理由：契合「" + prefLabel + "」 / 评分 4.8 / 月销 5w+ / 包邮当日发")}
          ${productCardLarge(focalBrands[1])}
        `;
      case "auth_5_order":
        return `
          ${aiBubble("选定后我会按以下订单详情自动提交 ↓")}
          ${mockOrderCard(focalBrands[1])}
        `;
      case "auth_6_pay":
        return `
          ${aiBubble("订单提交后，我会按您下面选择的梯度自动支付 ↓")}
          ${mockPaymentModal(focalBrands[1])}
        `;
      case "auth_7_substitute":
        return `
          ${aiBubble("如「" + escapeHtml(focalBrands[0].name) + "」缺货，我会自动选同类目内评分相近、价格 ±20% 内的另一品牌 ↓")}
          ${substitutePair(focalBrands[0], focalBrands[2])}
        `;
      case "auth_8_replenish":
        return `
          ${aiBubble("我会对您选的「" + escapeHtml(focal.name) + "」每月自动补货 1 次。下月安排预览 ↓")}
          ${replenishCalendar(cell, focalId)}
        `;
      default:
        return "";
    }
  }

  // ============================== UTILS ==============================
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  }

  // ============================== INIT ==============================
  render();
})();
