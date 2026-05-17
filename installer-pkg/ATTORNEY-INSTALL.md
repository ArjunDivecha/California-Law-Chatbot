# Installing the F&F Privacy Filter

You'll do this once on your laptop. It takes about 5 minutes. After this, the chatbot will protect client names and addresses automatically every time you use it.

## Before you start

You need:
- The file **FFLP-Sanitizer-1.0.0.pkg** (Arjun will email it to you)
- About 3 GB of free disk space on your Mac
- Your Mac's login password (the one you type to unlock your screen)

## Step 1 — Save the file

Open the email from Arjun, click the attachment, and save it to your Downloads folder. You'll see the file in Finder when you open Downloads.

## Step 2 — Right-click to open

**Don't double-click it.** That's important. Instead:

1. Open the **Downloads** folder in Finder.
2. **Right-click** (or Control-click, or two-finger click on a trackpad) the file **FFLP-Sanitizer-1.0.0.pkg**.
3. From the menu that appears, choose **Open**.

A window will pop up that says something like *"FFLP-Sanitizer-1.0.0.pkg" can't be opened because Apple cannot check it for malicious software*. There will be a button labeled **Open Anyway**. **Click Open Anyway.**

(If you double-clicked by accident and the warning didn't have an "Open Anyway" button — just close it, go back to Finder, and right-click → Open. That works.)

## Step 3 — Install

A normal-looking Apple installer window opens. Walk through it:

1. Click **Continue**.
2. Click **Install**.
3. Your Mac will ask for your **login password**. Type it. (Or use Touch ID if you've set that up.)
4. Wait for the green "Installation Successful" check mark. This takes a couple of minutes — your Mac is unpacking about 2 GB.
5. Click **Close**.

## Step 4 — Verify it's working

The privacy filter starts itself automatically. You don't have to do anything — it'll run quietly in the background every time your Mac is on. To check it's running:

1. Open the chatbot at https://california-law-chatbot-v2.vercel.app/v2.
2. Type something into the chat that contains a person's name, like *"What does my client John Smith need to do?"*.
3. As you type, look at the gray chip under the text box. After a moment, it should turn yellow and say something like **"1 privileged span will be tokenized before send"** with `CLIENT_001 ← John Smith` below it.

If you see that yellow chip with the swap symbol, you're done. The filter is working.

## Troubleshooting

**The chip stays gray and says "Checking…"**
Wait 30 seconds. The first time the filter runs after install, it loads its detection model, which takes about 15 seconds. After that it's instant.

**The chip says "Privacy filter not detected" in red**
Something didn't install correctly. Email Arjun the screenshot. As a quick check, open Terminal (Cmd+Space → "Terminal") and paste this line:
```
curl http://localhost:47841/v1/health
```
You should see a JSON response with `"ok": true`. If you see "Connection refused" instead, the filter isn't running and we'll need to look at it together.

**I want to uninstall**
Email Arjun. There's a 5-second command to fully remove it. (Or run `sudo /Library/Application\ Support/FFLP/gliner-daemon/bin/uninstall.sh` if it gets bundled.)

## What this filter actually does

When you type a client's name into the chatbot, the filter recognizes it on your Mac before the chatbot sends anything to Anthropic. Names, addresses, phone numbers, SSNs, and dates get swapped for opaque tokens (`CLIENT_001`, `ADDRESS_007`) before the request leaves your laptop. The chatbot still shows the real names back to you because your Mac swaps them back in locally — Anthropic only ever sees the tokens.

That's the technical guarantee F&F partners signed off on in the §Q memo. The filter is the thing that makes that guarantee real.
