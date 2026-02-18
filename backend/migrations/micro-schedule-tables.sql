-- Micro Schedule Module - Database Migration
-- Created: 2026-02-10
-- Description: Creates tables for quantity-driven lookahead planning and execution control

-- =====================================================
-- 1. DELAY REASON (Reference Data)
-- =====================================================
CREATE TABLE IF NOT EXISTS delay_reason (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'OTHER',
    description TEXT,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delay_reason_category ON delay_reason(category);
CREATE INDEX idx_delay_reason_active ON delay_reason("isActive");

-- =====================================================
-- 2. MICRO SCHEDULE (Main Container)
-- =====================================================
CREATE TABLE IF NOT EXISTS micro_schedule (
    id SERIAL PRIMARY KEY,
    "projectId" INTEGER NOT NULL,
    "parentActivityId" INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    
    -- Baseline Dates (Locked)
    "baselineStart" DATE NOT NULL,
    "baselineFinish" DATE NOT NULL,
    
    -- Planned Dates (Can be revised)
    "plannedStart" DATE NOT NULL,
    "plannedFinish" DATE NOT NULL,
    
    -- Forecast & Actual
    "forecastFinish" DATE,
    "actualStart" DATE,
    "actualFinish" DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'DRAFT',
    
    -- Overshoot Detection
    "overshootFlag" BOOLEAN DEFAULT false,
    "overshootDays" INTEGER DEFAULT 0,
    
    -- Quantity Tracking
    "totalAllocatedQty" DECIMAL(12,3) DEFAULT 0,
    "totalActualQty" DECIMAL(12,3) DEFAULT 0,
    
    -- Approval Workflow
    "createdBy" INTEGER NOT NULL,
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP,
    
    -- Audit
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_micro_schedule_activity FOREIGN KEY ("parentActivityId") REFERENCES activity(id) ON DELETE CASCADE,
    CONSTRAINT fk_micro_schedule_creator FOREIGN KEY ("createdBy") REFERENCES "user"(id),
    CONSTRAINT fk_micro_schedule_approver FOREIGN KEY ("approvedBy") REFERENCES "user"(id)
);

CREATE INDEX idx_micro_schedule_project ON micro_schedule("projectId");
CREATE INDEX idx_micro_schedule_parent ON micro_schedule("parentActivityId");
CREATE INDEX idx_micro_schedule_status ON micro_schedule(status);
CREATE INDEX idx_micro_schedule_deleted ON micro_schedule("deletedAt");
CREATE INDEX idx_micro_schedule_overshoot ON micro_schedule("overshootFlag") WHERE "overshootFlag" = true;

-- =====================================================
-- 3. MICRO SCHEDULE ACTIVITY (Breakdown Activities)
-- =====================================================
CREATE TABLE IF NOT EXISTS micro_schedule_activity (
    id SERIAL PRIMARY KEY,
    "microScheduleId" INTEGER NOT NULL,
    "parentActivityId" INTEGER NOT NULL,
    "boqItemId" INTEGER,
    "workOrderId" INTEGER,
    "epsNodeId" INTEGER NOT NULL,
    
    -- Activity Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Quantity Allocation
    "allocatedQty" DECIMAL(12,3) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    
    -- Schedule Dates
    "plannedStart" DATE NOT NULL,
    "plannedFinish" DATE NOT NULL,
    "forecastFinish" DATE,
    "actualStart" DATE,
    "actualFinish" DATE,
    
    -- Progress Tracking
    "progressPercent" DECIMAL(5,2) DEFAULT 0,
    "varianceDays" INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PLANNED',
    
    -- Audit
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_micro_activity_schedule FOREIGN KEY ("microScheduleId") REFERENCES micro_schedule(id) ON DELETE CASCADE,
    CONSTRAINT fk_micro_activity_parent FOREIGN KEY ("parentActivityId") REFERENCES activity(id) ON DELETE CASCADE,
    CONSTRAINT fk_micro_activity_boq FOREIGN KEY ("boqItemId") REFERENCES boq_item(id),
    CONSTRAINT fk_micro_activity_workorder FOREIGN KEY ("workOrderId") REFERENCES work_order(id),
    CONSTRAINT fk_micro_activity_eps FOREIGN KEY ("epsNodeId") REFERENCES eps_node(id) ON DELETE CASCADE
);

CREATE INDEX idx_micro_activity_schedule ON micro_schedule_activity("microScheduleId");
CREATE INDEX idx_micro_activity_parent ON micro_schedule_activity("parentActivityId");
CREATE INDEX idx_micro_activity_boq ON micro_schedule_activity("boqItemId");
CREATE INDEX idx_micro_activity_eps ON micro_schedule_activity("epsNodeId");
CREATE INDEX idx_micro_activity_status ON micro_schedule_activity(status);
CREATE INDEX idx_micro_activity_deleted ON micro_schedule_activity("deletedAt");
CREATE INDEX idx_micro_activity_dates ON micro_schedule_activity("plannedStart", "plannedFinish");

-- =====================================================
-- 4. MICRO DAILY LOG (Daily Execution Logs)
-- =====================================================
CREATE TABLE IF NOT EXISTS micro_daily_log (
    id SERIAL PRIMARY KEY,
    "microActivityId" INTEGER NOT NULL,
    
    -- Log Details
    "logDate" DATE NOT NULL,
    "qtyDone" DECIMAL(12,3) NOT NULL,
    
    -- Resource Tracking
    "manpowerCount" INTEGER DEFAULT 0,
    "equipmentHours" DECIMAL(8,2) DEFAULT 0,
    
    -- Delay Tracking
    "delayReasonId" INTEGER,
    remarks TEXT,
    
    -- Audit
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_daily_log_activity FOREIGN KEY ("microActivityId") REFERENCES micro_schedule_activity(id) ON DELETE CASCADE,
    CONSTRAINT fk_daily_log_delay FOREIGN KEY ("delayReasonId") REFERENCES delay_reason(id),
    CONSTRAINT fk_daily_log_creator FOREIGN KEY ("createdBy") REFERENCES "user"(id),
    
    -- Unique constraint: One log per activity per date
    CONSTRAINT uq_daily_log_activity_date UNIQUE ("microActivityId", "logDate")
);

CREATE INDEX idx_daily_log_activity ON micro_daily_log("microActivityId");
CREATE INDEX idx_daily_log_date ON micro_daily_log("logDate");
CREATE INDEX idx_daily_log_delay ON micro_daily_log("delayReasonId");
CREATE INDEX idx_daily_log_creator ON micro_daily_log("createdBy");

-- =====================================================
-- 5. MICRO QUANTITY LEDGER (Quantity Integrity Tracker)
-- =====================================================
CREATE TABLE IF NOT EXISTS micro_quantity_ledger (
    id SERIAL PRIMARY KEY,
    "parentActivityId" INTEGER NOT NULL,
    "workOrderId" INTEGER,
    "boqItemId" INTEGER NOT NULL,
    
    -- Quantity Tracking
    "totalParentQty" DECIMAL(12,3) NOT NULL,
    "allocatedQty" DECIMAL(12,3) DEFAULT 0,
    "consumedQty" DECIMAL(12,3) DEFAULT 0,
    "balanceQty" DECIMAL(12,3) DEFAULT 0,
    uom VARCHAR(20) NOT NULL,
    
    -- Reconciliation
    "lastReconciled" TIMESTAMP,
    
    -- Audit
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_ledger_activity FOREIGN KEY ("parentActivityId") REFERENCES activity(id) ON DELETE CASCADE,
    CONSTRAINT fk_ledger_workorder FOREIGN KEY ("workOrderId") REFERENCES work_order(id),
    CONSTRAINT fk_ledger_boq FOREIGN KEY ("boqItemId") REFERENCES boq_item(id) ON DELETE CASCADE,
    
    -- Unique constraint: One ledger per activity-boq combination
    CONSTRAINT uq_ledger_activity_boq UNIQUE ("parentActivityId", "boqItemId")
);

CREATE INDEX idx_ledger_activity ON micro_quantity_ledger("parentActivityId");
CREATE INDEX idx_ledger_boq ON micro_quantity_ledger("boqItemId");
CREATE INDEX idx_ledger_workorder ON micro_quantity_ledger("workOrderId");

-- =====================================================
-- 6. SEED DELAY REASONS (Reference Data)
-- =====================================================
INSERT INTO delay_reason (code, name, category, description) VALUES
-- Weather
('WEATHER_RAIN', 'Heavy Rain', 'WEATHER', 'Work stopped due to heavy rainfall'),
('WEATHER_WIND', 'High Wind', 'WEATHER', 'Work stopped due to strong winds'),
('WEATHER_HEAT', 'Extreme Heat', 'WEATHER', 'Work stopped due to extreme temperature'),

-- Material
('MAT_DELAY', 'Material Delivery Delay', 'MATERIAL', 'Materials not delivered on time'),
('MAT_SHORTAGE', 'Material Shortage', 'MATERIAL', 'Insufficient materials available'),
('MAT_QUALITY', 'Material Quality Issue', 'MATERIAL', 'Materials rejected due to quality'),
('MAT_APPROVAL', 'Material Approval Pending', 'MATERIAL', 'Waiting for material approval'),

-- Manpower
('MAN_SHORTAGE', 'Manpower Shortage', 'MANPOWER', 'Insufficient workers available'),
('MAN_ABSENT', 'Worker Absenteeism', 'MANPOWER', 'High absenteeism rate'),
('MAN_SKILL', 'Skill Gap', 'MANPOWER', 'Workers lack required skills'),

-- Equipment
('EQP_BREAKDOWN', 'Equipment Breakdown', 'EQUIPMENT', 'Equipment failure or breakdown'),
('EQP_UNAVAILABLE', 'Equipment Not Available', 'EQUIPMENT', 'Required equipment not available'),
('EQP_MAINTENANCE', 'Equipment Maintenance', 'EQUIPMENT', 'Equipment under maintenance'),

-- Design
('DES_CHANGE', 'Design Change', 'DESIGN', 'Design modifications requested'),
('DES_CLARIFICATION', 'Design Clarification', 'DESIGN', 'Waiting for design clarification'),
('DES_APPROVAL', 'Design Approval Pending', 'DESIGN', 'Waiting for design approval'),

-- Client
('CLI_APPROVAL', 'Client Approval Pending', 'CLIENT', 'Waiting for client approval'),
('CLI_CHANGE', 'Client Change Request', 'CLIENT', 'Client requested changes'),
('CLI_ACCESS', 'Site Access Issue', 'CLIENT', 'Client denied site access'),

-- Subcontractor
('SUB_DELAY', 'Subcontractor Delay', 'SUBCONTRACTOR', 'Subcontractor behind schedule'),
('SUB_QUALITY', 'Subcontractor Quality Issue', 'SUBCONTRACTOR', 'Subcontractor work quality poor'),
('SUB_COORDINATION', 'Subcontractor Coordination', 'SUBCONTRACTOR', 'Coordination issues with subcontractor'),

-- Coordination
('COORD_TRADE', 'Trade Coordination', 'COORDINATION', 'Coordination between trades'),
('COORD_SEQUENCE', 'Work Sequence Issue', 'COORDINATION', 'Work sequence conflict'),

-- Other
('OTHER_SAFETY', 'Safety Concern', 'OTHER', 'Work stopped due to safety issue'),
('OTHER_PERMIT', 'Permit Pending', 'OTHER', 'Waiting for work permit'),
('OTHER_INSPECTION', 'Inspection Pending', 'OTHER', 'Waiting for inspection'),
('OTHER_UTILITY', 'Utility Issue', 'OTHER', 'Utility service disruption')

ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 7. COMMENTS & DOCUMENTATION
-- =====================================================
COMMENT ON TABLE micro_schedule IS 'Main container for lookahead planning schedules';
COMMENT ON TABLE micro_schedule_activity IS 'Breakdown activities with quantity allocation';
COMMENT ON TABLE micro_daily_log IS 'Daily execution logs with manpower and equipment tracking';
COMMENT ON TABLE micro_quantity_ledger IS 'Quantity allocation integrity tracker';
COMMENT ON TABLE delay_reason IS 'Reference data for delay categorization';

COMMENT ON COLUMN micro_schedule."overshootFlag" IS 'True when forecastFinish > parentActivity.finishDatePlanned';
COMMENT ON COLUMN micro_schedule."overshootDays" IS 'Number of days forecast exceeds parent finish';
COMMENT ON COLUMN micro_quantity_ledger."balanceQty" IS 'Computed: totalParentQty - allocatedQty';
COMMENT ON COLUMN micro_daily_log."logDate" IS 'Date of work execution (one log per activity per date)';

-- =====================================================
-- 8. GRANT PERMISSIONS (Adjust as needed)
-- =====================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO setu_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO setu_app_user;
