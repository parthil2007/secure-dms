-- SecureDMS schema (PostgreSQL)
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(30)  NOT NULL DEFAULT 'investigator',
  department    VARCHAR(120),
  badge_id      VARCHAR(60),
  phone         VARCHAR(30),
  avatar_color  VARCHAR(20)  DEFAULT '#2f49d6',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cases (
  id              SERIAL PRIMARY KEY,
  case_number     VARCHAR(40) NOT NULL UNIQUE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  case_type       VARCHAR(40) NOT NULL DEFAULT 'criminal',
  status          VARCHAR(30) NOT NULL DEFAULT 'open',
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
  lead_officer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  agency          VARCHAR(120),
  court           VARCHAR(160),
  filing_date     DATE,
  due_date        DATE,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id              SERIAL PRIMARY KEY,
  doc_number      VARCHAR(40) NOT NULL UNIQUE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  doc_type        VARCHAR(40) NOT NULL DEFAULT 'evidence',
  category        VARCHAR(80),
  case_id         INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  file_name       VARCHAR(255),
  original_name   VARCHAR(255),
  mime_type       VARCHAR(120),
  size_bytes      BIGINT DEFAULT 0,
  storage_path    VARCHAR(400),
  hash_sha256     VARCHAR(64),
  prev_hash       VARCHAR(64),
  chain_hash      VARCHAR(64),
  status          VARCHAR(30)  NOT NULL DEFAULT 'stored',
  confidentiality VARCHAR(20)  NOT NULL DEFAULT 'internal',
  tags            TEXT[]       DEFAULT '{}',
  source          VARCHAR(160),
  collected_at    TIMESTAMPTZ,
  location        VARCHAR(255),
  version         INTEGER      NOT NULL DEFAULT 1,
  uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id             SERIAL PRIMARY KEY,
  document_id    INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_name      VARCHAR(255),
  original_name  VARCHAR(255),
  mime_type       VARCHAR(120),
  size_bytes     BIGINT DEFAULT 0,
  storage_path   VARCHAR(400),
  hash_sha256    VARCHAR(64),
  note           TEXT,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS shares (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  case_id     INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  shared_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email       VARCHAR(160),
  permission  VARCHAR(20) NOT NULL DEFAULT 'view',
  message     TEXT,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chain_of_custody (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action      VARCHAR(60) NOT NULL,
  from_user   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  to_user     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  location    VARCHAR(255),
  notes       TEXT,
  hash_proof  VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name   VARCHAR(120),
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40),
  entity_id   VARCHAR(60),
  entity_name VARCHAR(255),
  details     JSONB,
  ip_address  VARCHAR(60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_case      ON documents (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_type      ON documents (doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_status    ON documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_created   ON documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_title     ON documents (title);
CREATE INDEX IF NOT EXISTS idx_cases_status        ON documents (status);
CREATE INDEX IF NOT EXISTS idx_versions_document   ON document_versions (document_id);
CREATE INDEX IF NOT EXISTS idx_custody_document    ON chain_of_custody (document_id);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_shares_document     ON shares (document_id);
CREATE INDEX IF NOT EXISTS idx_shares_with         ON shares (shared_with);

-- Human-readable, gap-tolerant reference numbers
CREATE SEQUENCE IF NOT EXISTS seq_case_number;
CREATE SEQUENCE IF NOT EXISTS seq_document_number;
