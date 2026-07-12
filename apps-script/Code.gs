/**
 * Rose Kelley Scholarship — confirmation email automation.
 *
 * Runs on a timer (every 10 minutes). For each new application in
 * Firestore that hasn't been confirmed yet, it:
 *   1. Emails the applicant a receipt confirmation (from this Gmail account)
 *   2. Emails you a notification with the full application
 *   3. Stamps the Firestore document with confirmationSentAt so it's
 *      never processed twice
 *
 * SETUP (one time): run the setup() function from the editor toolbar,
 * approve the authorization prompts, and you're done. See the README.
 */

const PROJECT_ID = 'rosekelleyscholarship-e0068';
const NOTIFY_EMAIL = 'rosekelleyscholarship@gmail.com';
const DECISION_DATE = 'December 1, 2026';

/** Run this once from the editor to install the 10-minute timer. */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'checkNewApplications')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkNewApplications').timeBased().everyMinutes(10).create();
  checkNewApplications(); // process anything already waiting
}

function checkNewApplications() {
  const docs = listApplications_();
  docs.forEach(doc => {
    if (doc.fields && !doc.fields.confirmationSentAt && !doc.fields.confirmationError) {
      processApplication_(doc);
    }
  });
}

function processApplication_(doc) {
  const f = (name) => (doc.fields[name] && doc.fields[name].stringValue) || '';
  const name = f('name'), email = f('email'), school = f('school'),
        stage = f('stage'), essay = f('essay');
  const docId = doc.name.split('/').pop();

  try {
    MailApp.sendEmail({
      to: email,
      replyTo: NOTIFY_EMAIL,
      subject: 'We received your application — Rose Kelley Scholarship',
      body:
        'Hi ' + (name.split(' ')[0] || name) + ',\n\n' +
        'Your application to the Rose Kelley Scholarship has been received. ' +
        'You don’t need to do anything else.\n\n' +
        'What happens next: two readers will score your application ' +
        'independently using the rubric published on our site, and every ' +
        'applicant — not just the recipient — will hear back by email on or ' +
        'before ' + DECISION_DATE + '.\n\n' +
        'If anything changes, or you need an accommodation or a different ' +
        'format for any part of the process, just reply to this email.\n\n' +
        'Thank you for applying — we’re glad to have your application.\n\n' +
        '— Rose Kelley Scholarship\n' +
        NOTIFY_EMAIL
    });
    markDocument_(docId, 'confirmationSentAt');
  } catch (err) {
    // Bad address, quota, etc. — mark it so we don't retry forever,
    // and tell the owner to follow up by hand.
    markDocument_(docId, 'confirmationError');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: '⚠️ Could not send confirmation — ' + name,
      body: 'Sending the confirmation email failed for this applicant.\n\n' +
        'Name: ' + name + '\nEmail: ' + email + '\nError: ' + err + '\n\n' +
        'Please confirm receipt with them manually.'
    });
  }

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'New scholarship application: ' + name,
    body:
      'A new application just arrived.\n\n' +
      'Name: ' + name + '\n' +
      'Email: ' + email + '\n' +
      'School / program: ' + school + '\n' +
      'Where they are: ' + stage + '\n\n' +
      'Their path:\n' + essay + '\n\n' +
      'View all applications:\n' +
      'https://console.firebase.google.com/project/' + PROJECT_ID + '/firestore'
  });
}

/** Lists every document in the applications collection (paginated). */
function listApplications_() {
  const base = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
    '/databases/(default)/documents/applications?pageSize=300';
  const docs = [];
  let pageToken = '';
  do {
    const url = base + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const resp = fetchFirestore_(url, 'get', null);
    (resp.documents || []).forEach(d => docs.push(d));
    pageToken = resp.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/** Sets a timestamp field on one application document. */
function markDocument_(docId, fieldName) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID +
    '/databases/(default)/documents/applications/' + docId +
    '?updateMask.fieldPaths=' + fieldName + '&currentDocument.exists=true';
  fetchFirestore_(url, 'patch', {
    fields: { [fieldName]: { timestampValue: new Date().toISOString() } }
  });
}

function fetchFirestore_(url, method, body) {
  const resp = UrlFetchApp.fetch(url, {
    method: method,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    contentType: 'application/json',
    payload: body ? JSON.stringify(body) : undefined,
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code >= 300) {
    throw new Error('Firestore ' + method + ' failed (' + code + '): ' + resp.getContentText().slice(0, 500));
  }
  return JSON.parse(resp.getContentText() || '{}');
}
