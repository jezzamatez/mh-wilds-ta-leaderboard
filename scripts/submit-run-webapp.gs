const SHEET_NAME = 'RunData';
const REQUIRED_FIELDS = ['Player', 'RunType', 'Monster', 'Weapon', 'Difficulty', 'Duration'];

function doPost(e) {
  const params = e.parameter || {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ ok: false, error: `Missing sheet: ${SHEET_NAME}` });
  }

  const rowData = {
    Player: cleanParam(params, 'Player'),
    RunType: cleanParam(params, 'RunType'),
    Monster: cleanParam(params, 'Monster'),
    Weapon: cleanParam(params, 'Weapon'),
    Difficulty: cleanParam(params, 'Difficulty'),
    Duration: cleanParam(params, 'Duration'),
    Link: cleanParam(params, 'Link')
  };

  const missing = REQUIRED_FIELDS.filter(field => !rowData[field]);

  if (missing.length) {
    return jsonResponse({ ok: false, error: `Missing required fields: ${missing.join(', ')}` });
  }

  sheet.appendRow([
    rowData.Player,
    rowData.RunType,
    rowData.Monster,
    rowData.Weapon,
    rowData.Difficulty,
    rowData.Duration,
    rowData.Link,
    new Date()
  ]);

  return jsonResponse({ ok: true });
}

function cleanParam(params, name) {
  const lowerName = name.charAt(0).toLowerCase() + name.slice(1);
  return String(params[name] || params[lowerName] || '').trim();
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
