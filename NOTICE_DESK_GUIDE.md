# Notice Desk

This is a website for a law firm that sends legal notices for banks.

Three kinds of people can sign in:

- **Owner** — one person at the law firm. They can send a notice, keep the list of banks, add a login, read the audit log, and turn live send on or off.
- **Legal coordinator** — can send a notice and add a bank user for one bank. They cannot change live send, add a bank, or open the audit log.
- **Bank user** — someone on the bank side. Their login is tied to one bank. They cannot see the other banks.

Sending a notice is one screen, **Send notice**. Choose the bank’s spreadsheet of people, choose the approved notice wording, review who will get it, then send. Tracking already shows delivery results, so Loans is not a separate tab. The owner turns live send on or off in **Settings**. When it is on and MSG91 is set up, confirming sends for real. When it is off, confirming records a dry run and nothing is sent. The audit log names the person and their role. See `NEXT_STEPS.md` for later polish.

Practice passwords are for your own computer. Do not put this site on the public internet with these passwords.

## What you need first

Install **Node.js** version 20 or newer. It is the program that runs this site.

1. Open [https://nodejs.org](https://nodejs.org).
2. Download the version marked **LTS**.
3. Run the installer. Leave the usual options ticked.
4. Close and reopen any terminal windows you already had open.

To check, open a terminal and type:

```bash
node -v
```

You should see a number starting with `v20` or higher, such as `v22`.

## Start the site

Open a terminal.

Go to this project folder. On many computers that looks like one of these (use the real folder path):

```bash
cd path/to/this/folder
```

The first time, install the pieces the site needs. You need an internet connection for this step. Type:

```bash
npm install
```

Wait until it finishes. If there is no `.env` file in this folder yet, copy the example:

```bash
cp .env.example .env
```

Then start the site:

```bash
npm run dev
```

The first start creates a small database on your computer, two practice users, three practice banks, and three Approved notice templates. Those templates are the firm’s live MSG91 legal notices (SMS, email, and WhatsApp). Every bank can select them. The templates page does not label them as written for a practice bank. You may see a line that says Prisma is skipping environment variable loading. That line is normal. Wait until the terminal says the site is ready, then open a browser and go to:

[http://localhost:4317](http://localhost:4317)

That page is for someone who received a notice. It tells them to contact their bank. It does not show the staff sign-in form. In `.env`, set `NOTICE_DESK_ENTRY_CODE` to a private code of at least 8 characters (the example file shows a placeholder). Restart the site after you change it. At the bottom of the public page, open **Staff access**, enter that code, and press **Continue**. Sign-in then opens for about two hours. A wrong code does not open it. Going straight to [http://localhost:4317/login](http://localhost:4317/login) sends you back to the public page until the code has been accepted.

Leave the terminal window open while you use the site. Closing it, or pressing Ctrl+C in that window, stops the site.

The site uses port **4317** (not the usual 3000) so it is less likely to clash with another program.

Each time you run `npm run dev`, the two practice passwords are set back to the ones in this guide, and the three practice banks are reset. A bank you added yourself, with a different short code, stays. The bank the owner last chose also stays. The three MSG91 notice templates are marked Approved, so every bank can select that wording. The templates page does not credit a practice bank for them. Restarting puts the wording back. A leftover practice template on Northwind, Meridian, or Harbour is removed if no send uses it. A spreadsheet you uploaded stays. A send you confirmed stays. The three practice public notices are put back. A live-send choice saved in Settings stays. Until someone saves one, the switch starts on.

## Open a practice notice

These pages need no sign-in. Each one is a single recipient:

- Akshay Sathe: [http://localhost:4317/notice-DEMO-LN10021](http://localhost:4317/notice-DEMO-LN10021)
- Akshay R Sathe: [http://localhost:4317/notice-DEMO-LN10022](http://localhost:4317/notice-DEMO-LN10022)
- Shweta Sudhir: [http://localhost:4317/notice-DEMO-LN10023](http://localhost:4317/notice-DEMO-LN10023)

The same page opens at `/?notice=DEMO-LN10021`, at `/notice?notice=DEMO-LN10021`, and at `/n/DEMO-LN10021`. Each notice uses the Being Vakil Associates letterhead (the header and footer from the firm’s Word stationery) and the signature and stamp. The letter is the demand notice for that person and that bank. The sheet is A4 (210mm × 297mm). Press **Print letter** to print it or save a PDF. After you sign in, the home page lists these three links. A number that is not on file shows **Notice not found** and no other person.

## Sign in as the owner

On the sign-in page, either press **Fill in this login** under Owner, or type:

- Email: `admin@noticedesk.local`
- Password: `admin123`

Then press **Sign in**.

You should see the name **Meera Iyer** and the role **Owner · Firm**. The bar at the top of the page is purple, the same purple as the Being Vakil mark. Until you choose a bank, the page says **No bank selected**. The top bar has **Send notice**, not separate Uploads and Campaigns tabs, and it does not have a Loans tab.

On this computer the sign-in page also says a one-time code is not used. That is the normal practice mode. The password above is enough.

### One-time code, only if MSG91 is set up

The one-time code is off unless you add keys to the `.env` file. All three of these have to be filled in before the owner is asked for a code:

- `MSG91_AUTH_KEY` is filled in
- `MSG91_OTP_TEMPLATE_ID` is filled in
- `MSG91_OTP_MOBILE` is the firm mobile that should receive the code, with the country code, such as `9198XXXXXXX`

Then the owner or a legal coordinator signs in with the email and password, and the next page asks for the code from that text message. A bank user still uses only the password. If any of those three lines is missing, the password alone still works, as it does now. The site never stores the MSG91 key in the browser.

## Sign in as a bank user

Press **Sign out**. Then use the other practice login, or type:

- Email: `viewer@noticedesk.local`
- Password: `viewer123`

Then press **Sign in**.

You should see the name **Arjun Kapoor**, the role **Bank user · One bank**, and the bank **Northwind Housing Finance**. The bar at the top of the page is green. There is no **Banks**, **People**, **Settings**, or **Audit** button. **Send notice**, **Templates**, and **Tracking** only show Northwind. Meridian Co-operative Bank and Harbour Credit do not appear.

These are sample people and sample banks, not real clients. The two screens are meant to look different so you can tell the roles apart.

## Practice banks

| Bank | Short code | Status | Who sees it |
| --- | --- | --- | --- |
| Northwind Housing Finance | NWH | Active | The bank-user login, and the owner once they choose it |
| Meridian Co-operative Bank | MCB | Active | The owner or a legal coordinator, once they choose it |
| Harbour Credit | HCR | Inactive | The owner or a legal coordinator |

## Add a bank (owner only)

1. Sign in as the owner.
2. Press **Banks**.
3. Type the bank’s name, for example `Sample Urban Bank`.
4. Type a short code of 2 to 8 letters or numbers, for example `SUB`. This is the bank’s id. It cannot match a code already in the list.
5. Press **Add bank**.
6. The new bank appears in the list as **Active**.

To stop using a bank, press **Mark inactive**. It stays in the list. Press **Mark active** to turn it back on.

## Choose which bank you are working on

The owner and a legal coordinator can press **Use this bank**. Only the owner can add a bank or mark one active.

1. On the **Banks** page, find the bank.
2. Press **Use this bank**.
3. The home page names that bank in large type, and the top of the page says **Working on** that bank.
4. To switch, press **Banks** or **Change bank**, then **Use this bank** on a different row.

A bank user cannot switch banks. Their home page always shows the one bank linked to their login.

You stay signed in on this browser for 7 days, or until you press **Sign out**.

## Upload a spreadsheet

The file has to belong to the bank you are working on. If the home page says **No bank selected**, press **Banks** and **Use this bank** first. The owner and a legal coordinator can upload. A bank user can look.

1. Sign in as the owner and choose a bank, for example **Northwind Housing Finance**.
2. Press **Send notice**.
3. Press **download notice-recipients.xlsx**, or use the file `samples/notice-recipients.xlsx` in this project folder. It is a practice list of three test recipients: Akshay Sathe, Akshay R Sathe, and Shweta Sudhir.
4. Press **Choose file** (the wording depends on the browser), pick that file, then press **Upload Excel**.
5. The next page lists the column names from the first row. Each notice field has a dropdown. Customer name is required. Leave a dropdown on **Not in this file** when the sheet does not have that detail. Empty optional cells are fine.
6. You can match up to three mobile columns. If one cell has two numbers separated by a comma or a slash, both are kept.
7. Press **Save column match**.
8. A table shows the first 10 people so you can check the names and numbers. Nothing is sent.

Upload the same file again. The dropdowns start from the match you saved for that bank. Change one if this new file uses a different heading, then save again.

A spreadsheet you upload is kept when you restart the site. It is wiped only if the database file is deleted.

## Notice templates

Approved notice wording is the firm library. While you work on any bank, including a bank you just added, **Select approved template** lists those templates. The three notice templates are marked Approved, so they appear for Test Bank, Meridian, and a bank you just added. A bank user and a legal coordinator see the template name and the channel (SMS, email, or WhatsApp). The owner admin also sees the reference id. The list does not say the wording was written for a practice bank. Select them on the bank you are working on. Adding a bank lists them immediately.

Staff do not write templates in Notice Desk. There is no **New template** button and no form for a draft. Open a row to read the name, the channel, and the message. The owner admin also sees the reference id.

A spreadsheet, the people in it, a send, a delivery row, and a notice stay on one bank. Sharing a template shares the wording only. People, spreadsheets, sends, and notices remain on their own bank.

The Approved library matches the live MSG91 templates:

- **Legal notice (SMS)** — SMS only. Reference `6abf5af2e9226c340a0548e2` (MSG91 flow Legal_Notice_12092026, sender BVAKIL). The message is the approved SMS wording, with customer name, bank name, and notice number in the places that flow reads them.
- **Legal notice (email)** — email only. Reference `legal_notice_non_payment`. Variables: contact name, loan account, and the notice link.
- **Legal notice (WhatsApp)** — WhatsApp only. Reference `legal_notice_link`. Variables: customer name, bank name, and the notice path for `https://www.notice.beingvakil.in/`.

The owner turns live send on or off in **Settings**. That choice is kept after a restart and overrides `MSG91_LIVE_SEND`. The switch starts on. A confirm still does not send until MSG91 is set up. A legal coordinator and a bank user cannot see the switch.

### Read a template

1. Sign in and choose a bank.
2. Press **Templates**.
3. Open **Legal notice (SMS)**, **Legal notice (email)**, or **Legal notice (WhatsApp)**. You see the name, the channel, and the message. The owner admin also sees the reference id. You cannot change them.

### See the notice filled in

1. Upload a spreadsheet for that same bank and save the column match, if you have not already.
2. Open the file from **Send notice**.
3. Under **Filled notice**, choose an approved template. The list includes Approved wording written for this bank and for any other bank. The people filled in are only the people saved on this spreadsheet.
4. The first three people are shown with their details dropped into the wording. An empty detail shows as **[not provided]**.
5. Nothing is sent.

Upload the practice file, save the column match, and choose **Legal notice (email)**. The first person should show the name **Akshay Sathe** and the loan number **LN10021**.

## Send a notice

A send belongs to the bank you are working on. It uses one saved spreadsheet for that bank and one approved MSG91 template. The same three templates are listed for every bank. The people on the send are only the people in that spreadsheet.

1. Sign in as the owner and choose a bank that already has a saved spreadsheet. The MSG91 templates are already Approved, so you do not need a template saved on that same bank.
2. Press **Send notice**.
3. Choose the spreadsheet, then choose the approved notice wording.
4. Tick **SMS**, **Email**, or **WhatsApp**. They start from the template, and you can change them. **Speed Post** is shown but cannot be ticked. It says **Coming soon**.
5. Press **Review who will get it**.
6. Read the counts, including how many people are skipped because they have no mobile or no email. Read the first few filled messages. An SMS shows a public link with that person’s notice number. **Open notice** shows the page the link will open.
7. Read the sentence at the top before you confirm. If live send is off, the button is **Confirm dry run**. If live send is on, the button is **Confirm send** and messages go out.

When the switch is off, the page then says the dry run finished and nothing was sent. Each person who could be reached is marked **Dry run**. A person who could not be reached is marked **Skipped**. No call is made to MSG91.

### When a real send is possible

The owner opens **Settings** and chooses **On** or **Off**, then presses **Save**. Off means confirming records a dry run. On means confirming sends through MSG91, but only after `MSG91_AUTH_KEY` is filled in. A key on its own does not send if the switch is off. For practice on your own computer, leave the MSG91 lines commented out, or turn the switch off, so a confirm cannot send.

SMS also needs `MSG91_SMS_FLOW_ID` set to `6abf5af2e9226c340a0548e2` (Legal_Notice_12092026, sender `BVAKIL`). Email needs `MSG91_EMAIL_FROM`, `MSG91_EMAIL_DOMAIN`, and `MSG91_EMAIL_TEMPLATE_ID` set to the template slug `legal_notice_non_payment` (not the numeric id). WhatsApp needs `MSG91_WHATSAPP_INTEGRATED_NUMBER`. It sends the template `legal_notice_link` in `en_US`, with the customer name, the bank name, and a URL button path `notice-<id>` for `https://www.notice.beingvakil.in/notice-<id>`. If one of those is missing, that channel is not sent and the row is marked failed. Do not put a real key in a copy of this project that other people can download.

## Add a login

There is no public signup, and the site does not email the new password.

1. Sign in as the owner and press **People**.
2. Enter the person’s name, email, and a password of at least 8 characters.
3. Choose **Legal coordinator** or **Bank user**. For a bank user, choose the one bank they can see.
4. Press **Add login**. Share the email and password yourself.

A legal coordinator can open **People** and add a bank user only. They cannot add another coordinator or an owner.

## What a bank user can see

Sign in as the bank user. Press **Send notice**. You see files for Northwind Housing Finance only, and only after the owner or a legal coordinator has uploaded one for that bank. Open a file to see the column match, the people, and the filled notice. There is no button to upload or to change the match.

Press **Templates**. You see **Legal notice (SMS)**, **Legal notice (email)**, and **Legal notice (WhatsApp)**, each with its channel. You do not see a vendor name or a template id. There is no **New template** button and no form to write a template.

After a notice has been confirmed for Northwind, open it from **Send notice** and see the result. There is no button to choose wording or to confirm. Press **Find a person** to search Northwind only. There is no bank dropdown. **Download CSV** is for Northwind only. There is no **Prepare follow-up** button. There is no **Audit** button and no **Settings** button. Opening the audit address shows a short message that the page is for the owner, and no events.

## Find a person and download a status report

1. Sign in and press **Find a person** on the home page or on **Tracking**.
2. Type a name, mobile, loan number, or customer id. The practice file uses loan **LN10021** for Akshay Sathe.
3. Press **Search**. Each row shows the channel and the status. A dry run says **Dry run**. It does not say Delivered.
4. You can narrow the list by notice, channel, status, and date. The owner or a legal coordinator changes bank on the Banks page first. A bank user cannot.
5. Press **Download CSV**. Excel can open the file. It has the same rows as the search, for that bank only.

Open a notice to see the same statuses, filter by channel or status, and download that notice’s CSV. Press **Reminders** to see people who were skipped or failed.

### Follow-up, still not sent

On **Reminders**, the owner or a legal coordinator who is working on that active bank can press **Prepare follow-up**. That makes another review for the same people, matched on loan number, customer id, or mobile. It does not send a message. Open **History** on a row to see the original send and the follow-up together. Confirm the follow-up the same way as any other send if you want it recorded. Read the live-send sentence first.

Speed Post stays **Coming soon**. It is not ticked, not sent, and has no courier status.

## Security and the audit log

The owner presses **Audit**, or **Security / Audit** on the home page.

The list shows who signed in, added or chose a bank, marked a bank active or inactive, uploaded a spreadsheet, saved a column match, created or approved a template, confirmed a dry run or a live send, prepared a follow-up, or downloaded a CSV. Filter by the kind of action, the bank, a name, and a date.

A legal coordinator and a bank user do not see this list. Each line names the person who signed in and their role. Passwords and the MSG91 key are not written into it.

Confirm a dry run, then open **Audit**. You should see a line for that dry run, and a line that you signed in.

## MSG91 delivery updates

This stays off until you choose a secret. In `.env`, set `MSG91_WEBHOOK_SECRET` to a private word of at least 8 characters. Do not put that word in a copy of the project that other people can download.

MSG91 can then POST a JSON update to:

`http://localhost:4317/api/msg91/webhook`

Send the secret in the header `x-notice-desk-secret`. A wrong secret, or no secret at all, is refused and changes nothing. If the line in `.env` is still commented out, every call is refused.

A useful body looks like this:

```json
{ "mobile": "919619871393", "channel": "SMS", "status": "delivered" }
```

`status` may be `delivered`, `read`, or `failed`. The site also understands an MSG91 report that uses `number` and `desc`, such as `DELIVERED`. The matching person has to be on a live send. In the practice file, `919619871393` is Akshay Sathe. A dry run stays **Dry run**.

## If the upload page says something is wrong

**“Choose a bank before uploading a spreadsheet.”**  
Press **Banks**, then **Use this bank**.

**“This bank is inactive.”**  
Press **Banks**, then **Mark active** on that bank.

**“Save the file as an Excel workbook (.xlsx).”**  
In Excel, use Save As and choose the .xlsx workbook type. Older .xls files are not accepted.

**“Choose the column that contains the customer name.”**  
The customer name dropdown was left on **Not in this file**. Pick the column that has the person’s name.

## If something goes wrong

**“npm is not recognised” or “command not found: npm”**  
Node.js is not installed, or the terminal was opened before you installed it. Install Node.js, then close the terminal and open a new one.

**The browser says it cannot connect**  
Check that the terminal is still running the site, and that the address is `http://localhost:4317`.

**“That email or password is not correct”**  
Copy the email and password from this page. Capitals matter in the password. `admin123` is all lower case.

**The page says it did not open**  
In the terminal, press Ctrl+C to stop the site, then run `npm run dev` again.

**You changed a practice password, a practice bank, or a practice template and it came back**  
That is expected. Starting the site again resets the two practice passwords, the three practice banks (NWH, MCB, and HCR), and the three MSG91 templates. Those templates stay Approved, so every bank can select them, and they are not labeled with a practice bank. A template you created on a bank of your own stays. Live send is not turned on.

**“A bank with the short code … already exists”**  
Pick a different short code. NWH, MCB, and HCR are already used.

## What this version does not do

- No real check that a DLT template id is registered
- No live SMS, email, or WhatsApp unless the MSG91 lines in `.env` are filled in and live send is turned on
- No one-time code unless those MSG91 lines are filled in (the practice password still works)
- No Speed Post, and no courier status
- No live reminder. A follow-up is only another review
- No MSG91 delivery update unless `MSG91_WEBHOOK_SECRET` is set. A dry run is never marked delivered by that update
- No public-server checklist in the app itself. See `NEXT_STEPS.md` before putting this site on the internet

## What each main folder and file does

You do not need to open these to use the site. This list is so a person can see what is what.

- `README.md` — this guide.
- `NEXT_STEPS.md` — optional later polish: Speed Post, a live-send checklist, and notes for putting the site on a real server.
- `package.json` — the commands (`npm run dev`) and the list of libraries.
- `.env` — a local file you create by copying `.env.example`. It tells the site where the database file is, and where optional MSG91 keys would go. It is not part of the download. Do not commit it once it has keys.
- `.env.example` — the spare copy of `.env`. It has no secrets.
- `prisma/schema.prisma` — the list of things we store: banks, people, spreadsheets, notice templates, sends, the audit log, and each signed-in visit.
- `samples/notice-recipients.xlsx` — a practice Excel file of three test recipients.
- `scripts/make-sample-workbook.mjs` — rebuilds that practice Excel file if you need a fresh copy.
- `prisma/seed.ts` — creates the practice users, the practice banks, and the three MSG91 templates. It also deletes unreferenced practice templates. A template a send already uses is taken out of Approved and left in place.
- `scripts/align-msg91-library.ts` — the same template update for an existing database, including Cloud SQL. Safe to run twice. It does not reset passwords, banks, people, notices, or campaigns, and it does not turn live send on. Run `npx tsx scripts/align-msg91-library.ts`.
- `prisma.config.ts` — tells the database tool to run that practice-user script.
- `prisma/dev.db` — the actual database file. It appears on your computer after the first start. It is not copied when someone downloads the project.
- `src/app/page.tsx` — the front door. It sends you to sign-in or to the dashboard.
- `src/app/login/page.tsx` — the sign-in page.
- `src/app/dashboard/page.tsx` — the page after sign-in. It shows the current bank.
- `src/app/banks/page.tsx` — where firm staff add banks and choose which one they are working on.
- `src/app/uploads/page.tsx` — the list of spreadsheets for the current bank, and the upload button for firm staff.
- `src/app/uploads/[id]/page.tsx` — match the columns, preview the first people, and fill a notice.
- `src/app/campaigns/page.tsx` — the list of sends for the current bank.
- `src/app/campaigns/new/page.tsx` — pick a spreadsheet, an approved template, and the channels.
- `src/app/campaigns/[id]/page.tsx` — review the counts and sample messages, confirm a dry run, and see each person’s status.
- `src/app/campaigns/[id]/reminders/page.tsx` — people who were skipped or failed, and the button that prepares a follow-up.
- `src/app/deliveries/page.tsx` — search sends for one bank by name, mobile, loan number, or customer id.
- `src/app/deliveries/person/page.tsx` — every send that shares a loan number, customer id, or mobile.
- `src/app/deliveries/export/route.ts` — the CSV download for a search.
- `src/app/campaigns/[id]/export/route.ts` — the CSV download for one campaign.
- `src/app/audit/page.tsx` — the Security / Audit list for firm staff.
- `src/app/api/msg91/webhook/route.ts` — where MSG91 can report delivered, read, or failed, once a secret is set.
- `src/app/login/otp/page.tsx` — the one-time code page, used only when MSG91 is set up.
- `src/app/templates/page.tsx` — the list of the firm’s approved MSG91 templates.
- `src/app/templates/[id]/page.tsx` — read one approved MSG91 template.
- `src/app/actions/auth.ts` — checks the password and signs you in or out.
- `src/app/actions/banks.ts` — adds a bank, marks it active or inactive, and sets the bank an Admin is working on.
- `src/app/actions/uploads.ts` — reads an Excel file and saves the matched people under the current bank.
- `src/app/actions/campaigns.ts` — saves a send, confirms the dry run, and prepares a follow-up without sending it.
- `src/app/layout.tsx` — the shared frame around every page (fonts and page title).
- `src/app/error.tsx` — the plain message you see if a page cannot open.
- `src/components/login-form.tsx` — the email box, password box, and practice-login buttons.
- `src/components/dashboard-home.tsx` — the screen that shows your name, role, and current bank.
- `src/components/app-header.tsx` — the top bar, including the current bank.
- `src/components/add-bank-form.tsx` — the boxes for a new bank’s name and short code.
- `src/components/bank-list.tsx` — the list of banks, with Use this bank and Mark inactive.
- `src/components/upload-form.tsx` — the button that picks an Excel file.
- `src/components/column-mapper.tsx` — the dropdowns that match spreadsheet columns to notice fields.
- `src/components/recipient-preview.tsx` — the table of the first people after a match is saved.
- `src/components/template-readout.tsx` — an approved template, read-only.
- `src/components/notice-merge-preview.tsx` — the filled-in notice for the first few people.
- `src/components/campaign-form.tsx` — the spreadsheet, template, and channel choices for a send.
- `src/components/confirm-campaign.tsx` — the button that confirms a dry run.
- `src/components/follow-up-button.tsx` — prepares a follow-up for skipped or failed rows. It does not send.
- `src/components/delivery-filters.tsx` — the search boxes for bank, campaign, channel, status, and date.
- `src/components/otp-form.tsx` — the one-time code box, used only when MSG91 is set up.
- `src/components/sign-out-button.tsx` — the Sign out button.
- `src/components/ui` — ready-made buttons, boxes, and text fields. Leave these alone unless you know the design kit.
- `src/lib/db.ts` — opens the database.
- `src/lib/auth.ts` — works out who is signed in from a short code stored in the browser.
- `src/lib/roles.ts` — the words we show for Admin and Bank Viewer.
- `src/lib/demo-accounts.ts` — the two practice emails and passwords.
- `src/lib/demo-banks.ts` — the three practice banks.
- `src/lib/demo-templates.ts` — the three approved MSG91 templates. The page does not credit a practice bank for them.
- `src/lib/banks.ts` — checks that a bank name and short code are usable.
- `src/lib/bank-context.ts` — which bank later work (such as a spreadsheet) must be filed under.
- `src/lib/sheet-fields.ts` — the notice fields a spreadsheet can fill, such as name, mobile, and loan number.
- `src/lib/parse-xlsx.ts` — reads the Excel file.
- `src/lib/apply-mapping.ts` — applies the column match and keeps more than one mobile number when a cell has several.
- `src/lib/notice-placeholders.ts` — the placeholders a template can use, such as `{{customer_name}}`.
- `src/lib/merge-notice.ts` — drops a person’s saved details into a template.
- `src/lib/templates.ts` — draft versus approved, and the SMS, Email, and WhatsApp labels.
- `src/lib/campaign-plan.ts` — works out who would be skipped on SMS, email, or WhatsApp.
- `src/lib/campaigns.ts` — the words shown for a dry run, a skip, delivered, and a finished send.
- `src/lib/delivery-report.ts` — the search rules and the CSV layout.
- `src/lib/report-bank.ts` — keeps a Bank Viewer on their own bank when they search or download.
- `src/lib/audit.ts` — writes and filters the audit log.
- `src/lib/msg91-webhook.ts` — reads a delivery update and applies it only to a live send.
- `src/lib/msg91.ts` — talks to MSG91 only when the keys are set. A dry run does not call it.
- `src/lib/phone.ts` — turns a mobile number into the form MSG91 expects.
- `src/lib/brand.ts` — the product name, “Notice Desk”.
- `node_modules` — libraries installed by `npm install`. Created on your computer. Do not edit.
- `.next` — a working folder the site builds while it runs. Do not edit.

## Commands, if you need them later

```bash
npm install     # first time only, or after the libraries change
npm run dev     # start the site at http://localhost:4317
npm run lint    # check the code for simple mistakes
npm run build   # make a production copy (not needed for everyday practice)
npm start       # run that production copy, still on port 4317
```
