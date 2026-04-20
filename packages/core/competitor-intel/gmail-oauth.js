import { google } from 'googleapis';
import pool from '../db/pool.js';
import { encrypt, decrypt } from '../crypto/aes-gcm.js';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

export function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseCallback(queryString) {
  const p = new URLSearchParams(queryString);
  return { code: p.get('code'), state: p.get('state') };
}

export async function exchangeCodeAndStore({ personaId, code }) {
  const oauth = client();
  const { tokens } = await oauth.getToken(code);
  oauth.setCredentials(tokens);
  const info = await google.oauth2({ version: 'v2', auth: oauth }).userinfo.get();
  const email = info.data.email;

  const key = process.env.COMPETITOR_INTEL_KEY;
  if (!key) throw new Error('COMPETITOR_INTEL_KEY not set in env');
  const accessEnc = tokens.access_token ? encrypt(tokens.access_token, key) : null;
  const refreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token, key) : null;
  const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  await pool.query(`
    INSERT INTO competitor_persona_gmail(persona_id, email, access_token_encrypted, refresh_token_encrypted, token_expiry)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (persona_id) DO UPDATE SET
      email = EXCLUDED.email,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, competitor_persona_gmail.refresh_token_encrypted),
      token_expiry = EXCLUDED.token_expiry
  `, [personaId, email, accessEnc, refreshEnc, expiry]);

  return { email };
}

export async function getAuthorizedClient(personaId) {
  const r = await pool.query('SELECT * FROM competitor_persona_gmail WHERE persona_id = $1', [personaId]);
  if (!r.rows[0]) throw new Error('persona has no gmail connected');
  const row = r.rows[0];
  const key = process.env.COMPETITOR_INTEL_KEY;
  const oauth = client();
  oauth.setCredentials({
    access_token: row.access_token_encrypted ? decrypt(row.access_token_encrypted, key) : null,
    refresh_token: row.refresh_token_encrypted ? decrypt(row.refresh_token_encrypted, key) : null,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : null
  });
  oauth.on('tokens', async (newTokens) => {
    if (newTokens.access_token) {
      await pool.query(
        'UPDATE competitor_persona_gmail SET access_token_encrypted = $1, token_expiry = $2 WHERE persona_id = $3',
        [encrypt(newTokens.access_token, key), newTokens.expiry_date ? new Date(newTokens.expiry_date) : null, personaId]
      );
    }
  });
  return oauth;
}
