# CMS Lecture Renamer

Browser extension that renames downloaded CMS lecture files to their actual title instead of the random ID GIU's CMS gives them.

**Before:** `GIU_2959_68_29946_2026-03-07T14_34_50.pptx`
**After:** `1 - Lecture 2 (Lecture slides).pptx`

Built for GIU CMS.

## How it works

Reads the lecture title from the page when you hit **Download Content**, then renames the file on save. Nothing automated, nothing sent anywhere — only acts on files you choose to download.

## Install

Not on any store, so load it manually:

1. Clone this repo / download it as zip folder
2. Go to `edge://extensions` or `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `cms-renamer` folder

## Permissions

Only `downloads` — to rename the file at save time. No network, storage, or tabs access.

## Privacy

Runs entirely locally. No data collected, nothing sent anywhere, doesn't bypass login or DRM.

## License

MIT
