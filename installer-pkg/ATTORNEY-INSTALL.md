# Installing the F&F Privacy Filter

You'll do this once on your laptop. It takes about 5 minutes. After this, the chatbot will protect client names and addresses automatically every time you use it.

## Before you start

You need:
- The Dropbox link to **FFLP-Sanitizer-1.0.1.pkg** (Arjun sent this to you)
- About 3 GB of free disk space on your Mac
- Your Mac's login password (the one you type to unlock your screen)

## Step 1 — Download the file

Click the Dropbox link Arjun sent you. Dropbox will show a preview page with a **Download** button (top right). Click it. Save to your **Downloads** folder. The download is about 2 GB so it'll take a couple of minutes on a normal connection.

When it finishes, open the **Downloads** folder in Finder. You should see **FFLP-Sanitizer-1.0.1.pkg** there.

## Step 2 — Right-click to open

**Don't double-click it.** That's important. Instead:

1. Open the **Downloads** folder in Finder.
2. **Right-click** (or Control-click, or two-finger click on a trackpad) the file **FFLP-Sanitizer-1.0.1.pkg**.
3. From the menu that appears, choose **Open**.

A window will pop up that says something like *"FFLP-Sanitizer-1.0.1.pkg" can't be opened because Apple cannot check it for malicious software*. There will be a button labeled **Open Anyway**. **Click Open Anyway.**

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

## Step 5 — Clean up older versions (only if you tested an earlier one)

**Skip this section if this is your first time installing anything from Arjun.** This is only for the few people who got an earlier dev version during testing.

We tested two earlier privacy filters (internally called "OPF" and the dev GLiNER build) before settling on the one in this installer. They no longer do anything — the new installer replaces them entirely — but if either one was ever set up on your Mac, it's sitting on disk taking up roughly 1 GB and running a small process you don't need.

To remove them cleanly:

1. Open **Terminal** (press Cmd+Space, type `Terminal`, press Return).
2. Copy and paste this exact block, then press Return:

```
launchctl unload ~/Library/LaunchAgents/com.fflp.opf-daemon.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.fflp.gliner-daemon.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.fflp.opf-daemon.plist
rm -rf ~/.opf-daemon
rm -rf ~/.gliner-daemon
launchctl load ~/Library/LaunchAgents/com.fflp.gliner-daemon.plist 2>/dev/null
echo "Cleanup done."
```

3. You should see `Cleanup done.` printed at the end. Close Terminal.

The block is safe to run even if you never had those older versions installed — it checks for each thing and silently skips anything that isn't there. It does NOT touch the new privacy filter from this installer; the last line restarts it cleanly so the chip in the chatbot keeps working.

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
Email Arjun. There's a 5-second command to fully remove it.

## What this filter actually does

When you type a client's name into the chatbot, the filter recognizes it on your Mac before the chatbot sends anything to Anthropic. Names, addresses, phone numbers, SSNs, and dates get swapped for opaque tokens (`CLIENT_001`, `ADDRESS_007`) before the request leaves your laptop. The chatbot still shows the real names back to you because your Mac swaps them back in locally — Anthropic only ever sees the tokens.

That's the technical guarantee F&F partners signed off on in the §Q memo. The filter is the thing that makes that guarantee real.
