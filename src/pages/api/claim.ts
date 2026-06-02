import type { APIRoute } from 'astro';

export const prerender = false;

// ── Env vars (set in .env or hosting dashboard) ───────────────────────────
// GITHUB_TOKEN  — fine-grained PAT with Contents read+write on this repo
// GITHUB_OWNER  — repo owner, e.g. jasonrevilla-cmd
// GITHUB_REPO   — repo name, e.g. myhormone-guide
// RESEND_API_KEY — from resend.com (free tier: 3,000 emails/month)
// NOTIFICATION_EMAIL — override recipient (defaults to jason@chiroconnective.com)

const GITHUB_TOKEN        = import.meta.env.GITHUB_TOKEN        as string | undefined;
const GITHUB_OWNER        = import.meta.env.GITHUB_OWNER        ?? 'jasonrevilla-cmd';
const GITHUB_REPO         = import.meta.env.GITHUB_REPO         ?? 'myhormone-guide';
const RESEND_API_KEY      = import.meta.env.RESEND_API_KEY       as string | undefined;
const NOTIFICATION_EMAIL  = import.meta.env.NOTIFICATION_EMAIL  ?? 'jason@chiroconnective.com';
const SUBMISSIONS_PATH    = 'submissions.json';

const GH_CONTENTS_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${SUBMISSIONS_PATH}`;

// ── Types ────────────────────────────────────────────────────────────────
interface Submission {
  id: string;
  timestamp: string;
  practiceName: string;
  providerName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
}

// ── Route handler ─────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const json = { 'Content-Type': 'application/json' };

  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), { status: 400, headers: json });
  }

  const submission: Submission = {
    id:           crypto.randomUUID(),
    timestamp:    new Date().toISOString(),
    practiceName: (data.get('practice_name') ?? '').toString().trim(),
    providerName: (data.get('provider_name') ?? '').toString().trim(),
    email:        (data.get('email')         ?? '').toString().trim(),
    phone:        (data.get('phone')         ?? '').toString().trim(),
    city:         (data.get('city')          ?? '').toString().trim(),
    state:        (data.get('state')         ?? '').toString().trim(),
  };

  if (!submission.practiceName || !submission.providerName || !submission.email) {
    return new Response(JSON.stringify({ error: 'practice_name, provider_name, and email are required' }), { status: 400, headers: json });
  }

  const errors: string[] = [];

  // ── 1. Append to submissions.json via GitHub Contents API ────────────
  if (GITHUB_TOKEN) {
    const ghError = await writeToGitHub(submission);
    if (ghError) errors.push(`GitHub write: ${ghError}`);
  } else {
    console.warn('[claim] GITHUB_TOKEN not set — skipping submissions.json write');
  }

  // ── 2. Email notification via Resend ─────────────────────────────────
  if (RESEND_API_KEY) {
    const emailError = await sendEmail(submission);
    if (emailError) errors.push(`Email: ${emailError}`);
  } else {
    console.warn('[claim] RESEND_API_KEY not set — skipping email notification');
  }

  if (errors.length > 0) {
    console.error('[claim] Partial failure:', errors);
  }

  // Always return success to the user — failures are logged server-side
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: json });
};

// ── GitHub Contents API ───────────────────────────────────────────────────
async function writeToGitHub(submission: Submission): Promise<string | null> {
  try {
    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Fetch current file to get SHA (required for updates)
    const getRes = await fetch(GH_CONTENTS_URL, { headers: ghHeaders });
    let existing: Submission[] = [];
    let sha: string | undefined;

    if (getRes.ok) {
      const file = await getRes.json() as { sha: string; content: string };
      sha = file.sha;
      const decoded = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      try {
        existing = JSON.parse(decoded) as Submission[];
      } catch {
        existing = [];
      }
    } else if (getRes.status !== 404) {
      return `Unexpected GitHub status ${getRes.status}`;
    }

    existing.push(submission);
    const updated = JSON.stringify(existing, null, 2);
    const encoded = Buffer.from(updated).toString('base64');

    const body: Record<string, string> = {
      message: `chore: add provider listing request (${submission.city}, ${submission.state})`,
      content: encoded,
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(GH_CONTENTS_URL, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      return `PUT failed (${putRes.status}): ${err.slice(0, 200)}`;
    }

    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// ── Resend email ──────────────────────────────────────────────────────────
async function sendEmail(submission: Submission): Promise<string | null> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MyHormoneGuide <noreply@myhormoneguide.com>',
        to:   NOTIFICATION_EMAIL,
        subject: `New provider listing request — ${submission.city}, ${submission.state}`,
        html: `
<h2 style="color:#1A3C5E">New Provider Listing Request</h2>
<table style="border-collapse:collapse;width:100%;max-width:520px;font-family:sans-serif;font-size:14px">
  <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;width:140px">Practice</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${esc(submission.practiceName)}</td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600">Provider</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${esc(submission.providerName)}</td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600">Email</td><td style="padding:8px 12px;border:1px solid #e2e8f0"><a href="mailto:${esc(submission.email)}">${esc(submission.email)}</a></td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600">Phone</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${esc(submission.phone) || '—'}</td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600">City</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${esc(submission.city)}</td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600">State</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${esc(submission.state)}</td></tr>
  <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600">Submitted</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${new Date(submission.timestamp).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT</td></tr>
</table>
<p style="font-size:12px;color:#94a3b8;margin-top:20px">Sent from MyHormoneGuide provider listing system · ID: ${submission.id}</p>
        `.trim(),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return `Resend failed (${res.status}): ${err.slice(0, 200)}`;
    }

    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// Escape HTML special chars in user-supplied strings
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
