-- ============================================================
-- TABLE: prompt_versions
-- Stores versions of prompts used for AI analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS prompt_versions (

  -- unique identifier
  id TEXT PRIMARY KEY,

  -- when the prompt version was created
  created_at TEXT NOT NULL,

  -- simple readable version tag
  version TEXT NOT NULL,

  -- prompt template used for the AI call
  prompt_template TEXT NOT NULL,

  -- description of what changed
  description TEXT
);