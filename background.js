/**
 * Holds recent clicked download names and metadata.
 * We keep a short rolling window to handle delayed CMS responses.
 */
let pendingDownloads = []; // [{ name: string, at: number, url: string | null }]

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PENDING_DOWNLOAD_NAME' && message.name) {
        pendingDownloads.push({
            name: message.name,
            at: Date.now(),
            url: message.url || null
        });

        // Keep only recent entries to avoid stale matches.
        if (pendingDownloads.length > 20) {
            pendingDownloads = pendingDownloads.slice(-20);
        }
    }
});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    const MAX_AGE_MS = 60000; // allow up to 60 s for slower CMS downloads
    const now = Date.now();

    // Drop stale records first.
    pendingDownloads = pendingDownloads.filter((entry) => (now - entry.at) < MAX_AGE_MS);

    let chosen = null;

    // Prefer URL match if possible (exact or basename containment).
    if (downloadItem.finalUrl || downloadItem.url) {
        const itemUrl = downloadItem.finalUrl || downloadItem.url;
        const itemBase = itemUrl.split('?')[0].split('/').pop() || '';

        for (let i = pendingDownloads.length - 1; i >= 0; i--) {
            const entry = pendingDownloads[i];
            if (!entry.url) continue;

            const entryBase = entry.url.split('?')[0].split('/').pop() || '';
            const isMatch =
                entry.url === itemUrl ||
                (entryBase && itemBase && entryBase === itemBase) ||
                (entry.url && itemUrl && itemUrl.includes(entry.url));

            if (isMatch) {
                chosen = entry;
                pendingDownloads.splice(i, 1);
                break;
            }
        }
    }

    // Fallback: use most recent pending item.
    if (!chosen && pendingDownloads.length > 0) {
        chosen = pendingDownloads.pop();
    }

    if (chosen) {
        const rawName = chosen.name;

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