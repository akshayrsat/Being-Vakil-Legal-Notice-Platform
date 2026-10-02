# Notice Desk

This is a website for a law firm that sends legal notices for banks.

Two kinds of people can sign in:

- **Admin** — staff at the law firm. They keep the list of client banks and choose which bank they are working on.
- **Bank Viewer** — someone on the bank side. Their login is tied to one bank. They cannot see the other banks.

A send can be reviewed and confirmed as a dry run. It does not go out unless MSG91 is set up. After a dry run you can search by loan number, see each person’s status, and download a CSV. Firm staff can also open an audit log of who did what. See `NEXT_STEPS.md` for later polish.

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

The first start creates a small database on your computer, two practice users, three practice banks, and two practice notice templates for Northwind Housing Finance. You may see a line that says Prisma is skipping environment variable loading. That line is normal. Wait until the terminal says the site is ready, then open a browser and go to:

[http://localhost:4317](http://localhost:4317)

Leave the terminal window open while you use the site. Closing it, or pressing Ctrl+C in that window, stops the site.

The site uses port **4317** (not the usual 3000) so it is less likely to clash with another program.

Each time you run `npm run dev`, the two practice passwords are set back to the ones in this guide, and the three practice banks are reset. A bank you added yourself, with a different short code, stays. The bank an Admin last chose also stays. The two practice notice templates for Northwind are put back to the wording in this guide. A template you added yourself stays. A spreadsheet you uploaded stays. A send you confirmed stays. The three practice public notices are put back.

## Open a practice notice

These pages need no sign-in. Each one is a single recipient:

- Akshay Sathe: [http://localhost:4317/?notice=DEMO-LN10021](http://localhost:4317/?notice=DEMO-LN10021)
- Akshay R Sathe: [http://localhost:4317/?notice=DEMO-LN10022](http://localhost:4317/?notice=DEMO-LN10022)
- Shweta Sudhir: [http://localhost:4317/?notice=DEMO-LN10023](http://localhost:4317/?notice=DEMO-LN10023)

The same page opens at `/notice?notice=DEMO-LN10021` and at `/n/DEMO-LN10021`. After you sign in, the home page lists these three links. A number that is not on file shows **Notice not found** and no other person.

## Sign in as Admin (firm staff)

On the sign-in page, either press **Fill in this login** under Admin, or type:

- Email: `admin@noticedesk.local`
- Password: `admin123`

Then press **Sign in**.

You should see the name **Meera Iyer** and the role **Admin · Firm staff**. The bar at the top of the page is navy. Until you choose a bank, the page says **No bank selected**.

On this computer the sign-in page also says a one-time code is not used. That is the normal practice mode. The password above is enough.

### One-time code, only if MSG91 is set up

MSG91 is off unless you add keys to the `.env` file. All three of these have to be filled in before an Admin is asked for a code:

- `MSG91_AUTH_KEY` is filled in
- `MSG91_OTP_TEMPLATE_ID` is filled in
- `MSG91_OTP_MOBILE` is the firm mobile that should receive the code, with the country code, such as `9198XXXXXXX`

Then an Admin signs in with the email and password, and the next page asks for the code from that text message. A Bank Viewer still uses only the password. If any of those three lines is missing, the password alone still works, as it does now. The site never stores the MSG91 key in the browser.

## Sign in as Bank Viewer

Press **Sign out**. Then use the other practice login, or type:

- Email: `viewer@noticedesk.local`
- Password: `viewer123`

Then press **Sign in**.

You should see the name **Arjun Kapoor**, the role **Bank Viewer · Bank side**, and the bank **Northwind Housing Finance**. The bar at the top of the page is green. There is no **Banks** button. **Uploads**, **Templates**, and **Campaigns** only show Northwind. Meridian Co-operative Bank and Harbour Credit do not appear.

These are sample people and sample banks, not real clients. The two screens are meant to look different so you can tell the roles apart.

## Practice banks

| Bank | Short code | Status | Who sees it |
| --- | --- | --- | --- |
| Northwind Housing Finance | NWH | Active | The Bank Viewer login, and Admin once they choose it |
| Meridian Co-operative Bank | MCB | Active | Admin only, until they choose it |
| Harbour Credit | HCR | Inactive | Admin only |

## Add a bank (Admin only)

1. Sign in as Admin.
2. Press **Banks**.
3. Type the bank’s name, for example `Sample Urban Bank`.
4. Type a short code of 2 to 8 letters or numbers, for example `SUB`. This is the bank’s id. It cannot match a code already in the list.
5. Press **Add bank**.
6. The new bank appears in the list as **Active**.

To stop using a bank, press **Mark inactive**. It stays in the list. Press **Mark active** to turn it back on.

## Choose which bank you are working on (Admin only)

1. On the **Banks** page, find the bank.
2. Press **Use this bank**.
3. The home page names that bank in large type, and the top of the page says **Working on** that bank.
4. To switch, press **Banks** or **Change bank**, then **Use this bank** on a different row.

A Bank Viewer cannot switch banks. Their home page always shows the one bank linked to their login.

You stay signed in on this browser for 7 days, or until you press **Sign out**.

## Upload a spreadsheet (Admin only)

The file has to belong to the bank you are working on. If the home page says **No bank selected**, press **Banks** and **Use this bank** first.

1. Sign in as Admin and choose a bank, for example **Northwind Housing Finance**.
2. Press **Uploads**.
3. Press **download notice-recipients.xlsx**, or use the file `samples/notice-recipients.xlsx` in this project folder. It is a practice list of three test recipients: Akshay Sathe, Akshay R Sathe, and Shweta Sudhir.
4. Press **Choose file** (the wording depends on the browser), pick that file, then press **Upload Excel**.
5. The next page lists the column names from the first row. Each notice field has a dropdown. Customer name is required. Leave a dropdown on **Not in this file** when the sheet does not have that detail. Empty optional cells are fine.
6. You can match up to three mobile columns. If one cell has two numbers separated by a comma or a slash, both are kept.
7. Press **Save column match**.
8. A table shows the first 10 people so you can check the names and numbers. Nothing is sent.

Upload the same file again. The dropdowns start from the match you saved for that bank. Change one if this new file uses a different heading, then save again.

A spreadsheet you upload is kept when you restart the site. It is wiped only if the database file is deleted.

## Notice templates

A template belongs to one bank. Northwind’s templates do not appear when you are working on Meridian, and the other way around. There is no firm-wide template list.

Two practice templates are already approved for **Northwind Housing Finance**:

- **Loan recall notice (SMS)** — an SMS, with the customer’s name, the amount outstanding, and the loan number.
- **Borrower email notice** — tagged Email and WhatsApp, with the name, email, address, and mobile.

They are practice wording, not real DLT registrations.

### Add or change a template (Admin only)

1. Sign in as Admin and choose a bank.
2. Press **Templates**, then **New template**.
3. Type a name, such as `Practice demand notice`.
4. Type a DLT template id if you have one. Any short id is accepted here. The site does not check it with a phone company.
5. Tick **SMS**, **Email**, or **WhatsApp**. You can tick more than one. Tick at least one.
6. Write the notice. Press a placeholder button, such as **Customer name**, to insert `{{customer_name}}` where that person’s detail should go. Other placeholders include `{{loan_number}}`, `{{outstanding_amount}}`, `{{mobile}}`, and `{{email}}`.
7. Leave the status on **Draft** while you are still writing. A draft is saved, but it cannot be used to fill a notice.
8. When the wording is ready, set the status to **Approved**. Approved needs a DLT template id.
9. Press **Save template**.

To change one, press **Edit** on its row. An inactive bank can still show its templates, but you cannot save changes until you mark the bank active.

### See the notice filled in

1. Upload a spreadsheet for that same bank and save the column match, if you have not already.
2. Open the file from **Uploads**.
3. Under **Filled notice**, choose an approved template.
4. The first three people are shown with their details dropped into the wording. An empty detail shows as **[not provided]**.
5. Nothing is sent.

Upload the practice file, save the column match, and choose **Borrower email notice**. The first person should show the name **Akshay Sathe** and the loan number **LN10021**.

## Prepare a send (dry run)

A send belongs to the bank you are working on. It uses one saved spreadsheet and one **Approved** template. Draft templates are not listed.

1. Sign in as Admin and choose a bank that already has a saved spreadsheet and an approved template. Northwind does, after you have uploaded the practice file.
2. Press **Campaigns**, then **Prepare a send**. You can also press **Prepare a send** on an open spreadsheet.
3. Choose the spreadsheet and the template.
4. Tick **SMS**, **Email**, or **WhatsApp**. They start from the template, and you can change them. **Speed Post** is shown but cannot be ticked. It says **Coming soon**.
5. Press **Review send**.
6. Read the counts, including how many people are skipped because they have no mobile or no email. Read the first few filled messages. An SMS shows a public link with that person’s notice number. **Open notice** shows the page the link will open.
7. Press **Confirm dry run**.

The page then says **Dry run finished. Nothing was sent.** Each person who could be reached is marked **Dry run**. A person who could not be reached is marked **Skipped**. No call is made to MSG91.

### When a real send is possible

Leave the MSG91 lines in `.env` commented out to stay on the dry run. That is the right setup for practice.

To allow a live send later, fill in `MSG91_AUTH_KEY` and set `MSG91_LIVE_SEND=true`. A key on its own does not send anything. SMS also needs `MSG91_SMS_FLOW_ID` and `MSG91_SENDER_ID`. Email needs `MSG91_EMAIL_FROM`, `MSG91_EMAIL_DOMAIN`, and `MSG91_EMAIL_TEMPLATE_ID`. WhatsApp needs `MSG91_WHATSAPP_INTEGRATED_NUMBER` and `MSG91_WHATSAPP_TEMPLATE`. If one of those is missing, that channel is not sent and the row is marked failed. Do not put a real key in a copy of this project that other people can download.

## What a Bank Viewer can see

Sign in as the Bank Viewer. Press **Uploads**. You see files for Northwind Housing Finance only, and only after an Admin has uploaded one for that bank. Open a file to see the column match, the people, and the filled notice. There is no button to upload or to change the match.

Press **Templates**. You see Northwind’s templates, including the two practice ones. Open one to read it. There is no **New template** button and no **Save template** button.

Press **Campaigns**. After an Admin has confirmed a send for Northwind, you can open it and see the dry-run result. There is no **Prepare a send** button and no **Confirm dry run** button. Press **Find a person** to search Northwind only. There is no bank dropdown. **Download CSV** is for Northwind only. There is no **Prepare follow-up** button. There is no **Audit** button. Opening the audit address shows a short message that the page is for firm staff, and no events.

## Find a person and download a status report

1. Sign in and press **Find a person** on the home page or on **Campaigns**.
2. Type a name, mobile, loan number, or customer id. The practice file uses loan **LN10021** for Akshay Sathe.
3. Press **Search**. Each row shows the channel and the status. A dry run says **Dry run**. It does not say Delivered.
4. You can narrow the list by campaign, channel, status, and date. An Admin can also pick a bank. A Bank Viewer cannot.
5. Press **Download CSV**. Excel can open the file. It has the same rows as the search, for that bank only.

Open a campaign to see the same statuses, filter by channel or status, and download that campaign’s CSV. Press **Reminders** to see people who were skipped or failed.

### Follow-up, still not sent

On **Reminders**, an Admin who is working on that active bank can press **Prepare follow-up**. That makes another review for the same people, matched on loan number, customer id, or mobile. It does not send a message. Open **History** on a row to see the original send and the follow-up together. Confirm the follow-up the same way as any other dry run if you want it recorded.

Speed Post stays **Coming soon**. It is not ticked, not sent, and has no courier status.

## Security and the audit log

Firm staff press **Audit**, or **Security / Audit** on the home page.

The list shows who signed in, added or chose a bank, marked a bank active or inactive, uploaded a spreadsheet, saved a column match, created or approved a template, confirmed a dry run or a live send, prepared a follow-up, or downloaded a CSV. Filter by the kind of action, the bank, a name, and a date.

A Bank Viewer does not see this list. Passwords and the MSG91 key are not written into it.

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
That is expected. Starting the site again resets the two practice passwords, the three practice banks (NWH, MCB, and HCR), and the two Northwind practice templates. A template you created yourself stays.

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
- `prisma/seed.ts` — creates the practice users, the practice banks, and the two practice templates.
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
- `src/app/templates/page.tsx` — the list of notice templates for the current bank.
- `src/app/templates/new/page.tsx` — where firm staff write a new template.
- `src/app/templates/[id]/page.tsx` — read or edit one template.
- `src/app/actions/auth.ts` — checks the password and signs you in or out.
- `src/app/actions/banks.ts` — adds a bank, marks it active or inactive, and sets the bank an Admin is working on.
- `src/app/actions/uploads.ts` — reads an Excel file and saves the matched people under the current bank.
- `src/app/actions/templates.ts` — saves a notice template under the current bank.
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
- `src/components/template-form.tsx` — the boxes for a template’s name, DLT id, channels, and notice text.
- `src/components/template-readout.tsx` — the same template, read-only, for a bank viewer.
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
- `src/lib/demo-templates.ts` — the two practice notice templates for Northwind.
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
