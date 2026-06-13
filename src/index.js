/**
 * EasyForm - The simplest form backend service
 * Deployed at: https://easyform.358042175.workers.dev
 */

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

    // Use Resend API for reliable email delivery
    await fetch('https://api.resend.com/emails', {
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
  } catch (e) {
    console.warn('Email failed:', e);
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

        // Send email notification
        await sendNotificationEmail(toEmail, formData, summary, env);

        return new Response(
          JSON.stringify({ success: true, ai_summary: summary }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Waitlist — collect emails for Pro launch
      if (path === '/waitlist' && request.method === 'POST') {
        const { email } = await request.json();
        if (!email || !email.includes('@')) {
          return new Response(
            JSON.stringify({ error: 'Valid email required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store in D1 (future) — for now, forward to Resend as a notification
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'EasyForm Waitlist <onboarding@resend.dev>',
            to: ['358042175@163.com'],
            subject: '🎉 New Pro waitlist signup',
            text: `New waitlist signup:\n\nEmail: ${email}\nTime: ${new Date().toISOString()}`,
          }),
        });

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
