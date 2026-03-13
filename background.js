/**
 * Holds the most recently clicked download name and when it was set.
 * We only apply it if the download starts within 5 seconds of the click.
 */
let pendingDownload = null; // { name: string, at: number }

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PENDING_DOWNLOAD_NAME' && message.name) {
        pendingDownload = { name: message.name, at: Date.now() };
    }
});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    const MAX_AGE_MS = 5000; // ignore if click was more than 5 s ago

    if (pendingDownload && (Date.now() - pendingDownload.at) < MAX_AGE_MS) {
        const rawName = pendingDownload.name;
        pendingDownload = null; // consume so the next unrelated download isn't affected

        // Preserve the original file extension
        const originalExt = downloadItem.filename.includes('.')
            ? downloadItem.filename.split('.').pop().toLowerCase()
            : '';

        // Sanitise: strip characters that are illegal in filenames
        const cleanName = rawName
            .replace(/[<>:"/\\|?*\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (cleanName && originalExt) {
            suggest({ filename: cleanName + '.' + originalExt });
            return; // tell Chrome we handled it
        }
    }

    suggest(); // fall back to whatever Chrome would choose
});