/**
 * Salesforce Marketing Cloud API Client
 *
 * OAuth2 client_credentials flow with in-memory token cache.
 * Provides REST + SOAP wrappers with auto-refresh and retry.
 */

// ─── Token cache (module-level singleton) ────────────────────────────────────
let _tokenCache = null; // { accessToken, expiresAt, restUrl, soapUrl }

/**
 * Create an MC client from encrypted credentials stored in workspace_config.
 * @param {import('pg').Pool} pool
 * @param {Function} decryptValue - AES-256-CBC decrypt function from server.js
 * @returns {object} MC client with .rest(), .soap(), .isConfigured(), .getToken()
 */
export function createMCClient(pool, decryptValue) {
    let _creds = null; // lazy-loaded

    async function loadCredentials() {
        if (_creds) return _creds;
        const res = await pool.query("SELECT value FROM workspace_config WHERE key = 'api_keys'");
        if (res.rows.length === 0) return null;
        const keys = res.rows[0].value;
        const clientId = keys.mc_client_id ? decryptValue(keys.mc_client_id) : null;
        const clientSecret = keys.mc_client_secret ? decryptValue(keys.mc_client_secret) : null;
        const authUrl = keys.mc_auth_url ? decryptValue(keys.mc_auth_url) : null;
        if (!clientId || !clientSecret || !authUrl) return null;
        _creds = {
            clientId,
            clientSecret,
            authUrl: authUrl.replace(/\/+$/, ''), // strip trailing slash
            accountId: keys.mc_account_id ? decryptValue(keys.mc_account_id) : null,
        };
        return _creds;
    }

    async function authenticate() {
        const creds = await loadCredentials();
        if (!creds) throw new Error('Marketing Cloud credentials not configured');

        // Check cache
        if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
            return _tokenCache;
        }

        const body = {
            grant_type: 'client_credentials',
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
        };
        if (creds.accountId) body.account_id = creds.accountId;

        const resp = await fetch(`${creds.authUrl}/v2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`MC auth failed (${resp.status}): ${text}`);
        }

        const data = await resp.json();
        _tokenCache = {
            accessToken: data.access_token,
            // Expire 60s early to avoid edge-case failures
            expiresAt: Date.now() + (data.expires_in - 60) * 1000,
            restUrl: (data.rest_instance_url || '').replace(/\/+$/, ''),
            soapUrl: (data.soap_instance_url || '').replace(/\/+$/, ''),
        };
        return _tokenCache;
    }

    /**
     * Make a REST API call to Marketing Cloud.
     * Auto-refreshes token on 401, retries once.
     */
    async function rest(method, path, body = null, retried = false) {
        const token = await authenticate();
        const url = `${token.restUrl}${path.startsWith('/') ? '' : '/'}${path}`;

        const opts = {
            method,
            headers: {
                'Authorization': `Bearer ${token.accessToken}`,
                'Content-Type': 'application/json',
            },
        };
        if (body && method !== 'GET') opts.body = JSON.stringify(body);

        const resp = await fetch(url, opts);

        // Token expired mid-flight — force refresh and retry once
        if (resp.status === 401 && !retried) {
            _tokenCache = null;
            return rest(method, path, body, true);
        }

        // Rate limited — wait and retry once
        if (resp.status === 429 && !retried) {
            const retryAfter = parseInt(resp.headers.get('retry-after') || '2', 10);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            return rest(method, path, body, true);
        }

        const text = await resp.text();
        let result;
        try { result = JSON.parse(text); } catch { result = text; }

        if (!resp.ok) {
            let msg;
            if (typeof result === 'object') {
                const base = result.message || result.errorMessage || result.error_description || '';
                // MC REST wraps field-level problems in validationErrors:[{message,errorcode,...}]
                // The top-level message is generic ("Request contained some validation errors.");
                // the actionable detail lives inside. Surface it.
                const ve = Array.isArray(result.validationErrors) ? result.validationErrors : [];
                const veDetail = ve
                    .map(e => e.message || e.errorMessage || JSON.stringify(e))
                    .filter(Boolean)
                    .join(' | ');
                msg = [base, veDetail].filter(Boolean).join(' — ');
                if (!msg) msg = JSON.stringify(result).slice(0, 500);
            } else {
                msg = text;
            }
            const err = new Error(`MC REST ${resp.status} ${method} ${path}: ${msg}`);
            err.status = resp.status;
            err.mcResponse = result;
            throw err;
        }

        return result;
    }

    /**
     * Make a SOAP API call to Marketing Cloud.
     * Builds minimal SOAP envelope with auth token.
     */
    async function soap(action, innerXml) {
        const token = await authenticate();
        const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <a:Action s:mustUnderstand="1">${action}</a:Action>
    <a:To s:mustUnderstand="1">${token.soapUrl}/Service.asmx</a:To>
    <fueloauth xmlns="http://exacttarget.com">${token.accessToken}</fueloauth>
  </s:Header>
  <s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    ${innerXml}
  </s:Body>
</s:Envelope>`;

        const resp = await fetch(`${token.soapUrl}/Service.asmx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': action,
            },
            body: envelope,
        });

        const text = await resp.text();
        if (!resp.ok) {
            throw new Error(`MC SOAP ${resp.status}: ${text.substring(0, 500)}`);
        }
        return text;
    }

    return {
        /** Check if MC credentials are configured */
        async isConfigured() {
            try {
                return !!(await loadCredentials());
            } catch { return false; }
        },

        /** Get current token (useful for diagnostics) */
        async getToken() {
            return authenticate();
        },

        rest,
        soap,

        /** Clear cached credentials (e.g., when user updates settings) */
        clearCache() {
            _creds = null;
            _tokenCache = null;
        },
    };
}
