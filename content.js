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
    const pageTitle = resolvePageTitle(clickedEl);
    if (pageTitle) return pageTitle;

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
 * Prefer the visible page title/header on admin pages.
 */
function resolvePageTitle(clickedEl) {
    const pageRoots = [
        document.querySelector('.app-page-title'),
        document.querySelector('.page-title-wrapper'),
        document.querySelector('.page-title-heading'),
        clickedEl.closest('.app-page-title'),
        clickedEl.closest('.page-title-wrapper'),
        clickedEl.closest('.page-title-heading')
    ].filter(Boolean);

    for (const root of pageRoots) {
        const title = extractTitleFromRoot(root, clickedEl);
        if (title) return title;
    }

    return null;
}

/**
 * Extract a real title from a header-like container.
 */
function extractTitleFromRoot(root, skipEl) {
    const titleSelectors = [
        '.page-title-heading',
        'h1',
        'h2',
        'h3',
        '[class*="title"]',
        '[class*="heading"]',
        '[data-title]'
    ];

    for (const selector of titleSelectors) {
        const candidates = root.matches(selector)
            ? [root]
            : Array.from(root.querySelectorAll(selector));

        for (const candidate of candidates) {
            if (skipEl && (skipEl === candidate || skipEl.contains(candidate))) continue;

            const text = extractBestText(candidate, skipEl);
            if (text) return text;

            const value = extractBestValue(candidate, skipEl);
            if (value) return value;
        }
    }

    return null;
}

/**
 * Inside `container`, find text that looks like a lecture title.
 * We skip the subtree that contains `skipEl` (the button itself).
 */
function extractLabelFromContainer(container, skipEl) {
    const formValue = extractValueFromControls(container, skipEl);
    if (formValue) return formValue;

    const textValue = extractBestText(container, skipEl);
    if (textValue) return textValue;

    // Fallback: line-by-line scan from visible text in case text-node traversal misses.
    const lines = (container.innerText || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 4)
        .filter((line) => !isGeneric(line));

    // Prefer lecture/module-like lines first.
    const preferred = lines.find((line) => /(^\d+\s*[-:]\s*)|(lecture|module|wk\s*\d+)/i.test(line));
    return preferred || lines[0] || null;
}

function extractBestText(container, skipEl) {

    // Collect all text nodes and inline/block elements that are NOT buttons/inputs
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                // Skip the button subtree
                if (skipEl && (skipEl === parent || skipEl.contains(parent))) {
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
    let bestScore = -1;
    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        const score = scoreTitleCandidate(text);
        if (score > bestScore) {
            best = text;
            bestScore = score;
        }
    }

    return bestScore > 0 ? best : null;
}

function extractBestValue(container, skipEl) {
    const value = extractValueFromControls(container, skipEl);
    return value || null;
}

/**
 * Prefer an explicit user-entered value from nearby form controls.
 */
function extractValueFromControls(container, skipEl) {
    const controls = container.querySelectorAll(
        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select, [contenteditable="true"]'
    );

    let best = null;
    let bestScore = -1;

    controls.forEach((control) => {
        if (skipEl && (skipEl === control || skipEl.contains(control))) return;

        let value = '';
        if (control.matches('[contenteditable="true"]')) {
            value = control.innerText || control.textContent || '';
        } else if ('value' in control) {
            value = control.value || '';
        }

        value = value.trim();
        const score = scoreTitleCandidate(value);
        if (score <= 0) return;

        if (score > bestScore || (score === bestScore && value.length > best.length)) {
            best = value;
            bestScore = score;
        }
    });

    return best;
}

function scoreTitleCandidate(text) {
    const value = text.trim();
    if (!value || isGeneric(value)) return 0;
    if (value.length < 4) return 0;

    let score = value.length;

    if (/\s/.test(value)) score += 12;
    if (/[()\-:]/.test(value)) score += 6;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 6;
    if (/\d/.test(value)) score += 2;
    if (/^[A-Z0-9 _.-]+$/.test(value)) score -= 8;
    if (/^[A-Z]{2,6}$/.test(value)) score -= 12;
    if (/^\d+[\s_-]*$/.test(value)) score -= 20;
    if (/^(giu|cms)$/i.test(value)) score -= 20;

    return score;
}

/** Generic button/UI labels that are definitely NOT a lecture name. */
function isGeneric(text) {
    return /^(download(\s+content)?|watch\s+video|report(\s+and\s+issue)?|view|open|click\s+here|here|file|attachment|content|count\s+rated.*|order\s*\(?\s*\d+\s*\)?|\d+|order|edit|save|update|create|add|remove|delete|cancel|back|next|previous|submit|clear|search|reset)$/i
        .test(text.trim());
}

// Capture phase — runs before CMS JS, catches all click events
document.addEventListener('click', function (e) {
    // Only care about the CMS download button (a.contentbtn or a#download)
    const link = e.target.closest('a.contentbtn, a#download, a[download]');
    if (!link) return;

    const name = resolveDownloadName(link);
    if (name) {
        chrome.runtime.sendMessage({
            type: 'PENDING_DOWNLOAD_NAME',
            name,
            url: link.href || null
        });
    }
}, true);