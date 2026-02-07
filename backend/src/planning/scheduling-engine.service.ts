import { Injectable } from '@nestjs/common';
import { ActivityVersion } from './entities/activity-version.entity';
import {
  ActivityRelationship,
  RelationshipType,
} from '../wbs/entities/activity-relationship.entity';

@Injectable()
export class SchedulingEngineService {
  /**
   * Recalculates Critical Path Method (Forward/Backward Pass)
   * Updates dates, float, and critical path flag on the provided ActivityVersion objects.
   */
  calculateCPM(
    activities: ActivityVersion[],
    relationships: ActivityRelationship[],
    projectStartDate: Date = new Date(),
  ): ActivityVersion[] {
    if (activities.length === 0) return activities;

    // 0. Setup Maps
    // Map MasterActivityId -> ActivityVersion (Working Object)
    const avMap = new Map<number, ActivityVersion>();
    activities.forEach((av) => avMap.set(av.activityId, av));

    // Graph Definitions (using Master IDs)
    const successors = new Map<
      number,
      { target: number; type: RelationshipType; lag: number }[]
    >();
    const predecessors = new Map<
      number,
      { source: number; type: RelationshipType; lag: number }[]
    >();

    // Initialize Nodes
    activities.forEach((av) => {
      successors.set(av.activityId, []);
      predecessors.set(av.activityId, []);
      // Reset Calculated Fields (optional, or assume input is clean?)
      // We respect 'startDate' if it's treated as a Constraint/Manual Input for now.
      // But normally CPM calculates EarlyStart (ES).
      // Logic:
      // ES = max(Predecessors)
      // if (ManualStart > ES) ES = ManualStart (SNET constraint behavior)
      // EF = ES + Duration
    });

    // Build Graph
    relationships.forEach((rel) => {
      const src = rel.predecessor?.id;
      const tgt = rel.successor?.id;
      if (avMap.has(src) && avMap.has(tgt)) {
        successors
          .get(src)
          ?.push({ target: tgt, type: rel.relationshipType, lag: rel.lagDays });
        predecessors
          .get(tgt)
          ?.push({ source: src, type: rel.relationshipType, lag: rel.lagDays });
      }
    });

    // 1. FORWARD PASS (Calculate Early Dates)
    // Topological Sort (Kahn's) or simple iterative/recursive with memoization.
    // For CPM cycles, Kahn's detects them.

    const inDegree = new Map<number, number>();
    activities.forEach((av) =>
      inDegree.set(av.activityId, predecessors.get(av.activityId)?.length || 0),
    );

    const queue: number[] = [];
    inDegree.forEach((count, id) => {
      if (count === 0) queue.push(id);
    });

    const sortedOrder: number[] = [];

    // Determine Start Base
    const projectStartMs = new Date(projectStartDate).setHours(0, 0, 0, 0);

    // Temp storage for calculations (ms timestamps)
    const earlyStart = new Map<number, number>();
    const earlyFinish = new Map<number, number>();

    while (queue.length > 0) {
      const u = queue.shift()!;
      sortedOrder.push(u);

      const av = avMap.get(u)!;
      const durationMs = (av.duration || 0) * (24 * 60 * 60 * 1000); // Days to MS

      // Calculate ES
      let maxPredFinish = projectStartMs;

      // Check Predecessors
      const preds = predecessors.get(u) || [];
      preds.forEach((edge) => {
        const predEF = earlyFinish.get(edge.source) || projectStartMs;
        const lagMs = edge.lag * (24 * 60 * 60 * 1000);

        // FS: Start after Pred Finish
        if (edge.type === RelationshipType.FS) {
          if (predEF + lagMs > maxPredFinish) maxPredFinish = predEF + lagMs;
        }
        // SS: Start after Pred Start
        else if (edge.type === RelationshipType.SS) {
          const predES = earlyStart.get(edge.source) || projectStartMs;
          if (predES + lagMs > maxPredFinish) maxPredFinish = predES + lagMs;
        }
        // FF/SF complicate things (calculating Finish first), skipping for MVP (Assuming FS mostly)
        // Standard CPM simplifies to FS usually. Implementing FS/SS basic.
      });

      // Constraint Check: Is there a Manual Planned Start?
      // If the user IMPORTED a date, it sits in av.startDate.
      // We treat it as "Start No Earlier Than".
      let calcES = maxPredFinish;
      if (av.startDate) {
        const manualStart = new Date(av.startDate).getTime();
        if (manualStart > calcES) calcES = manualStart;
      }

      earlyStart.set(u, calcES);
      earlyFinish.set(u, calcES + durationMs);

      // Add Successors to Queue
      const succs = successors.get(u) || [];
      succs.forEach((edge) => {
        const currentIn = inDegree.get(edge.target) || 0;
        inDegree.set(edge.target, currentIn - 1);
        if (currentIn - 1 === 0) queue.push(edge.target);
      });
    }

    // Check for Cycles
    if (sortedOrder.length !== activities.length) {
      console.warn('Cycle detected in schedule! CPM results may be invalid.');
      // We continue with what we have or throw.
    }

    // 2. BACKWARD PASS (Calculate Late Dates & Float)
    const lateStart = new Map<number, number>();
    const lateFinish = new Map<number, number>();

    // Find Project Finish (Max EF)
    let projectFinish = projectStartMs;
    earlyFinish.forEach((ef) => {
      if (ef > projectFinish) projectFinish = ef;
    });

    // Iterate Reverse
    for (let i = sortedOrder.length - 1; i >= 0; i--) {
      const u = sortedOrder[i];
      const av = avMap.get(u)!;
      const durationMs = (av.duration || 0) * (24 * 60 * 60 * 1000);

      // Calculate LF
      let minSuccStart = projectFinish; // Default to Project End if no successors

      const succs = successors.get(u) || [];
      if (succs.length === 0) {
        minSuccStart = projectFinish;
      } else {
        // Min(Succ LS - lag)
        // Or Succ Start - Lag?
        // Late Finish = Min(Successor Late Start - Lag)
        // Need to initialize with a large number
        minSuccStart = Number.MAX_SAFE_INTEGER;

        succs.forEach((edge) => {
          const succLS = lateStart.get(edge.target);
          if (succLS !== undefined) {
            const lagMs = edge.lag * (24 * 60 * 60 * 1000);

            if (edge.type === RelationshipType.FS) {
              if (succLS - lagMs < minSuccStart) minSuccStart = succLS - lagMs;
            }
            // SS affects Late Start directly?
            // For MVP assume FS dominant.
          }
        });
        if (minSuccStart === Number.MAX_SAFE_INTEGER)
          minSuccStart = projectFinish;
      }

      // Constraint: Deadlines? (None for now)
      const calcLF = minSuccStart;
      const calcLS = calcLF - durationMs;

      lateFinish.set(u, calcLF);
      lateStart.set(u, calcLS);
    }

    // 3. Update Activities
    activities.forEach((av) => {
      const es = earlyStart.get(av.activityId);
      const ef = earlyFinish.get(av.activityId);
      const ls = lateStart.get(av.activityId);
      const lf = lateFinish.get(av.activityId);

      if (es !== undefined && ef !== undefined) {
        av.startDate = new Date(es);
        av.finishDate = new Date(ef);
      }

      if (ls !== undefined && es !== undefined) {
        // Total Float = LS - ES
        // Convert MS to Days
        const floatMs = ls - es;
        av.totalFloat = Math.round(floatMs / (24 * 60 * 60 * 1000));

        // Critical?
        av.isCritical = av.totalFloat <= 0;
      } else {
        av.totalFloat = 0;
        av.isCritical = false;
      }

      // Free Float = Min(Succ ES) - EF
      const succs = successors.get(av.activityId) || [];
      if (succs.length === 0) {
        av.freeFloat = 0; // Or Total Float? usually FF=0 if last.
      } else {
        let minSuccES = Number.MAX_SAFE_INTEGER;
        succs.forEach((edge) => {
          const sES = earlyStart.get(edge.target);
          if (sES !== undefined && sES < minSuccES) minSuccES = sES;
        });
        if (minSuccES !== Number.MAX_SAFE_INTEGER && ef !== undefined) {
          av.freeFloat = Math.round((minSuccES - ef) / (24 * 60 * 60 * 1000));
        } else {
          av.freeFloat = 0;
        }
      }
    });

    return activities;
  }
}
