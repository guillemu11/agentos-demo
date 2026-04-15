/**
 * Marketing Cloud Error Translation
 *
 * Maps SFMC API error codes and HTTP statuses to human-friendly messages.
 */

const MC_ERROR_PATTERNS = [
    { match: /unauthorized|invalid.*token/i, msg: 'MC session expired or invalid. The token will be auto-refreshed on the next call.' },
    { match: /forbidden|insufficient.*permission/i, msg: 'Your MC account lacks permission for this operation. Check your installed package permissions in MC Setup.' },
    { match: /data extension.*not found|customobject.*not found/i, msg: 'Data Extension not found. Double-check the external key (it\'s case-sensitive).' },
    { match: /field.*not found|invalid.*field/i, msg: 'One or more field names are invalid for this Data Extension. Use mc_query_data_extension to see available fields.' },
    { match: /duplicate.*key|already exists/i, msg: 'An object with that key already exists. Use a different customerKey or update the existing one.' },
    { match: /primary key.*required|missing.*primary/i, msg: 'A primary key field is required to upsert rows. Make sure the DE has a primary key defined.' },
    { match: /rate limit|too many requests|429/i, msg: 'MC API rate limit hit. Wait a moment and try again.' },
    { match: /not found|404/i, msg: 'The requested resource was not found in Marketing Cloud.' },
    { match: /bad request|400/i, msg: 'Invalid request to MC API. Check the parameters and try again.' },
    { match: /internal server error|500/i, msg: 'Marketing Cloud returned an internal error. This is usually temporary — try again in a minute.' },
    { match: /service unavailable|503/i, msg: 'Marketing Cloud is temporarily unavailable. Try again in a few minutes.' },
    { match: /timeout|ETIMEDOUT|ECONNRESET/i, msg: 'Connection to Marketing Cloud timed out. Check if MC is accessible and try again.' },
    { match: /ENOTFOUND|ECONNREFUSED/i, msg: 'Cannot reach Marketing Cloud servers. Check the auth URL in your MC credentials.' },
];

/**
 * Translate an MC API error into a human-friendly message.
 * @param {Error} err - The original error
 * @returns {string} Human-friendly error description
 */
export function translateMCError(err) {
    const msg = err.message || String(err);

    for (const pattern of MC_ERROR_PATTERNS) {
        if (pattern.match.test(msg)) {
            return pattern.msg;
        }
    }

    // If we have an MC response body with more detail
    if (err.mcResponse && typeof err.mcResponse === 'object') {
        const detail = err.mcResponse.message || err.mcResponse.errorMessage || err.mcResponse.error_description;
        if (detail) return `MC API error: ${detail}`;
    }

    // Fallback: return the original message, trimmed
    return `MC API error: ${msg.substring(0, 200)}`;
}
