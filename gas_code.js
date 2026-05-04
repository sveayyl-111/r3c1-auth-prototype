// 粘贴到 Google Apps Script 编辑器中（替换旧代码）
// 部署方式：部署 → 管理部署 → 编辑 → 版本选"新版本" → 部署

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var data;
  if (e.parameter && e.parameter.payload) {
    data = JSON.parse(e.parameter.payload);
  } else {
    data = JSON.parse(e.postData.contents);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "timestamp", "participant_id", "cell", "cue", "jurisdiction", "scenario",
      "preference", "focal_category", "submission_code",
      "breadth_sum", "breadth_binary_sum", "payment_ladder_level", "payment_cap",
      "total_duration_ms", "total_change_count", "total_back_count",
      "slider_adjust_count", "cue_intro_dwell_ms", "cue_confirm_dwell_ms",
      "cue_intro_expanded", "cue_confirm_expanded",
      "auth_choices_json", "pages_json", "payment_cap_json",
      "cue_interactions_json", "tier_dwells_json", "full_payload"
    ]);
  }

  var s = data.summary || {};
  sheet.appendRow([
    new Date().toISOString(),
    data.participant_id || "",
    data.cell || "",
    data.cue || "",
    data.jurisdiction || "",
    data.scenario || "",
    data.preference || "",
    data.focal_category || "",
    data.submission_code || "",
    s.final_breadth_sum,
    s.final_breadth_binary_sum,
    s.final_payment_ladder_level,
    s.final_payment_cap,
    data.total_duration_ms,
    s.total_change_count,
    s.total_back_count,
    s.slider_adjust_count,
    s.cue_intro_dwell_ms,
    s.cue_confirm_dwell_ms,
    s.cue_intro_expanded ? 1 : 0,
    s.cue_confirm_expanded ? 1 : 0,
    JSON.stringify(data.auth_choices),
    JSON.stringify(data.pages),
    JSON.stringify(data.payment_cap),
    JSON.stringify(data.cue_interactions),
    JSON.stringify(data.tier_dwells),
    JSON.stringify(data)
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
