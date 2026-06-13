# EasyForm

> The simplest form backend for your static site. One line of code. AI-powered. Open source.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-orange)](https://www.easyform.dpdns.org)

**English** | [中文](#中文)

---

## ✨ Why EasyForm?

You have a static website. You need a contact form. You don't want to:

- ❌ Set up a backend server
- ❌ Configure a database
- ❌ Write API endpoints
- ❌ Pay $29/month for Typeform
- ❌ Deal with email delivery

**EasyForm does all of this for you. One line of code.**

```html
<script src="https://www.easyform.dpdns.org/easyform.js"
 data-email="you@example.com"></script>

<form data-easyform>
  <input name="Name" placeholder="Your name">
  <input name="Email" type="email" placeholder="you@example.com">
  <textarea name="Message" placeholder="What's up?"></textarea>
  <button type="submit">Send</button>
</form>
```

That's it. When someone submits the form, you get an email. No server. No database. No backend code.

---

## 🤖 AI-Powered (Our Secret Sauce)

Unlike every other form backend, EasyForm uses **Cloudflare Workers AI** to:

| Feature | Description |
|---------|-------------|
| 🛡️ **AI Spam Filtering** | Llama 3 8B automatically detects and filters spam submissions |
| 📝 **AI Summarization** | Long form submissions are summarized into 2-3 key sentences |
| 🌍 **Multi-language** | Auto-detects Chinese/English, sends notifications in the right language |

All AI runs at the edge — zero latency, zero additional cost.

---

## 🚀 Quick Start

### 1. Enter your email
Visit [www.easyform.dpdns.org](https://www.easyform.dpdns.org) and enter your email address.

### 2. Copy the code
You'll get a one-line `<script>` tag. Copy it.

### 3. Paste into your website
Add it to any HTML page, add `data-easyform` to your `<form>`, and you're done.

---

## 📊 vs The Competition

| | EasyForm | Typeform | Formspree | Build Your Own |
|---|---|---|---|---|
| **Price** | Free | $29/mo | $10/mo | $5/mo server + 4hr dev |
| **AI Spam Filter** | ✅ | ❌ | ❌ | ❌ |
| **AI Summaries** | ✅ | ❌ | ❌ | ❌ |
| **Open Source** | ✅ MIT | ❌ Closed | ❌ Closed | ✅ |
| **Setup Time** | 30 seconds | 10 minutes | 5 minutes | 4+ hours |
| **Multi-language** | ✅ EN/中文 | ❌ | ❌ | DIY |
| **Zero Config** | ✅ | ❌ | ❌ | ❌ |

---

## 💰 Pricing

| Plan | Price | Submissions/mo | Features |
|------|-------|---------------|----------|
| **Free** | $0 | 100 | Email notifications, basic spam filter |
| **Pro** | $9/mo | 1,000 | AI spam filtering, AI summaries, webhooks, file uploads |

*Pro tier coming soon. [Join the waitlist](https://www.easyform.dpdns.org)*

---

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers (edge, 300+ locations worldwide)
- **AI**: Cloudflare Workers AI (Llama 3 8B)
- **Email**: Resend (free, included with Cloudflare)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Frontend**: Vanilla HTML + Tailwind CSS

---

## 🏗️ Self-Host / Deploy Your Own

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/easyform.git
cd easyform

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env with your Cloudflare credentials

# 4. Deploy
npm run deploy
```

Requires a [Cloudflare account](https://dash.cloudflare.com) (free tier works).

### Custom Domain & Email Setup

To use your own domain and send emails from it:

**1. Bind a custom domain to the Worker**
- In Cloudflare Dashboard → Workers & Pages → easyform → Triggers → Custom Domains
- Add your domain (e.g., `form.yourdomain.com`)

**2. Set up Resend for email delivery**
- Register at [resend.com](https://resend.com) (free: 3,000 emails/month)
- Add your domain in Resend → Domains
- Add the DNS records Resend provides (TXT, MX) in Cloudflare DNS
- Once verified, set the Worker secret:
  ```bash
  npx wrangler secret put RESEND_API_KEY
  ```
- Update `src/index.js`: change `from` address to `noreply@yourdomain.com`
- Redeploy: `npm run deploy`

**3. Update landing page URLs**
- Replace `www.easyform.dpdns.org` with your domain in `public/index.html`
- Redeploy

---

## 📖 Documentation

- [Quick Start Guide](https://www.easyform.dpdns.org)
- [API Reference](#api-reference)
- [Self-Hosting Guide](#self-host--deploy-your-own)

### API Reference

#### Submit a form
```bash
curl -X POST https://www.easyform.dpdns.org/submit/BASE64_EMAIL \
  -H "Content-Type: application/json" \
  -d '{"name":"John","message":"Hello!"}'
```

#### Health check
```bash
curl https://www.easyform.dpdns.org/health
```

---

## 🤝 Contributing

Contributions welcome! This is an early-stage project — there's lots to build.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT © 2026 EasyForm

---

## 🔗 Links

- 🌐 [Website](https://www.easyform.dpdns.org)
- 📦 [npm](https://www.npmjs.com/package/easyform) (coming soon)
- 💬 [Discord](https://discord.gg/easyform) (coming soon)

---

---

# 中文

## EasyForm — 最简单的表单后端

> 一行代码搞定表单后端。AI 加持。开源免费。

### ✨ 为什么选择 EasyForm？

你有一个静态网站，需要一个联系表单。你不想：

- ❌ 搭后端服务器
- ❌ 配数据库
- ❌ 写 API 接口
- ❌ 花 $29/月买 Typeform
- ❌ 折腾邮件发送

**EasyForm 帮你搞定一切。一行代码。**

```html
<script src="https://www.easyform.dpdns.org/easyform.js"
 data-email="you@example.com"></script>

<form data-easyform>
  <input name="姓名" placeholder="你的名字">
  <input name="邮箱" type="email" placeholder="you@example.com">
  <textarea name="留言" placeholder="有什么想说的？"></textarea>
  <button type="submit">提交</button>
</form>
```

### 🤖 AI 功能（核心差异化）

| 功能 | 说明 |
|------|------|
| 🛡️ **AI 垃圾过滤** | Llama 3 8B 自动检测并过滤垃圾提交 |
| 📝 **AI 内容摘要** | 长表单内容自动压缩为 2-3 句摘要 |
| 🌍 **多语言** | 自动识别中英文，用对应语言发送通知 |

### 🚀 快速开始

1. 访问 [www.easyform.dpdns.org](https://www.easyform.dpdns.org)，输入你的邮箱
2. 复制生成的一行代码
3. 粘贴到你的网站，给 `<form>` 加上 `data-easyform` 属性

### 💰 定价

| 方案 | 价格 | 每月提交 | 功能 |
|------|------|----------|------|
| **免费版** | ¥0 | 100 次 | 邮件通知、基础反垃圾 |
| **Pro 版** | ¥65/月 | 1,000 次 | AI 垃圾过滤、AI 摘要、Webhook、文件上传 |

### 🛠️ 技术栈

- **运行时**: Cloudflare Workers（全球 300+ 边缘节点）
- **AI**: Cloudflare Workers AI（Llama 3 8B）
- **邮件**: Resend（免费 3,000 封/月）
- **数据库**: Cloudflare D1（边缘 SQLite）

### 📄 开源协议

MIT © 2026 EasyForm

### 🔧 自部署 & 自定义域名

```bash
git clone https://github.com/jinnersun/easyform.git
cd easyform
npm install
cp .env.example .env  # 填入你的 Cloudflare 凭证
npm run deploy
```

**绑定自定义域名**：
1. Cloudflare Dashboard → Workers & Pages → easyform → Triggers → Custom Domains
2. 添加你的域名（如 `form.yourdomain.com`）

**配置邮件发送（Resend）**：
1. 注册 [resend.com](https://resend.com)（免费 3,000 封/月）
2. 在 Resend → Domains 添加你的域名
3. 把 Resend 提供的 DNS 记录（TXT、MX）添加到 Cloudflare DNS
4. 验证通过后，设置 Worker secret：`npx wrangler secret put RESEND_API_KEY`
5. 修改 `src/index.js` 中的 `from` 地址为 `noreply@yourdomain.com`
6. 重新部署：`npm run deploy`
