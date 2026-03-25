import dataSource from '../data-source';

async function main() {
  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      const counts = {
        executionAdjustments: Number(
          (
            await manager.query(
              'SELECT COUNT(*)::int AS count FROM "execution_progress_adjustment"',
            )
          )[0]?.count || 0,
        ),
        executionEntries: Number(
          (
            await manager.query(
              'SELECT COUNT(*)::int AS count FROM "execution_progress_entry"',
            )
          )[0]?.count || 0,
        ),
        measurementProgress: Number(
          (
            await manager.query(
              'SELECT COUNT(*)::int AS count FROM "measurement_progress"',
            )
          )[0]?.count || 0,
        ),
        quantityProgress: Number(
          (
            await manager.query(
              'SELECT COUNT(*)::int AS count FROM "quantity_progress_record"',
            )
          )[0]?.count || 0,
        ),
        microDailyLogs: Number(
          (
            await manager.query(
              'SELECT COUNT(*)::int AS count FROM "micro_daily_log"',
            )
          )[0]?.count || 0,
        ),
      };

      console.log('[reset-progress-state] Snapshot counts before reset:', counts);

      await manager.query('DELETE FROM "execution_progress_adjustment"');
      await manager.query('DELETE FROM "execution_progress_entry"');
      await manager.query('DELETE FROM "measurement_progress"');
      await manager.query('DELETE FROM "quantity_progress_record"');
      await manager.query('DELETE FROM "micro_daily_log"');

      await manager.query(
        `UPDATE "work_order_items"
         SET "executedQuantity" = 0`,
      );
      await manager.query(
        `UPDATE "measurement_element"
         SET "executedQty" = 0`,
      );
      await manager.query(
        `UPDATE "boq_sub_item"
         SET "executedQty" = 0`,
      );
      await manager.query(
        `UPDATE "boq_item"
         SET "consumedQty" = 0`,
      );
      await manager.query(
        `UPDATE "activity"
         SET "percentComplete" = 0,
             "actualValue" = 0,
             "startDateActual" = NULL,
             "finishDateActual" = NULL,
             "status" = 'NOT_STARTED'`,
      );
      await manager.query(
        `UPDATE "micro_schedule_activity"
         SET "progressPercent" = 0,
             "varianceDays" = 0,
             "actualStart" = NULL,
             "actualFinish" = NULL,
             "forecastFinish" = "plannedFinish",
             "status" = 'PLANNED'::micro_schedule_activity_status_enum`,
      );
      await manager.query(
        `UPDATE "micro_schedule"
         SET "totalActualQty" = 0,
             "actualStart" = NULL,
             "actualFinish" = NULL,
             "forecastFinish" = "plannedFinish",
             "overshootFlag" = FALSE,
             "overshootDays" = 0,
             "status" = CASE
               WHEN "status" IN ('ACTIVE', 'SUSPENDED', 'COMPLETED', 'ARCHIVED') THEN
                 CASE
                   WHEN "approvedAt" IS NOT NULL THEN 'APPROVED'::micro_schedule_status_enum
                   ELSE 'DRAFT'::micro_schedule_status_enum
                 END
               ELSE "status"
             END`,
      );
      await manager.query(
        `UPDATE "micro_quantity_ledger"
         SET "consumedQty" = 0,
             "balanceQty" = GREATEST(0, COALESCE("totalParentQty", 0) - COALESCE("allocatedQty", 0)),
             "lastReconciled" = NULL`,
      );
    });

    console.log('[reset-progress-state] Progress reset completed successfully.');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error('[reset-progress-state] Failed:', error);
  process.exit(1);
});
