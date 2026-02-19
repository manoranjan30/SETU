# Micro Schedule Module - Database Migration Guide

**Created**: 2026-02-10  
**Module**: Micro Schedule (Lookahead Planning & Execution Control)

---

## 📋 Overview

This migration creates 5 new tables for the Micro Schedule module:

1. **`delay_reason`** - Reference data for delay categorization (26 predefined reasons)
2. **`micro_schedule`** - Main container for lookahead schedules
3. **`micro_schedule_activity`** - Breakdown activities with quantity allocation
4. **`micro_daily_log`** - Daily execution logs
5. **`micro_quantity_ledger`** - Quantity allocation integrity tracker

---

## 🚀 Running the Migration

### Option 1: Manual Execution (Recommended for first time)

```bash
# Connect to PostgreSQL
psql -U admin -d setu_db

# Run migration
\i backend/migrations/micro-schedule-tables.sql

# Verify tables created
\dt micro_*
\dt delay_reason

# Check seed data
SELECT COUNT(*) FROM delay_reason;
-- Should return 26 rows
```

### Option 2: Using TypeORM (If configured)

Since the project uses `synchronize: true` in `app.module.ts`, TypeORM will automatically create tables when you start the backend.

```bash
cd backend
npm run start:dev
```

**Note**: TypeORM will create tables but **NOT** seed the delay reasons. You'll need to run the seed portion separately:

```sql
-- Run only the INSERT statements from micro-schedule-tables.sql
-- Lines 193-227 (Delay Reason seed data)
```

---

## 🔄 Rollback

If you need to remove the Micro Schedule module:

```bash
# Connect to PostgreSQL
psql -U admin -d setu_db

# Run rollback
\i backend/migrations/micro-schedule-rollback.sql
```

**⚠️ WARNING**: This will delete ALL data in Micro Schedule tables. Backup first!

---

## 📊 Tables Created

### 1. `delay_reason` (Reference Data)
- **Purpose**: Categorize delays in daily logs
- **Rows**: 26 predefined reasons
- **Categories**: WEATHER, MATERIAL, MANPOWER, EQUIPMENT, DESIGN, CLIENT, SUBCONTRACTOR, COORDINATION, OTHER

### 2. `micro_schedule`
- **Purpose**: Main container for lookahead schedules
- **Key Fields**: 
  - Baseline & planned dates
  - Forecast & actual dates
  - Status (DRAFT → SUBMITTED → APPROVED → ACTIVE → COMPLETED)
  - Overshoot flag & days
  - Total allocated & actual quantities
  - Approval workflow (createdBy, approvedBy, approvedAt)

### 3. `micro_schedule_activity`
- **Purpose**: Breakdown activities with quantity allocation
- **Key Fields**:
  - Links to micro schedule, parent activity, BOQ, work order, EPS node
  - Allocated quantity & UOM
  - Planned, forecast, actual dates
  - Progress percentage & variance days
  - Status (PLANNED, IN_PROGRESS, DELAYED, COMPLETED, CANCELLED)

### 4. `micro_daily_log`
- **Purpose**: Daily execution logs
- **Key Fields**:
  - Log date & quantity done
  - Manpower count & equipment hours
  - Delay reason & remarks
  - Created by (audit)
- **Constraint**: One log per activity per date

### 5. `micro_quantity_ledger`
- **Purpose**: Quantity allocation integrity tracker
- **Key Fields**:
  - Total parent quantity
  - Allocated quantity (sum of micro activities)
  - Consumed quantity (sum of daily logs)
  - Balance quantity (computed)
  - Last reconciled timestamp
- **Constraint**: One ledger per activity-BOQ combination

---

## 🔗 Relationships

```
Activity (Parent)
    ↓
MicroSchedule (1:N)
    ↓
MicroScheduleActivity (1:N)
    ↓
MicroDailyLog (1:N)
    ↓
DelayReason (N:1)

Activity + BoqItem
    ↓
MicroQuantityLedger (1:1)
```

---

## 📈 Indexes Created

### Performance Indexes
- `idx_micro_schedule_project` - Query by project
- `idx_micro_schedule_parent` - Query by parent activity
- `idx_micro_activity_schedule` - Query activities by schedule
- `idx_daily_log_activity` - Query logs by activity
- `idx_daily_log_date` - Query logs by date
- `idx_ledger_activity` - Query ledger by activity

### Functional Indexes
- `idx_micro_schedule_overshoot` - Partial index for overshoot flags
- `idx_micro_schedule_deleted` - Soft delete queries
- `idx_micro_activity_deleted` - Soft delete queries

### Composite Indexes
- `idx_micro_activity_dates` - Date range queries
- `uq_daily_log_activity_date` - Unique constraint
- `uq_ledger_activity_boq` - Unique constraint

---

## ✅ Verification Checklist

After running the migration, verify:

```sql
-- 1. Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'micro_%' OR table_name = 'delay_reason'
ORDER BY table_name;
-- Should return 5 rows

-- 2. Check delay reasons seeded
SELECT category, COUNT(*) 
FROM delay_reason 
GROUP BY category 
ORDER BY category;
-- Should show counts per category

-- 3. Check indexes created
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename LIKE 'micro_%' OR tablename = 'delay_reason'
ORDER BY tablename, indexname;
-- Should show multiple indexes per table

-- 4. Check foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name LIKE 'micro_%'
ORDER BY tc.table_name;
-- Should show all FK relationships
```

---

## 🔧 Troubleshooting

### Issue: Tables already exist
```
ERROR: relation "micro_schedule" already exists
```
**Solution**: Either:
1. Run rollback first: `\i backend/migrations/micro-schedule-rollback.sql`
2. Or manually drop tables: `DROP TABLE micro_schedule CASCADE;`

### Issue: Foreign key constraint fails
```
ERROR: insert or update on table "micro_schedule" violates foreign key constraint
```
**Solution**: Ensure parent tables exist:
- `activity` table must exist
- `user` table must exist
- `boq_item` table must exist
- `work_order` table must exist
- `eps_node` table must exist

### Issue: Delay reasons not seeded
```
SELECT COUNT(*) FROM delay_reason;
-- Returns 0
```
**Solution**: Run the INSERT statements manually from lines 193-227 of `micro-schedule-tables.sql`

---

## 📝 Notes

1. **TypeORM Synchronize**: The project uses `synchronize: true`, which means TypeORM will auto-create tables. However, it's recommended to run this migration manually for better control.

2. **Seed Data**: TypeORM synchronize does NOT run seed data. You must manually insert delay reasons.

3. **Soft Deletes**: All main tables use `deletedAt` timestamp for soft deletes. Queries should always include `WHERE deletedAt IS NULL`.

4. **Decimal Precision**: Quantities use `DECIMAL(12,3)` to support 3 decimal places (e.g., 123.456 m³).

5. **Date Types**: All dates use `DATE` type (not TIMESTAMP) for schedule dates. Only audit fields use TIMESTAMP.

---

## 🚀 Next Steps

After successful migration:

1. ✅ Restart backend to load new entities
2. ✅ Test API endpoints via Swagger (`http://localhost:3000/api`)
3. ✅ Create a test micro schedule
4. ✅ Verify quantity validation works
5. ✅ Test daily logging and progress calculation

---

**Last Updated**: 2026-02-10 23:55 IST
