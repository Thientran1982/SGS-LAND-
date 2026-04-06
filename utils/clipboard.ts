
/**
 * ROBUST CLIPBOARD UTILITY (Production Grade - v52.1)
 * -----------------------------------------------------------------------------
 * Handles copying text to clipboard with Modern Async Priority strategy.
 * 
 * LOGIC:
 * 1. Try `navigator.clipboard.writeText` (Modern, requires Secure Context & Focus).
 * 2. Fallback to `document.execCommand('copy')` (Legacy, works in more contexts).
 */

export const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;

    // Strategy 1: Modern Async Clipboard API (Preferred)
    // Works best in secure contexts (HTTPS) and focused documents.
    if (navigator?.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Common errors: "Write permission denied", "Document not focused"
            console.warn('[Clipboard] Async API failed, attempting legacy fallback...', err);
        }
    }

    // Strategy 2: Legacy execCommand (Fallback)
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // VISIBILITY TRICKS:
        // Prevent scrolling to bottom
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.width = "2em";
        textArea.style.height = "2em";
        textArea.style.padding = "0";
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";
        textArea.style.background = "transparent";
        
        // IOS SPECIFIC:
        // inputmode=none prevents virtual keyboard from appearing
        textArea.setAttribute("inputmode", "none"); 
        // readonly prevents keyboard but might block selection on some browsers? 
        // Setting contentEditable is safer for iOS selection range
        textArea.contentEditable = "true";
        textArea.readOnly = false; 

        document.body.appendChild(textArea);
        
        // SELECTION:
        textArea.focus({ preventScroll: true });
        textArea.select();
        
        // Robust Range Selection for Mobile (iOS needs explicit range)
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Standard select for desktop/android
        textArea.setSelectionRange(0, 999999); 
        
        // EXECUTE
        const success = document.execCommand('copy');
        
        // CLEANUP
        if (selection) selection.removeAllRanges();
        document.body.removeChild(textArea);
        
        if (success) return true;
        
    } catch (err) {
        console.error('[Clipboard] All copy strategies failed', err);
    }

    return false;
};
