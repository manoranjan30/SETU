import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaterialItpModule1769900000000 implements MigrationInterface {
  name = 'CreateMaterialItpModule1769900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_itp_templates" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "materialName" varchar(200) NOT NULL,
        "materialCode" varchar(100),
        "itpNo" varchar(100) NOT NULL,
        "revNo" varchar(20) NOT NULL DEFAULT '01',
        "title" varchar(255) NOT NULL,
        "description" text,
        "standardRefs" jsonb,
        "status" varchar(50) NOT NULL DEFAULT 'DRAFT',
        "approvalStatus" varchar(50) NOT NULL DEFAULT 'NOT_SUBMITTED',
        "approvalRunId" integer,
        "approvalStrategyId" integer,
        "approvalStrategyVersion" integer,
        "submittedById" integer,
        "submittedAt" TIMESTAMP,
        "effectiveFrom" date,
        "effectiveTo" date,
        "isGlobal" boolean NOT NULL DEFAULT false,
        "sourceTemplateId" integer,
        "copiedFromProjectId" integer,
        "createdById" integer,
        "approvedById" integer,
        "approvedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_itp_templates" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_itp_checkpoints" (
        "id" SERIAL NOT NULL,
        "templateId" integer NOT NULL,
        "sequence" integer NOT NULL DEFAULT 0,
        "section" varchar(80) NOT NULL DEFAULT 'OTHER',
        "slNo" varchar(50),
        "characteristic" text NOT NULL,
        "testSpecification" text,
        "unit" varchar(50),
        "verifyingDocument" varchar(80) NOT NULL DEFAULT 'OTHER',
        "frequencyType" varchar(80) NOT NULL DEFAULT 'MANUAL',
        "frequencyValue" integer,
        "frequencyUnit" varchar(50),
        "acceptanceCriteria" jsonb,
        "applicableGrades" jsonb,
        "inspectionCategory" jsonb,
        "contractorAction" jsonb,
        "pmcAction" jsonb,
        "isMandatory" boolean NOT NULL DEFAULT true,
        "requiresDocument" boolean NOT NULL DEFAULT false,
        "requiresPhotoEvidence" boolean NOT NULL DEFAULT false,
        "requiresNumericResult" boolean NOT NULL DEFAULT false,
        "requiresLabReport" boolean NOT NULL DEFAULT false,
        "requiresThirdParty" boolean NOT NULL DEFAULT false,
        "requiredEvidenceTypes" jsonb,
        "minPhotoCount" integer NOT NULL DEFAULT 0,
        "dueOffsetHours" integer,
        "expiryWindowDays" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_itp_checkpoints" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quality_material_itp_checkpoints_template"
          FOREIGN KEY ("templateId") REFERENCES "quality_material_itp_templates"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_receipts" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "itpTemplateId" integer NOT NULL,
        "materialName" varchar(200) NOT NULL,
        "materialCode" varchar(100),
        "brand" varchar(150),
        "grade" varchar(100),
        "supplier" varchar(200),
        "manufacturer" varchar(200),
        "batchNumber" varchar(150) NOT NULL,
        "lotNumber" varchar(150),
        "challanNumber" varchar(150),
        "quantity" numeric(14,3),
        "uom" varchar(50),
        "receivedDate" date NOT NULL,
        "manufactureDate" date,
        "packingWeekNo" varchar(50),
        "status" varchar(50) NOT NULL DEFAULT 'RECEIVED',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_receipts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quality_material_receipts_template"
          FOREIGN KEY ("itpTemplateId") REFERENCES "quality_material_itp_templates"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_test_obligations" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "receiptId" integer,
        "templateId" integer NOT NULL,
        "checkpointId" integer NOT NULL,
        "materialName" varchar(200) NOT NULL,
        "brand" varchar(150),
        "grade" varchar(100),
        "dueDate" date,
        "warningDate" date,
        "status" varchar(50) NOT NULL DEFAULT 'PENDING',
        "priority" varchar(50) NOT NULL DEFAULT 'MEDIUM',
        "assignedRole" varchar(100),
        "assignedUserId" integer,
        "reason" text,
        "lastResultId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_test_obligations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quality_material_test_obligations_receipt"
          FOREIGN KEY ("receiptId") REFERENCES "quality_material_receipts"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_quality_material_test_obligations_template"
          FOREIGN KEY ("templateId") REFERENCES "quality_material_itp_templates"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_quality_material_test_obligations_checkpoint"
          FOREIGN KEY ("checkpointId") REFERENCES "quality_material_itp_checkpoints"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_test_results" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "obligationId" integer NOT NULL,
        "receiptId" integer,
        "templateId" integer NOT NULL,
        "checkpointId" integer NOT NULL,
        "testDate" date NOT NULL,
        "testedById" integer,
        "testedByName" varchar(200),
        "labType" varchar(50) NOT NULL DEFAULT 'SITE',
        "documentType" varchar(80),
        "primaryDocumentUrl" text,
        "numericValue" numeric(14,4),
        "textValue" text,
        "observedGrade" varchar(100),
        "result" varchar(50) NOT NULL DEFAULT 'PENDING_REVIEW',
        "reviewStatus" varchar(50) NOT NULL DEFAULT 'DRAFT',
        "approvalRunId" integer,
        "approvalStrategyId" integer,
        "approvalStrategyVersion" integer,
        "submittedById" integer,
        "submittedAt" TIMESTAMP,
        "reviewedById" integer,
        "reviewedAt" TIMESTAMP,
        "remarks" text,
        "criteriaSnapshot" jsonb,
        "itpSnapshot" jsonb,
        "evidenceSummary" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_test_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quality_material_test_results_obligation"
          FOREIGN KEY ("obligationId") REFERENCES "quality_material_test_obligations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_quality_material_test_results_receipt"
          FOREIGN KEY ("receiptId") REFERENCES "quality_material_receipts"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_quality_material_test_results_template"
          FOREIGN KEY ("templateId") REFERENCES "quality_material_itp_templates"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_quality_material_test_results_checkpoint"
          FOREIGN KEY ("checkpointId") REFERENCES "quality_material_itp_checkpoints"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_evidence_files" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "ownerType" varchar(50) NOT NULL,
        "ownerId" integer NOT NULL,
        "resultId" integer,
        "receiptId" integer,
        "templateId" integer,
        "checkpointId" integer,
        "evidenceType" varchar(80) NOT NULL,
        "fileKind" varchar(30) NOT NULL,
        "fileName" varchar(255) NOT NULL,
        "originalName" varchar(255) NOT NULL,
        "mimeType" varchar(120) NOT NULL,
        "sizeBytes" integer NOT NULL,
        "relativeUrl" text NOT NULL,
        "thumbnailUrl" text,
        "description" text,
        "uploadedById" integer,
        "uploadedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "isRequired" boolean NOT NULL DEFAULT false,
        "isLocked" boolean NOT NULL DEFAULT false,
        "lockedAt" TIMESTAMP,
        "lockReason" text,
        "revisionNo" integer NOT NULL DEFAULT 1,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_evidence_files" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_approval_runs" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "documentType" varchar(80) NOT NULL,
        "documentId" integer NOT NULL,
        "releaseStrategyId" integer NOT NULL,
        "releaseStrategyVersion" integer NOT NULL,
        "strategyName" varchar(200) NOT NULL,
        "moduleCode" varchar(50) NOT NULL DEFAULT 'QUALITY',
        "processCode" varchar(100) NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'IN_PROGRESS',
        "currentStepOrder" integer NOT NULL DEFAULT 1,
        "initiatorUserId" integer,
        "contextSnapshot" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_approval_runs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "quality_material_approval_steps" (
        "id" SERIAL NOT NULL,
        "runId" integer NOT NULL,
        "stepOrder" integer NOT NULL,
        "stepName" varchar(200),
        "approverMode" varchar(50),
        "assignedUserId" integer,
        "assignedUserIds" jsonb,
        "assignedRoleId" integer,
        "minApprovalsRequired" integer NOT NULL DEFAULT 1,
        "currentApprovalCount" integer NOT NULL DEFAULT 0,
        "approvedUserIds" jsonb,
        "status" varchar(50) NOT NULL DEFAULT 'WAITING',
        "signatureId" integer,
        "signedBy" varchar(255),
        "signerDisplayName" varchar(255),
        "signerCompany" varchar(255),
        "signerRole" varchar(255),
        "completedAt" TIMESTAMP,
        "comments" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quality_material_approval_steps" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quality_material_approval_steps_run"
          FOREIGN KEY ("runId") REFERENCES "quality_material_approval_runs"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmit_project_status" ON "quality_material_itp_templates" ("projectId", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmit_material" ON "quality_material_itp_templates" ("projectId", "materialName", "materialCode")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmic_template_sequence" ON "quality_material_itp_checkpoints" ("templateId", "sequence")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmr_project_received" ON "quality_material_receipts" ("projectId", "receivedDate")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmto_project_status_due" ON "quality_material_test_obligations" ("projectId", "status", "dueDate")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmtr_project_review" ON "quality_material_test_results" ("projectId", "reviewStatus")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qme_owner" ON "quality_material_evidence_files" ("ownerType", "ownerId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmar_document" ON "quality_material_approval_runs" ("documentType", "documentId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_qmas_run_status" ON "quality_material_approval_steps" ("runId", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmas_run_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmar_document"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qme_owner"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmtr_project_review"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmto_project_status_due"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmr_project_received"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmic_template_sequence"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmit_material"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_qmit_project_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_approval_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_approval_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_evidence_files"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_test_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_test_obligations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_itp_checkpoints"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "quality_material_itp_templates"`);
  }
}

