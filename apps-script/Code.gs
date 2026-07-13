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
    const firstName = name.split(' ')[0] || name;
    MailApp.sendEmail({
      to: email,
      name: 'Rose Kelley Scholarship',
      replyTo: NOTIFY_EMAIL,
      subject: 'We received your application — Rose Kelley Scholarship',
      body: // plain-text fallback for clients that prefer it
        'Hi ' + firstName + ',\n\n' +
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
        NOTIFY_EMAIL,
      htmlBody: confirmationHtml_(firstName)
    });
    markDocument_(docId, 'confirmationSentAt');
  } catch (err) {
    // Bad address, quota, etc. — mark it so we don't retry forever,
    // and tell the owner to follow up by hand.
    markDocument_(docId, 'confirmationError');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      name: 'Rose Kelley Scholarship',
      subject: '⚠️ Could not send confirmation — ' + name,
      body: 'Sending the confirmation email failed for this applicant.\n\n' +
        'Name: ' + name + '\nEmail: ' + email + '\nError: ' + err + '\n\n' +
        'Please confirm receipt with them manually.'
    });
  }

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    name: 'Rose Kelley Scholarship',
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

/**
 * The confirmation email, in the site's rose gold theme.
 * Email rules: all styles inline, no web fonts (Georgia stands in for
 * Fraunces), no SVG images (the infinity is a unicode character).
 */
function confirmationHtml_(firstName) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '' +
  '<div style="background:#FBF7F5;padding:32px 16px;">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E9DCDA;border-top:4px solid #B76E79;border-radius:14px;overflow:hidden;">' +
      '<div style="padding:34px 36px 30px;font-family:Georgia,\'Times New Roman\',serif;color:#33232A;">' +
        '<div style="font-size:34px;line-height:1;color:#B76E79;">&#8734;</div>' +
        '<div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9C5560;font-family:Arial,Helvetica,sans-serif;font-weight:bold;margin:14px 0 6px;">Rose Kelley Scholarship</div>' +
        '<h1 style="margin:0 0 18px;font-size:26px;font-weight:normal;color:#33232A;">Your application is in, ' + esc(firstName) + '.</h1>' +
        '<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#5A4A50;">' +
          'We received your application to the Rose Kelley Scholarship. You don&rsquo;t need to do anything else &mdash; this email is your receipt.</p>' +
        '<div style="background:#F9ECEA;border-radius:10px;padding:18px 22px;margin:22px 0;">' +
          '<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#9C5560;">What happens next</p>' +
          '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#4a3035;">' +
            'Two readers score every application independently, using the rubric published on our site. Every applicant &mdash; not just the recipient &mdash; hears back by email on or before <strong>' + DECISION_DATE + '</strong>.</p>' +
        '</div>' +
        '<p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#5A4A50;">' +
          'If anything changes, or you need an accommodation or a different format for any part of the process, just reply to this email &mdash; asking never affects your score.</p>' +
        '<a href="https://rosekelleyscholarship.org/#rubric" style="display:inline-block;padding:11px 24px;border-radius:999px;background:#B76E79;color:#3A2228;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;">See how applications are scored</a>' +
        '<p style="margin:26px 0 0;font-family:Georgia,serif;font-size:15px;font-style:italic;color:#9C5560;">Thank you for applying &mdash; we&rsquo;re glad to have your application.</p>' +
      '</div>' +
      '<div style="padding:16px 36px;border-top:1px solid #E9DCDA;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a767d;">' +
        'Rose Kelley Scholarship &middot; <a href="https://rosekelleyscholarship.org" style="color:#9C5560;">rosekelleyscholarship.org</a></div>' +
    '</div>' +
  '</div>';
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
