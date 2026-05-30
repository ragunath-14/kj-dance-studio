# KJ Dance Studio - WhatsApp Messaging System (WhatsApp-Web.js)

The system has been migrated from the Meta WhatsApp Cloud API to **whatsapp-web.js**. This allows for free, template-free messaging by using a real WhatsApp session.

---

## How it Works
1.  The server uses a headless browser (Puppeteer) to log into WhatsApp Web.
2.  Authentication is persistent using `LocalAuth`.
3.  Messages are sent as plain text, so Meta template approval is NO LONGER REQUIRED.

## Initial Setup
1.  Run the server or the test script (`node test_whatsapp_web.js`).
2.  A QR code will appear in the terminal.
3.  Scan it with your phone (WhatsApp > Linked Devices > Link a Device).
4.  Once scanned, the session is saved in the `./.wwebjs_auth` folder.

---

## Message Formats (Plain Text)

### 1. Welcome Registration
> Hello {Student Name}, Welcome to {Class Type} at KJ Dance Studio! 💃
>
> We are excited to have you join us! ✨

### 2. Fee Reminder
> Hello {Student Name}, this is a gentle reminder that your fee of Rs.{Total Due} is pending for {Pending Months} month(s). 💸
>
> Please clear it soon. Thank you!

### 3. Payment Receipt
> Hello {Student Name}, we have successfully received your payment of Rs.{Amount} for {Purpose} on {Date}. 🧾
>
> Thank you!

### 4. Rejoin Invitation
> Hey {Student Name}! 💃 We miss you at KJ Dance Studio. Our new batches have started and we'd love to have you back. Come join us! ✨

---

## Troubleshooting
- **QR Code not appearing:** Check the terminal logs. Ensure dependencies are installed (`npm install`).
- **Session Disconnected:** If the client disconnects, a new QR code will be generated in the terminal.
- **Number format:** The system automatically cleans numbers and adds the `91` prefix for 10-digit Indian numbers.

