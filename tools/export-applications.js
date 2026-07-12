#!/usr/bin/env node
/**
 * Exports all scholarship applications to CSV for reading season.
 *
 *   node tools/export-applications.js
 *
 * Produces two files in the current directory:
 *   applications-YYYY-MM-DD.csv   — one row per application (full data)
 *   scoring-sheet-YYYY-MM-DD.csv  — two rows per application (Reader 1 / 2)
 *                                   with blank rubric columns to fill in
 *
 * Auth: reuses the Firebase CLI's stored login (run `firebase login` first).
 * Share the CSVs with your readers — never the Firebase console itself.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_ID = 'rosekelleyscholarship-e0068';

// firebase-tools' public installed-app OAuth client (from its open source)
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvRow(cells) { return cells.map(csvCell).join(',') + '\r\n'; }

async function getToken() {
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cfg.tokens.refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const tok = await resp.json();
  if (!tok.access_token) throw new Error('Auth failed — run `firebase login` and retry.');
  return tok.access_token;
}

async function main() {
  const token = await getToken();
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/applications?pageSize=300`;
  const docs = [];
  let pageToken = '';
  do {
    const url = base + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    (data.documents || []).forEach(d => docs.push(d));
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  const date = new Date().toISOString().slice(0, 10);
  const get = (d, k) => (d.fields && d.fields[k] && (d.fields[k].stringValue || d.fields[k].timestampValue)) || '';

  let apps = csvRow(['ID', 'Submitted', 'Name', 'Email', 'School / program', 'Where they are', 'Essay']);
  let scoring = csvRow(['ID', 'Applicant', 'Reader', 'A path of your own (1-5)', 'Steps already taken (1-5)', 'What $1,000 changes (1-5)', 'Total', 'Notes']);

  docs.sort((a, b) => get(a, 'submittedAt').localeCompare(get(b, 'submittedAt')));
  for (const d of docs) {
    const id = d.name.split('/').pop();
    apps += csvRow([id, get(d, 'submittedAt'), get(d, 'name'), get(d, 'email'), get(d, 'school'), get(d, 'stage'), get(d, 'essay')]);
    scoring += csvRow([id, get(d, 'name'), 'Reader 1', '', '', '', '', '']);
    scoring += csvRow([id, get(d, 'name'), 'Reader 2', '', '', '', '', '']);
  }

  fs.writeFileSync(`applications-${date}.csv`, apps);
  fs.writeFileSync(`scoring-sheet-${date}.csv`, scoring);
  console.log(`${docs.length} application(s) exported:`);
  console.log(`  applications-${date}.csv`);
  console.log(`  scoring-sheet-${date}.csv`);
  console.log('Reminder: these files contain applicant PII — share only with readers, delete after the cycle.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
