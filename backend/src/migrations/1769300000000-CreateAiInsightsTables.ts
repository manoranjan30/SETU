import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiInsightsTables1769300000000 implements MigrationInterface {
  name = 'CreateAiInsightsTables1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── AI Model Config (provider settings managed in admin panel) ───────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_model_config" (
        "id"             SERIAL PRIMARY KEY,
        "provider"       VARCHAR(50)  NOT NULL DEFAULT 'openrouter',
        "apiKey"         TEXT,
        "endpoint"       VARCHAR(500),
        "model"          VARCHAR(200) NOT NULL DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
        "maxTokens"      INT          NOT NULL DEFAULT 4096,
        "temperature"    FLOAT        NOT NULL DEFAULT 0.2,
        "isActive"       BOOLEAN      NOT NULL DEFAULT true,
        "label"          VARCHAR(200),
        "notes"          TEXT,
        "azureTenantId"  VARCHAR(200),
        "azureClientId"  VARCHAR(200),
        "azureClientSecret" TEXT,
        "azureDeployment"   VARCHAR(200),
        "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default OpenRouter config
    await queryRunner.query(`
      INSERT INTO "ai_model_config"
        ("provider", "model", "label", "notes", "isActive")
      VALUES
        ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free',
         'OpenRouter – Llama 3.3 70B (Free)',
         'Free tier. Add your OpenRouter API key in admin settings.', true)
      ON CONFLICT DO NOTHING
    `);

    // ─── Insight Templates ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insight_template" (
        "id"                 SERIAL PRIMARY KEY,
        "name"               VARCHAR(200) NOT NULL,
        "slug"               VARCHAR(100) NOT NULL UNIQUE,
        "description"        TEXT,
        "isSystem"           BOOLEAN      NOT NULL DEFAULT false,
        "isActive"           BOOLEAN      NOT NULL DEFAULT true,
        "requiredPermission" VARCHAR(150) NOT NULL DEFAULT 'AI.INSIGHTS.RUN',
        "scope"              VARCHAR(20)  NOT NULL DEFAULT 'PROJECT',
        "dataSources"        JSONB        NOT NULL DEFAULT '[]',
        "promptTemplate"     TEXT         NOT NULL,
        "outputSchema"       JSONB,
        "icon"               VARCHAR(50)  DEFAULT 'Brain',
        "tags"               JSONB        DEFAULT '[]',
        "sortOrder"          INT          NOT NULL DEFAULT 0,
        "createdById"        INT          REFERENCES "user"("id") ON DELETE SET NULL,
        "createdAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updatedAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // ─── Insight Runs ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insight_run" (
        "id"              SERIAL PRIMARY KEY,
        "templateId"      INT NOT NULL REFERENCES "insight_template"("id") ON DELETE CASCADE,
        "projectId"       INT,
        "requestedById"   INT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "modelConfigId"   INT REFERENCES "ai_model_config"("id") ON DELETE SET NULL,
        "status"          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
        "parameters"      JSONB,
        "dataSnapshot"    JSONB,
        "promptRendered"  TEXT,
        "result"          JSONB,
        "rawResponse"     TEXT,
        "modelUsed"       VARCHAR(200),
        "tokensUsed"      INT,
        "durationMs"      INT,
        "errorMessage"    TEXT,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "completedAt"     TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_insight_run_template"   ON "insight_run"("templateId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_insight_run_requester"  ON "insight_run"("requestedById")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_insight_run_project"    ON "insight_run"("projectId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_insight_run_status"     ON "insight_run"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_insight_run_created"    ON "insight_run"("createdAt" DESC)`);

    // ─── Seed 4 built-in system templates ────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO "insight_template"
        ("name","slug","description","isSystem","isActive","requiredPermission","scope",
         "dataSources","promptTemplate","outputSchema","icon","tags","sortOrder")
      VALUES
      (
        'Weekly Progress Summary',
        'weekly-progress-summary',
        'Summarises construction progress for the selected project over the last 7 days. Identifies top performers, delays, and provides actionable recommendations.',
        true, true, 'AI.INSIGHTS.RUN', 'PROJECT',
        '[{"key":"progress","label":"Progress Records","filters":{"days":7}},{"key":"activities","label":"Activity List"}]'::jsonb,
        'You are a construction project management analyst for an Indian real-estate developer. Analyse the following project data and return a structured JSON response.

PROJECT: {{project_name}}
DATE RANGE: {{date_range}}

PROGRESS DATA:
{{progress_data}}

ACTIVITY DATA:
{{activity_data}}

Return a JSON object with this exact schema:
{
  "headline": "One-sentence executive summary",
  "overallStatus": "ON_TRACK | AT_RISK | DELAYED",
  "progressPercentage": <number 0-100>,
  "sections": [
    {"title": "string", "content": "markdown string", "status": "good|warning|critical"}
  ],
  "recommendations": ["string", "string", "string"],
  "keyMetrics": [{"label": "string", "value": "string", "trend": "up|down|neutral"}]
}',
        '{"type":"object","properties":{"headline":{"type":"string"},"overallStatus":{"type":"string"},"progressPercentage":{"type":"number"},"sections":{"type":"array"},"recommendations":{"type":"array"},"keyMetrics":{"type":"array"}}}'::jsonb,
        'TrendingUp', '["progress","weekly","summary"]'::jsonb, 1
      ),
      (
        'Quality NCR Analysis',
        'quality-ncr-analysis',
        'Analyses Non-Conformance Reports and inspection results. Identifies recurring defect categories, high-risk areas, and contractor-level patterns.',
        true, true, 'AI.INSIGHTS.RUN', 'PROJECT',
        '[{"key":"quality_ncr","label":"NCR Records"},{"key":"quality_inspections","label":"Inspection Results"}]'::jsonb,
        'You are a construction quality management expert. Analyse the following quality data for the project and return structured insights.

PROJECT: {{project_name}}
DATE RANGE: {{date_range}}

NCR DATA:
{{quality_ncr_data}}

INSPECTION DATA:
{{quality_inspections_data}}

Return a JSON object with this exact schema:
{
  "headline": "One-sentence quality summary",
  "overallStatus": "ACCEPTABLE | NEEDS_ATTENTION | CRITICAL",
  "sections": [
    {"title": "string", "content": "markdown string", "status": "good|warning|critical"}
  ],
  "topDefectCategories": [{"category": "string", "count": <number>, "severity": "minor|major|critical"}],
  "recommendations": ["string"],
  "keyMetrics": [{"label": "string", "value": "string", "trend": "up|down|neutral"}]
}',
        '{"type":"object","properties":{"headline":{"type":"string"},"overallStatus":{"type":"string"},"sections":{"type":"array"},"topDefectCategories":{"type":"array"},"recommendations":{"type":"array"}}}'::jsonb,
        'ShieldCheck', '["quality","ncr","inspection"]'::jsonb, 2
      ),
      (
        'EHS Risk Report',
        'ehs-risk-report',
        'Analyses EHS observations and incidents. Identifies hazard patterns, high-risk zones, and recommends safety interventions.',
        true, true, 'AI.INSIGHTS.RUN', 'PROJECT',
        '[{"key":"ehs_observations","label":"EHS Observations"},{"key":"ehs_incidents","label":"EHS Incidents"}]'::jsonb,
        'You are a construction safety (EHS) expert. Analyse the following safety data and return structured insights.

PROJECT: {{project_name}}
DATE RANGE: {{date_range}}

EHS OBSERVATIONS:
{{ehs_observations_data}}

EHS INCIDENTS:
{{ehs_incidents_data}}

Return a JSON object with this exact schema:
{
  "headline": "One-sentence safety summary",
  "overallStatus": "SAFE | ELEVATED_RISK | CRITICAL",
  "riskScore": <number 1-10>,
  "sections": [
    {"title": "string", "content": "markdown string", "status": "good|warning|critical"}
  ],
  "topHazards": [{"hazard": "string", "frequency": <number>, "severity": "low|medium|high"}],
  "recommendations": ["string"],
  "keyMetrics": [{"label": "string", "value": "string", "trend": "up|down|neutral"}]
}',
        '{"type":"object","properties":{"headline":{"type":"string"},"overallStatus":{"type":"string"},"riskScore":{"type":"number"},"sections":{"type":"array"},"topHazards":{"type":"array"},"recommendations":{"type":"array"}}}'::jsonb,
        'ShieldAlert', '["ehs","safety","risk"]'::jsonb, 3
      ),
      (
        'BOQ Cost Variance Analysis',
        'boq-variance-analysis',
        'Analyses BOQ burn vs. planned budget. Identifies items with significant cost variance and provides an executive summary.',
        true, true, 'AI.INSIGHTS.RUN', 'PROJECT',
        '[{"key":"boq_items","label":"BOQ Items & Budget"},{"key":"progress","label":"Progress Records"}]'::jsonb,
        'You are a construction cost management expert. Analyse the following BOQ and progress data for the project.

PROJECT: {{project_name}}
DATE RANGE: {{date_range}}

BOQ DATA:
{{boq_items_data}}

PROGRESS DATA:
{{progress_data}}

Return a JSON object with this exact schema:
{
  "headline": "One-sentence cost summary",
  "overallStatus": "UNDER_BUDGET | ON_BUDGET | OVER_BUDGET",
  "totalBudget": <number>,
  "estimatedVariance": <number>,
  "sections": [
    {"title": "string", "content": "markdown string", "status": "good|warning|critical"}
  ],
  "varianceItems": [{"boqCode": "string", "description": "string", "variancePct": <number>, "severity": "low|medium|high"}],
  "recommendations": ["string"],
  "keyMetrics": [{"label": "string", "value": "string", "trend": "up|down|neutral"}]
}',
        '{"type":"object","properties":{"headline":{"type":"string"},"overallStatus":{"type":"string"},"totalBudget":{"type":"number"},"estimatedVariance":{"type":"number"},"sections":{"type":"array"},"varianceItems":{"type":"array"},"recommendations":{"type":"array"}}}'::jsonb,
        'IndianRupee', '["boq","cost","budget","variance"]'::jsonb, 4
      )
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "insight_run"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "insight_template"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_model_config"`);
  }
}
