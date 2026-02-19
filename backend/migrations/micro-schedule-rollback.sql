-- Micro Schedule Module - Rollback Migration
-- Created: 2026-02-10
-- Description: Drops all Micro Schedule tables in correct order (reverse dependencies)

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- This script will completely remove the Micro Schedule module
-- WARNING: This will delete ALL data in these tables
-- Make sure to backup data before running this script

-- =====================================================
-- 1. DROP TABLES (Reverse Order)
-- =====================================================

-- Drop child tables first (to avoid FK constraint violations)
DROP TABLE IF EXISTS micro_daily_log CASCADE;
DROP TABLE IF EXISTS micro_quantity_ledger CASCADE;
DROP TABLE IF EXISTS micro_schedule_activity CASCADE;
DROP TABLE IF EXISTS micro_schedule CASCADE;
DROP TABLE IF EXISTS delay_reason CASCADE;

-- =====================================================
-- 2. VERIFICATION
-- =====================================================
-- Verify tables are dropped
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'micro_daily_log') THEN
        RAISE EXCEPTION 'Table micro_daily_log still exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'micro_quantity_ledger') THEN
        RAISE EXCEPTION 'Table micro_quantity_ledger still exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'micro_schedule_activity') THEN
        RAISE EXCEPTION 'Table micro_schedule_activity still exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'micro_schedule') THEN
        RAISE EXCEPTION 'Table micro_schedule still exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delay_reason') THEN
        RAISE EXCEPTION 'Table delay_reason still exists';
    END IF;
    
    RAISE NOTICE 'All Micro Schedule tables successfully dropped';
END $$;
