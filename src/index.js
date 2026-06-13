/**
 * EasyForm - The simplest form backend service
 * Deployed at: https://easyform.358042175.workers.dev
 */

// Daily email limit per form (Resend free tier: 100/day)
const DAILY_EMAIL_LIMIT = 100;

// Simple in-memory rate limiter (resets on Worker cold start)
// Key: email_hash, Value: { count, date }
const rateLimitMap = new Map();

function checkRateLimit(email) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = rateLimitMap.get(email);

  if (!entry || entry.date !== today) {
    rateLimitMap.set(email, { count: 1, date: today });
    return { allowed: true, remaining: DAILY_EMAIL_LIMIT - 1 };
  }

  if (entry.count >= DAILY_EMAIL_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: DAILY_EMAIL_LIMIT - entry.count };
}

// i18n for notification emails
const EMAIL_I18N = {
  en: {
    subject: '📩 New form submission',
    title: 'You have a new form submission!',
    aiSection: '🤖 AI Summary',
    aiNotEnabled: 'AI summary is not enabled yet. Upgrade to Pro to get AI-powered summaries of every submission.',
    originalSection: '📋 Original Submission',
    timeLabel: 'Time',
    svcLabel: 'Service',
    footer: 'Powered by EasyForm — the simplest form backend for static sites.',
  },
  zh: {
    subject: '📩 收到新的表单提交',
    title: '您收到了一个新的表单提交！',
    aiSection: '🤖 AI 摘要',
    aiNotEnabled: 'AI 摘要功能尚未开启。升级到 Pro 版即可自动获取每次提交的 AI 智能摘要。',
    originalSection: '📋 原始提交内容',
    timeLabel: '提交时间',
    svcLabel: '服务方',
    footer: '由 EasyForm 提供支持 — 最简单的静态网站表单后端。',
  },
};

function detectLanguage(formData) {
  // Only detect Chinese vs English. Everything else defaults to English.
  const text = JSON.stringify(formData);
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;

  // >85% Chinese characters → zh, otherwise en (covers EN/JP/KO/FR/ES/...)
  if (totalChars > 0 && chineseChars / totalChars > 0.85) return 'zh';
  return 'en';
}

// ==========================================
// AI Functions (Cloudflare Workers AI)
// ==========================================

async function detectSpam(env, formData) {
  try {
    const content = JSON.stringify(formData);
    if (content.length < 20) return false;

    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt: `Classify this form submission as SPAM or NOT_SPAM. Respond with only one word.\n\nContent: ${content}`,
      max_tokens: 10,
      temperature: 0.1,
    });

    return result.response.trim().toUpperCase().includes('SPAM');
  } catch (e) {
    return false;
  }
}

async function generateSummary(env, formData) {
  try {
    const content = JSON.stringify(formData);
    if (content.length < 100) return null;

    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt: `Summarize this form submission in 2-3 short sentences.\n\nSubmission:\n${content}\n\nSummary:`,
      max_tokens: 150,
      temperature: 0.5,
    });

    return result.response.trim();
  } catch (e) {
    return null;
  }
}

// ==========================================
// Email Functions
// ==========================================

