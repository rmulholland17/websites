// Harbor Sites form handler (Cloudflare Pages Function at /api/contact).
// Copied into each client site by new-client-site.sh. Emails each submission
// to the client through Resend and redirects to the site's thank-you page.
//
// Project secrets/vars (set by new-client-site.sh, never in files):
//   RESEND_API_KEY   Resend key (secret)
//   FORM_TO          client's email; sample/test sites use harborsitess@gmail.com
//   FORM_FROM        e.g. "Website form <forms@harborsites.org>" (verified in Resend)
//   FORM_BCC         optional, harborsitess@gmail.com
//   SITE_NAME        business name for the subject line
//   TURNSTILE_SECRET optional; when set, the Turnstile check is required
//
// Form markup: <form method="POST" action="/api/contact">, a hidden
// input "form-name", optional hidden "_next" (thank-you path), and the
// honeypot <p hidden><label>Leave blank <input name="bot-field"></label></p>.
// _headers rules don't apply to Function responses, so headers are set here.

const MAX_FIELDS = 30, MAX_NAME = 60, MAX_VALUE = 5000;
const SKIP = new Set(['bot-field', '_next', 'form-name', 'cf-turnstile-response']);
const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = s => String(s).replace(/[\r\n]+/g, ' ').slice(0, 120);

function page(status, title, msg) {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>` +
    `<body style="font:18px/1.5 system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#1a1a1a"><h1>${esc(title)}</h1><p>${esc(msg)}</p><p><a href="/">Back to the home page</a></p></body></html>`,
    { status, headers: HEADERS });
}

function redirect(url, next) {
  // Only same-site paths, so the form can't be used to bounce visitors elsewhere.
  const path = typeof next === 'string' && /^\/(?!\/)[\w\-./]*$/.test(next) ? next : '/thank-you.html';
  return new Response(null, { status: 303, headers: { ...HEADERS, Location: new URL(path, url).toString() } });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== url.host) return page(403, 'Not sent', 'This form can only be sent from its own website.');

  let form;
  try { form = await request.formData(); } catch { return page(400, 'Not sent', 'The form could not be read. Please try again.'); }

  // Honeypot filled in: a bot. Pretend it worked so it doesn't retry.
  if ((form.get('bot-field') || '').toString().trim()) return redirect(url, form.get('_next'));

  if (env.TURNSTILE_SECRET) {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', (form.get('cf-turnstile-response') || '').toString());
    body.append('remoteip', request.headers.get('CF-Connecting-IP') || '');
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
      .then(r => r.json()).catch(() => ({ success: false }));
    if (!check.success) return page(400, 'Not sent', 'The spam check did not pass. Please go back and try again.');
  }

  const fields = [];
  for (const [name, value] of form.entries()) {
    if (SKIP.has(name) || typeof value !== 'string') continue; // files aren't accepted
    if (fields.length >= MAX_FIELDS) break;
    fields.push([name.slice(0, MAX_NAME), value.slice(0, MAX_VALUE).trim()]);
  }
  if (!fields.some(([, v]) => v)) return page(400, 'Not sent', 'The form was empty. Please go back and fill it in.');

  if (!env.RESEND_API_KEY || !env.FORM_TO || !env.FORM_FROM) {
    console.error('contact: missing RESEND_API_KEY, FORM_TO or FORM_FROM');
    return page(500, 'Not sent', 'Sorry, the form is not working right now. Please call or email us instead.');
  }

  const site = env.SITE_NAME || url.host;
  const formName = oneLine(form.get('form-name') || 'contact');
  const email = fields.find(([n]) => /e-?mail/i.test(n))?.[1] || '';
  const who = fields.find(([n]) => /name/i.test(n))?.[1] || 'someone';
  const text = fields.map(([n, v]) => `${n}: ${v}`).join('\n') + `\n\nSent from the ${formName} form on ${url.host}`;
  const html = '<table cellpadding="6" style="border-collapse:collapse;font:15px/1.4 sans-serif">' +
    fields.map(([n, v]) => `<tr><th align="left" valign="top" style="border-bottom:1px solid #ddd">${esc(n)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${esc(v)}</td></tr>`).join('') +
    `</table><p style="font:13px sans-serif;color:#555">Sent from the ${esc(formName)} form on ${esc(url.host)}</p>`;

  const msg = {
    from: env.FORM_FROM,
    to: env.FORM_TO.split(',').map(s => s.trim()),
    subject: oneLine(`${site}: new ${formName} message from ${who}`),
    text, html,
  };
  if (env.FORM_BCC) msg.bcc = env.FORM_BCC.split(',').map(s => s.trim());
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) msg.reply_to = email;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
  if (!res.ok) {
    console.error('contact: Resend failed', res.status, await res.text());
    return page(502, 'Not sent', 'Sorry, your message did not go through. Please call or email us instead.');
  }
  return redirect(url, form.get('_next'));
}
