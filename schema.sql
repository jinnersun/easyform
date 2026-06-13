-- EasyForm D1 数据库 schema

-- 表单表
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  email_notify TEXT,
  webhook_url TEXT,
  redirect_url TEXT,
  created_at INTEGER NOT NULL,
  submissions INTEGER DEFAULT 0
);

-- 提交记录表
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON 格式存储表单数据
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