async function sendNotificationEmail(toEmail, formData, summary, env) {
  try {
    const lang = detectLanguage(formData);
    const t = EMAIL_I18N[lang];
    const time = new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { timeZone: 'Asia/Shanghai' });

    // ===== AI Summary Section =====
    let body = `╔══════════════════════════════════╗\n`;
    body += `║  ${t.aiSection}`;
    body += ` `.repeat(Math.max(0, 34 - t.aiSection.length - 2)) + `║\n`;
    body += `╚══════════════════════════════════╝\n\n`;

    if (summary) {
      body += `${summary}\n\n`;
    } else {
      body += `💡 ${t.aiNotEnabled}\n\n`;
    }

    // ===== Original Submission Section =====
    body += `╔══════════════════════════════════╗\n`;
    body += `║  ${t.originalSection}`;
    body += ` `.repeat(Math.max(0, 34 - t.originalSection.length - 2)) + `║\n`;
    body += `╚══════════════════════════════════╝\n\n`;

    for (const [key, value] of Object.entries(formData)) {
      body += `【${key}】\n${value}\n\n`;
    }

    // ===== Footer =====
    body += `${'─'.repeat(40)}\n`;
    body += `${t.timeLabel}: ${time}\n`;
    body += `${t.svcLabel}: EasyForm\n`;
    body += `${t.footer}\n`;

    // Use Resend for email delivery
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'EasyForm <noreply@easyform.dpdns.org>',
        to: [toEmail],
        subject: t.subject,
        text: body,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[Resend] HTTP ${resp.status}: ${errText}`);
    } else {
      console.log(`[Resend] Email sent to ${toEmail}`);
    }
  } catch (e) {
    console.error('[Resend] Fetch failed:', e.message || e);
  }
}

// ==========================================
// Embed Script
// ==========================================

const EMBED_SCRIPT = `
(function() {
  const script = document.currentScript;
  const endpoint = script.src.replace('/easyform.js', '');
  const email = script.getAttribute('data-email');

  function init() {
    document.querySelectorAll('form[data-easyform]').forEach(form => {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = form.querySelector('[type="submit"]');
        const orig = btn ? btn.textContent : 'Submit';
        try {
          if (btn) { btn.textContent = 'Submitting...'; btn.disabled = true; }
          const fd = new FormData(form);
          const data = {};
          for (const [k, v] of fd.entries()) data[k] = v;
          const res = await fetch(endpoint + '/submit/' + btoa(email), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
          });
          if (res.ok) {
            const lang = (navigator.language||'en').startsWith('zh') ? 'zh' : 'en';
            const msg = lang === 'zh' ? '✓ 提交成功！' : '✓ Submitted successfully!';
            form.innerHTML = '<div style="padding:24px;text-align:center;color:#10b981;font-size:16px;font-family:system-ui">' + msg + '</div>';
          } else throw new Error();
        } catch(e) {
          const lang = (navigator.language||'en').startsWith('zh') ? 'zh' : 'en';
          alert(lang === 'zh' ? '提交失败，请重试' : 'Submission failed. Please try again.');
          if (btn) { btn.textContent = orig; btn.disabled = false; }
        }
      });
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
  // Anonymous domain beacon (no cookies, no IP — just referrer hostname for counting)
  try {
    var ref = document.referrer || window.location.href;
    new Image().src = endpoint + '/beacon?d=' + encodeURIComponent(new URL(ref).hostname);
  } catch(e) {}
})();
`;

// ==========================================
// Main Handler
// ==========================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Landing page - serve from static asset
      if (path === '/' || path === '') {
        return env.ASSETS.fetch(request);
      }

      // Embed script
      if (path === '/easyform.js') {
        return new Response(EMBED_SCRIPT, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      // Form submission
      if (path.startsWith('/submit/') && request.method === 'POST') {
        const emailBase64 = path.split('/')[2];
        const toEmail = atob(emailBase64);

        if (!toEmail || !toEmail.includes('@')) {
          return new Response(
            JSON.stringify({ error: 'Invalid email configuration' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let formData;
        try {
          const contentType = request.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            formData = await request.json();
          } else {
            const fd = await request.formData();
            formData = {};
            for (const [key, value] of fd.entries()) {
              formData[key] = value;
            }
          }
        } catch (e) {
          return new Response(
            JSON.stringify({ error: 'Invalid form data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // AI spam detection
        let isSpam = false;
        let summary = null;
        try {
          isSpam = await detectSpam(env, formData);
          if (!isSpam) {
            summary = await generateSummary(env, formData);
          }
        } catch (e) {
          console.warn('AI pipeline failed:', e);
        }

        if (isSpam) {
          return new Response(
            JSON.stringify({ success: true, filtered: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check daily email limit
        const rateLimit = checkRateLimit(toEmail);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({ success: true, rate_limited: true, message: 'Daily email limit reached. Submissions are still being collected.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Send email notification
        await sendNotificationEmail(toEmail, formData, summary, env);

        return new Response(
          JSON.stringify({ success: true, ai_summary: summary, emails_remaining: rateLimit.remaining }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Waitlist — store emails for Pro launch (no email notification to save quota)
      if (path === '/waitlist' && request.method === 'POST') {
        const { email } = await request.json();
        if (!email || !email.includes('@')) {
          return new Response(
            JSON.stringify({ error: 'Valid email required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log to console (view with: npx wrangler tail)
        console.log(`[WAITLIST] ${email} — ${new Date().toISOString()}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Added to waitlist' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Health check
      if (path === '/health') {
        return new Response(
          JSON.stringify({ status: 'ok', time: new Date().toISOString() }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Beacon: count unique domains embedding EasyForm
      if (path === '/beacon' && request.method === 'GET') {
        const domain = url.searchParams.get('d') || 'unknown';
        console.log(`[BEACON] ${domain}`);
        return new Response(null, { status: 204, headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        }});
      }

      // Stats: view domain counts (view with npx wrangler tail)
      if (path === '/stats') {
        return new Response(
          JSON.stringify({ hint: 'Check wrangler tail for beacon data' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Sitemap + robots for SEO (inherit asset headers, override Content-Type + Cache-Control)
      if (path === '/sitemap.xml' || path === '/robots.txt') {
        const asset = await env.ASSETS.fetch(request);
        const headers = new Headers(asset.headers);
        headers.set('Content-Type', (path.endsWith('.xml') ? 'application/xml' : 'text/plain') + '; charset=utf-8');
        headers.set('Cache-Control', 'public, max-age=3600');
        return new Response(asset.body, { status: asset.status, headers });
      }

      // Fallback to static assets (for CSS, JS, images, etc.)
      return env.ASSETS.fetch(request);

    } catch (e) {
      console.error(e);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};
