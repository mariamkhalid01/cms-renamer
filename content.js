/**
 * Extracts the lecture name for the CMS download button that was clicked.
 *
 * DOM structure observed on the CMS:
 *   <div class="card ...">          <- card root
 *     ...
 *     "1 - Lecture 2 (Lecture slides)"   <- text node / element we want
 *     ...
 *     <a class="btn btn-primary contentbtn" id="download" ...>Download Content</a>
 *     ...
 *   </div>
 */
function resolveDownloadName(clickedEl) {
    // ── Strategy 1: walk up to the nearest card and scrape its label text ──
    let card = clickedEl.closest(
        '.card, .weeksdata, [class*="week"], [class*="content"], .row, .panel, .list-group-item'
    );

    if (card) {
        const name = extractLabelFromContainer(card, clickedEl);
        if (name) return name;
    }

    // ── Strategy 2: look at every ancestor up to 8 levels ──
    let el = clickedEl.parentElement;
    for (let i = 0; i < 8; i++) {
        if (!el) break;
        const name = extractLabelFromContainer(el, clickedEl);
        if (name) return name;
        el = el.parentElement;
    }

    return null;
}

/**
 * Inside `container`, find text that looks like a lecture title.
 * We skip the subtree that contains `skipEl` (the button itself).
 */
function extractLabelFromContainer(container, skipEl) {
    // Collect all text nodes and inline/block elements that are NOT buttons/inputs
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Skip the button subtree
                if (skipEl && (skipEl === parent || skipEl.contains(parent) || parent.contains(skipEl))) {
                    return NodeFilter.FILTER_REJECT;
                }

                // Skip buttons, inputs, icons, scripts
                const tag = parent.tagName.toLowerCase();
                if (['button', 'input', 'script', 'style', 'i', 'svg'].includes(tag)) {
                    return NodeFilter.FILTER_REJECT;
                }

                const text = node.textContent.trim();
                if (text.length < 4) return NodeFilter.FILTER_SKIP;

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let best = null;
    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (!isGeneric(text)) {
            // Prefer the first meaningful non-generic line
            best = text;
            break;
        }
    }

    return best;
}

/** Generic button/UI labels that are definitely NOT a lecture name. */
function isGeneric(text) {
    return /^(download(\s+content)?|watch\s+video|report(\s+and\s+issue)?|view|open|click\s+here|here|file|attachment|content|count\s+rated.*|\d+)$/i
        .test(text.trim());
}

// Capture phase — runs before CMS JS, catches all click events
document.addEventListener('click', function (e) {
    // Only care about the CMS download button (a.contentbtn or a#download)
    const link = e.target.closest('a.contentbtn, a#download, a[download]');
    if (!link) return;

    const name = resolveDownloadName(link);
    if (name) {
        chrome.runtime.sendMessage({ type: 'PENDING_DOWNLOAD_NAME', name });
    }
}, true);