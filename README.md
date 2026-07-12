# Rose Kelley Scholarship — site

A single-page scholarship site. Applications submitted through the form are
written to **Cloud Firestore** (collection: `applications`); the site is served
by **Firebase Hosting**. If Firestore is ever unreachable (offline, blocked by
an extension), the form automatically falls back to opening an email draft to
`rosekelleyscholarship@gmail.com` — no application can be silently lost.

## Layout

- `public/index.html` — the live site (the only page)
- `firestore.rules` — security rules: the public may **create** validated
  applications only; nobody can read/update/delete from the client. Review
  the applications in the Firebase console.
- `firebase.json` / `firestore.indexes.json` — Firebase config
- `setup-firebase.sh` — one-time project creation + deploy (idempotent); also
  fills in the `__SITE_HOST__` placeholder in the social-share meta tags
- `delete-cycle-data.sh` — end-of-cycle deletion of all applications (the
  privacy policy promises this; asks for confirmation before deleting)
- `public/og.png` — 1200×630 social share image; `public/404.html` — not-found page
- `infinite-paths-scholarship_1.html` — original pre-Firebase draft (kept as backup)

## Launch (one time)

```sh
firebase login          # interactive — opens a browser
./setup-firebase.sh     # creates project, Firestore DB, injects config, deploys
```

The script prints the live URL (`https://<project-id>.web.app`) when done.

## Redeploying after edits

```sh
firebase deploy --only hosting              # site changes
firebase deploy --only firestore:rules      # rules changes
```

## Reading applications

Firebase console → Firestore Database → `applications` collection.
Each document has: `name`, `email`, `school`, `stage`, `essay`, `submittedAt`.

## Confirmation emails (apps-script/)

A Google Apps Script polls Firestore every 10 minutes; each new application
gets (a) a confirmation email to the applicant and (b) a notification email
to rosekelleyscholarship@gmail.com, then the document is stamped with
`confirmationSentAt` so it's never emailed twice. Send failures are stamped
`confirmationError` and you get an alert to follow up manually.

One-time install (~3 minutes), signed in as rosekelleyscholarship@gmail.com:

1. Go to https://script.google.com → **New project**.
2. Name it "Scholarship confirmations".
3. Replace the editor's default contents with `apps-script/Code.gs`.
4. Click the gear (Project Settings) → check **Show "appsscript.json"** →
   back in the editor, open `appsscript.json` and replace its contents with
   `apps-script/appsscript.json`.
5. Select the `setup` function in the toolbar dropdown → **Run** → approve
   the authorization prompts (it will warn the app is unverified — click
   Advanced → Go to project — this is your own script on your own account).

Done: `setup()` installs the 10-minute timer and processes anything waiting.

## Before launch — manual checklist

- [ ] `rosekelleyscholarship@gmail.com` must be a real, monitored inbox (it's the
      fallback path, the accommodations contact, and the donations contact).
- [x] Donation link: the GoFundMe campaign is wired into `DONATE_URL`
      (https://www.gofundme.com/f/empower-autistic-students-with-rose-kelley-scholarship).
      NOTE: donations showed as "paused" on GoFundMe as of 2026-07-12 —
      resolve that in the GoFundMe dashboard before launch.
- [ ] Optional: connect a custom domain (e.g. rosekelleyscholarship.org) in
      Firebase console → Hosting → Add custom domain.
- [ ] Install the confirmation-email automation (see "Confirmation emails"
      above) so the site's 2-day confirmation promise keeps itself.
