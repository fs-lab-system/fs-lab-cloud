-- ============================================================
-- TABLE: analysis_reports
-- Stores AI generated analysis of benchmark datasets
-- ============================================================

CREATE TABLE IF NOT EXISTS analysis_reports (

  -- Unique identifier for each analysis
  id TEXT PRIMARY KEY,

  -- When the record was written to the database
  created_at TEXT NOT NULL,

  -- Dataset type that was analyzed
  -- possible values: 'runs', 'snapshots'
  dataset TEXT NOT NULL,

  -- AI model name (e.g. llama, mistral)
  model TEXT NOT NULL,

  -- Exact model identifier used in Workers AI
  -- example: "@cf/meta/llama-3-8b-instruct"
  model_version TEXT NOT NULL,

  -- Version of the prompt template used for analysis
  -- allows tracking changes in AI instructions
  prompt_version TEXT NOT NULL,

  -- The full AI generated analysis text
  analysis TEXT NOT NULL,

  -- Timestamp when the scheduled analysis job ran
  run_timestamp TEXT NOT NULL,

  -- Earliest timestamp of data included in the analysis
  -- example: last 3 days of metrics
  data_since TEXT NOT NULL

);

-- ============================================================
-- INDEX
-- Speeds up queries when retrieving latest analyses
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_analysis_time
ON analysis_reports(run_timestamp);