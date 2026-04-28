import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Activity,
  ActivityType,
  ActivityStatus,
} from './entities/activity.entity';
import {
  ActivityRelationship,
  RelationshipType,
} from './entities/activity-relationship.entity';
import { WbsNode } from './entities/wbs.entity';
import { WorkCalendar } from './entities/work-calendar.entity';
import { WorkWeek } from './entities/work-week.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import * as xml2js from 'xml2js';

const WBS_UID_PREFIX = 900000000;

@Injectable()
export class ScheduleImportService {
  constructor(
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(ActivityRelationship)
    private relationshipRepo: Repository<ActivityRelationship>,
    @InjectRepository(WbsNode)
    private wbsRepo: Repository<WbsNode>,
    @InjectRepository(WorkCalendar)
    private calendarRepo: Repository<WorkCalendar>,
    @InjectRepository(ProjectProfile)
    private projectProfileRepo: Repository<ProjectProfile>,
  ) {}

  async importMsProject(projectId: number, fileBuffer: Buffer) {
    const xmlContent = fileBuffer.toString('utf-8');
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true,
    });

    return this.wbsRepo.manager.transaction(async (manager) => {
      try {
        const result = await parser.parseStringPromise(xmlContent);
        const project = result.Project;
        if (!project || !project.Tasks || !project.Tasks.Task) {
          throw new BadRequestException('Invalid MS Project XML format');
        }

        // --- CALENDAR IMPORT START ---
        // --- CALENDAR IMPORT START ---
        try {
          const calendars = project.Calendars?.Calendar;
          if (calendars) {
            const calList = Array.isArray(calendars) ? calendars : [calendars];
            // Find Base Calendar (Project.CalendarUID matches or IsBaseCalendar=1)
            const projectCalUid = project.CalendarUID;
            let targetCal = calList.find((c: any) => c.UID === projectCalUid);
            if (!targetCal)
              targetCal = calList.find((c: any) => c.IsBaseCalendar === '1');

            // Fallback: Use the first calendar if no base found (Better than nothing)
            if (!targetCal && calList.length > 0) {
              console.warn(
                '[Import] No Base Calendar found, falling back to first available calendar.',
              );
              targetCal = calList[0];
            }

            if (targetCal) {
              // Parse Working Days
              const workingDaysSet = new Set<string>(); // 0=Sun

              // Safe parsing of WeekDays
              if (targetCal.WeekDays && targetCal.WeekDays.WeekDay) {
                const wds = Array.isArray(targetCal.WeekDays.WeekDay)
                  ? targetCal.WeekDays.WeekDay
                  : [targetCal.WeekDays.WeekDay];
                wds.forEach((wd: any) => {
                  if (wd.DayWorking === '1') {
                    const mspDay = parseInt(wd.DayType);
                    const setuDay = mspDay - 1;
                    if (setuDay >= 0 && setuDay <= 6) {
                      workingDaysSet.add(setuDay.toString());
                    }
                  }
                });
              }
              // Default to Mon-Fri if empty parsing (fallback)
              if (workingDaysSet.size === 0) {
                ['1', '2', '3', '4', '5'].forEach((d) => workingDaysSet.add(d));
              }

              // Parse Exceptions (Holidays)
              const holidays: string[] = [];
              if (targetCal.Exceptions && targetCal.Exceptions.Exception) {
                const excs = Array.isArray(targetCal.Exceptions.Exception)
                  ? targetCal.Exceptions.Exception
                  : [targetCal.Exceptions.Exception];
                excs.forEach((ex: any) => {
                  const parseDate = (d: any) => (d ? new Date(d) : null);
                  const isNonWorking = !ex.DayWorking || ex.DayWorking === '0';

                  if (ex.TimePeriod && isNonWorking) {
                    const from = parseDate(ex.TimePeriod.FromDate);
                    const to = parseDate(ex.TimePeriod.ToDate);
                    if (from && to) {
                      const curr = new Date(from);
                      while (curr <= to) {
                        holidays.push(curr.toISOString().split('T')[0]);
                        curr.setDate(curr.getDate() + 1);
                      }
                    }
                  }
                });
              }

              // Create Calendar Entity
              const newCal = manager.create(WorkCalendar, {
                name: `Imported - Project ${projectId} (${targetCal.Name || 'Standard'})`,
                description: `Imported from MSP`,
                workingDays: Array.from(workingDaysSet),
                holidays: holidays,
                isDefault: false,
                dailyWorkHours: 8,
              });

              const savedCal = await manager.save(newCal);

              // --- IMPORT WORK WEEKS ---
              if (targetCal.WorkWeeks && targetCal.WorkWeeks.WorkWeek) {
                const wwList = Array.isArray(targetCal.WorkWeeks.WorkWeek)
                  ? targetCal.WorkWeeks.WorkWeek
                  : [targetCal.WorkWeeks.WorkWeek];
                for (const ww of wwList) {
                  if (!ww.Name) continue;
                  const wwSet = new Set<string>();
                  // Parse WeekDays for this WorkWeek
                  if (ww.WeekDays && ww.WeekDays.WeekDay) {
                    const wds = Array.isArray(ww.WeekDays.WeekDay)
                      ? ww.WeekDays.WeekDay
                      : [ww.WeekDays.WeekDay];
                    wds.forEach((wd: any) => {
                      if (wd.DayWorking === '1') {
                        const mspDay = parseInt(wd.DayType);
                        const setuDay = mspDay - 1;
                        if (setuDay >= 0 && setuDay <= 6)
                          wwSet.add(setuDay.toString());
                      }
                    });
                  }

                  const from = ww.TimePeriod?.FromDate
                    ? new Date(ww.TimePeriod.FromDate)
                    : null;
                  const to = ww.TimePeriod?.ToDate
                    ? new Date(ww.TimePeriod.ToDate)
                    : null;

                  if (from && to) {
                    await manager.save(WorkWeek, {
                      calendar: savedCal,
                      name: ww.Name,
                      fromDate: from,
                      toDate: to,
                      workingDays: Array.from(wwSet),
                    });
                  } else if (wwSet.size > 0) {
                    // Update base defaults if it's the default definition
                    savedCal.workingDays = Array.from(wwSet);
                    await manager.save(savedCal);
                  }
                }
              }

              // Assign to Project Profile
              const profile = await manager.findOne(ProjectProfile, {
                where: { epsNode: { id: projectId } },
              });
              if (profile) {
                profile.calendar = savedCal;
                await manager.save(profile);
              }
            } else {
              console.warn(
                '[Import] No Calendar found in XML. Creating Default.',
              );
              throw new Error('No Calendar found'); // Trigger catch to create default
            }
          }
        } catch (calErr) {
          console.error(
            'Failed to parse specific calendar, creating Default Fallback...',
            calErr,
          );
          // Create a generic fallback calendar
          const defaultCal = manager.create(WorkCalendar, {
            name: `Imported Default - Project ${projectId}`,
            description: `Fallback Calendar (Import Failed)`,
            workingDays: ['1', '2', '3', '4', '5'],
            holidays: [],
            isDefault: false,
            dailyWorkHours: 8,
          });
          const savedDefault = await manager.save(defaultCal);
          // Assign to Project Profile
          const profile = await manager.findOne(ProjectProfile, {
            where: { epsNode: { id: projectId } },
          });
          if (profile) {
            profile.calendar = savedDefault;
            await manager.save(profile);
          }
        }
        // --- CALENDAR IMPORT END ---
        // --- CALENDAR IMPORT END ---

        const tasks = Array.isArray(project.Tasks.Task)
          ? project.Tasks.Task
          : [project.Tasks.Task];

        // Sort by OutlineNumber to process parents first (1, 1.1, 1.1.1)
        tasks.sort((a: any, b: any) => {
          const levelA = a.OutlineNumber ? a.OutlineNumber.toString() : '';
          const levelB = b.OutlineNumber ? b.OutlineNumber.toString() : '';
          return levelA.localeCompare(levelB, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        });

        const existingWbs = await manager.find(WbsNode, {
          where: { projectId },
        });
        const wbsCodeMap = new Map(
          existingWbs.map((node) => [node.wbsCode, node]),
        );

        // Pre-fetch all existing activities for this project once.
        // Build two lookup Maps so we avoid one findOne-per-task DB round-trip.
        const existingActivities = await manager.find(Activity, {
          where: { projectId },
        });
        const activityByMspUid = new Map<string, Activity>(
          existingActivities
            .filter((a) => a.mspUid != null)
            .map((a) => [a.mspUid!, a]),
        );
        const activityByCode = new Map<string, Activity>(
          existingActivities.map((a) => [a.activityCode, a]),
        );

        const wbsMap = new Map<string, WbsNode>(); // OutlineNumber -> WbsNode
        const uidToActivityId = new Map<string, number>(); // UID -> Activity ID
        const activitiesToSave: Activity[] = [];
        let count = 0;

        // 1. Create Root "Imported" Node if needed, or identify existing roots?
        // For valid hierarchy, MSP tasks usually start at OutlineNumber '1'.
        // If we want to import UNDER a specific node we'd need that context.
        // Here we assume mapping strictly by OutlineNumber structure relative to Project.

        for (const t of tasks) {
          const outlineNumber = t.OutlineNumber?.toString();
          if (!outlineNumber) continue;

          const uid = t.UID ? t.UID.toString() : null;
          const name = t.Name;
          const isSummary = t.Summary === '1'; // MSP Summary flag
          const parts = outlineNumber.split('.');

          // Determine Parent
          let parentNode: WbsNode | null = null;
          if (parts.length > 1) {
            const parentOutline = parts.slice(0, -1).join('.');
            parentNode = wbsMap.get(parentOutline) || null;
          }

          // System WBS Code Generation
          // We can reuse the OutlineNumber or generate new.
          // Let's use OutlineNumber to keep structure strictly matching MPP.
          const wbsCode = outlineNumber;

          if (isSummary) {
            const existing = wbsCodeMap.get(wbsCode);
            if (existing) {
              existing.wbsName = name;
              existing.parentId = parentNode?.id ?? null;
              existing.wbsLevel = parts.length;
              existing.sequenceNo = parseInt(parts[parts.length - 1], 10);
              const savedWbs = await manager.save(existing);
              wbsMap.set(outlineNumber, savedWbs);
              wbsCodeMap.set(wbsCode, savedWbs);
            } else {
              const wbsNode = manager.create(WbsNode, {
                projectId,
                parentId: parentNode?.id,
                wbsCode,
                wbsName: name,
                isControlAccount: false, // Default
                wbsLevel: parts.length,
                sequenceNo: parseInt(parts[parts.length - 1], 10),
                createdBy: 'Import',
              });
              const savedWbs = await manager.save(wbsNode);
              wbsMap.set(outlineNumber, savedWbs);
              wbsCodeMap.set(wbsCode, savedWbs);
            }
          } else {
            // It is a Leaf Task -> Create Activity
            // But Activity needs a Parent WBS.
            // If parentNode is null (it's a root task but not summary?), we might need a Root WBS.
            // Or we treat it as a task under the "Project" root implicitly?
            // Our Activity entity REQUIRES `wbsNode`.

            try {
              if (!parentNode) {
                // Create a dummy Root WBS for Toplevel Tasks if missing
                let rootWbs = wbsMap.get('ROOT');
                if (!rootWbs) {
                  rootWbs = await manager.save(
                    manager.create(WbsNode, {
                      projectId,
                      wbsCode: 'ROOT', // or '1' if conflict?
                      wbsName: 'Imported Schedule',
                      wbsLevel: 1,
                      sequenceNo: 1,
                      createdBy: 'Import',
                    }),
                  );
                  wbsMap.set('ROOT', rootWbs);
                }
                parentNode = rootWbs;
              }

              // Parse Dates/Duration
              // MSP Duration format: "PT8H0M0S" (ISO8601ish)
              // Or sometimes just "8" depending on parser config?
              // XML usually has "PT..."
              // We need a helper to parse PT string to hours.

              // Dates: 2019-02-28T08:00:00
              const start = t.Start ? new Date(t.Start) : null;
              const finish = t.Finish ? new Date(t.Finish) : null;

              // Parse Actuals
              const actualStart = t.ActualStart
                ? new Date(t.ActualStart)
                : null;
              const actualFinish = t.ActualFinish
                ? new Date(t.ActualFinish)
                : null;

              // Parse Baseline (Assume Baseline 0)
              let baselineStart: Date | null = null;
              let baselineFinish: Date | null = null;
              if (t.Baseline) {
                const baselines = Array.isArray(t.Baseline)
                  ? t.Baseline
                  : [t.Baseline];
                const bl = baselines.find((b: any) => b.Number === '0');
                if (bl) {
                  baselineStart = bl.Start ? new Date(bl.Start) : null;
                  baselineFinish = bl.Finish ? new Date(bl.Finish) : null;
                }
              }

              // Simplified Duration Parse (PT8H -> 8)
              let duration = 0;
              if (
                t.Duration &&
                typeof t.Duration === 'string' &&
                t.Duration.startsWith('PT')
              ) {
                const match = t.Duration.match(/PT(\d+)H/);
                if (match) {
                  const hours = parseInt(match[1]);
                  // Convert Hours to Days (Standard 8h day)
                  duration = hours / 8;
                }
              }

              if (!uid) continue;
              // Use pre-fetched Maps — no DB query per task.
              // Fallback to activityCode covers activities created before the
              // mspUid column existed (migration backfilled mspUid = id::text,
              // not = activityCode).
              const existingActivity =
                activityByMspUid.get(uid) ?? activityByCode.get(uid) ?? null;

              const computedStatus = actualFinish
                ? ActivityStatus.COMPLETED
                : actualStart
                  ? ActivityStatus.IN_PROGRESS
                  : ActivityStatus.NOT_STARTED;

              if (existingActivity) {
                existingActivity.wbsNode = parentNode;
                existingActivity.activityName = name;
                existingActivity.mspUid = uid; // Normalise for future fast-path lookup
                existingActivity.startDatePlanned = start;
                existingActivity.finishDatePlanned = finish;
                existingActivity.startDateActual = actualStart;
                existingActivity.finishDateActual = actualFinish;
                existingActivity.startDateBaseline = baselineStart;
                existingActivity.finishDateBaseline = baselineFinish;
                existingActivity.startDateMSP = start;
                existingActivity.finishDateMSP = finish;
                existingActivity.durationPlanned = duration;
                existingActivity.isMilestone = t.Milestone === '1';
                existingActivity.status = computedStatus;
                activitiesToSave.push(existingActivity);
                // Optimistically register the id — will be confirmed after batch save
                if (existingActivity.id) {
                  uidToActivityId.set(uid, existingActivity.id);
                }
              } else {
                const activity = manager.create(Activity, {
                  projectId,
                  wbsNode: parentNode,
                  activityCode: uid,
                  activityName: name,
                  mspUid: uid,
                  activityType: ActivityType.TASK,
                  status: computedStatus,
                  startDatePlanned: start,
                  finishDatePlanned: finish,
                  startDateActual: actualStart,
                  finishDateActual: actualFinish,
                  startDateBaseline: baselineStart,
                  finishDateBaseline: baselineFinish,
                  startDateMSP: start,
                  finishDateMSP: finish,
                  durationPlanned: duration,
                  isMilestone: t.Milestone === '1',
                  createdBy: 'Import',
                } as any);
                activitiesToSave.push(activity);
                count++;
              }
            } catch (err) {
              throw new Error(
                `Failed to import Task UID: ${uid}, Name: "${name}". Error: ${err.message}`,
              );
            }
          }
        }

        // Save in chunks of 50 to avoid the PostgreSQL "bind message has N
        // parameter formats" error that fires when a single INSERT has too many
        // $N placeholders (Activity has ~27 columns → 50 rows = ~1350 params).
        const CHUNK = 50;
        for (let i = 0; i < activitiesToSave.length; i += CHUNK) {
          const saved = await manager.save(
            activitiesToSave.slice(i, i + CHUNK),
          );
          for (const s of saved) {
            if (s.mspUid) uidToActivityId.set(s.mspUid, s.id);
          }
        }

        await manager.delete(ActivityRelationship, { projectId });

        // 2. Process Relationships (Second Pass)
        for (const t of tasks) {
          // Check PredecessorLink
          if (t.PredecessorLink) {
            const links = Array.isArray(t.PredecessorLink)
              ? t.PredecessorLink
              : [t.PredecessorLink];
            const successorId = uidToActivityId.get(t.UID?.toString());
            if (!successorId) continue;

            for (const link of links) {
              const predecessorUid = link.PredecessorUID?.toString();
              const predecessorId = uidToActivityId.get(predecessorUid);
              if (predecessorId) {
                // Map MSP Type (0=FF, 1=FS, 2=SF, 3=SS) to Enum
                let relType = RelationshipType.FS;
                if (link.Type) {
                  switch (link.Type) {
                    case '0':
                      relType = RelationshipType.FF;
                      break;
                    case '1':
                      relType = RelationshipType.FS;
                      break;
                    case '2':
                      relType = RelationshipType.SF;
                      break;
                    case '3':
                      relType = RelationshipType.SS;
                      break;
                  }
                }

                // LinkLag is in tenths of a minute (e.g. 9600 = 9600/10/60/8 = 2 days)
                let lagDays = 0;
                if (link.LinkLag) {
                  const val = parseInt(link.LinkLag);
                  if (!isNaN(val)) {
                    // 8 hours per day standard * 60 minutes * 10 tenths
                    lagDays = val / 4800; // 4800
                  }
                }

                // Create Rel
                await manager.save(
                  manager.create(ActivityRelationship, {
                    predecessor: { id: predecessorId } as Activity,
                    successor: { id: successorId } as Activity,
                    relationshipType: relType,
                    lagDays: lagDays,
                    projectId,
                  } as any),
                );
              }
            }
          }
        }

        return {
          message: `Successfully imported ${count} activities and generated WBS structure.`,
          preview: [],
        };
      } catch (e) {
        console.error('[MSP Import] Fatal error:', e);
        throw new BadRequestException(
          `Failed to parse XML: ${e.message}`,
        );
      }
    });
  }

  async exportMsProject(projectId: number): Promise<string> {
    const builder = new xml2js.Builder({
      headless: false,
      xmldec: { version: '1.0', encoding: 'UTF-8' },
    });

    const wbsNodes = await this.wbsRepo.find({
      where: { projectId },
      order: { wbsLevel: 'ASC', sequenceNo: 'ASC', id: 'ASC' },
    });
    const activities = await this.activityRepo.find({
      where: { projectId },
      relations: ['wbsNode'],
      order: { id: 'ASC' },
    });
    const relationships = await this.relationshipRepo.find({
      where: { projectId },
      relations: ['predecessor', 'successor'],
    });

    const outlineByWbsId = this.buildWbsOutlineNumbers(wbsNodes);

    const activityById = new Map(activities.map((a) => [a.id, a]));
    const predecessorLinksBySuccessor = new Map<number, any[]>();
    for (const rel of relationships) {
      if (!rel.successor?.id || !rel.predecessor?.id) continue;
      const existing = predecessorLinksBySuccessor.get(rel.successor.id) || [];
      existing.push({
        PredecessorUID: rel.predecessor.mspUid || rel.predecessor.id.toString(),
        Type: this.mapRelationshipType(rel.relationshipType),
        LinkLag: this.formatLag(rel.lagDays),
      });
      predecessorLinksBySuccessor.set(rel.successor.id, existing);
    }

    const tasks: any[] = [];

    for (const node of wbsNodes) {
      const outline = outlineByWbsId.get(node.id);
      if (!outline) continue;
      tasks.push({
        UID: (WBS_UID_PREFIX + node.id).toString(),
        ID: outline,
        Name: node.wbsName,
        OutlineNumber: outline,
        OutlineLevel: outline.split('.').length.toString(),
        Summary: '1',
      });
    }

    const activitiesByWbs = new Map<number, Activity[]>();
    for (const activity of activities) {
      if (!activity.wbsNode) continue;
      const list = activitiesByWbs.get(activity.wbsNode.id) || [];
      list.push(activity);
      activitiesByWbs.set(activity.wbsNode.id, list);
    }

    for (const [wbsId, list] of activitiesByWbs.entries()) {
      const outlinePrefix = outlineByWbsId.get(wbsId);
      if (!outlinePrefix) continue;
      list.sort((a, b) => a.id - b.id);
      list.forEach((activity, index) => {
        if (!activity.mspUid) {
          activity.mspUid = activity.id.toString();
        }

        const outline = `${outlinePrefix}.${index + 1}`;
        const start = activity.startDateMSP || activity.startDatePlanned;
        const finish = activity.finishDateMSP || activity.finishDatePlanned;
        const duration = this.formatDuration(activity.durationPlanned);
        const baseline = this.buildBaseline(activity);

        const task: any = {
          UID: activity.mspUid,
          ID: outline,
          Name: activity.activityName,
          OutlineNumber: outline,
          OutlineLevel: outline.split('.').length.toString(),
          Start: start ? start.toISOString() : undefined,
          Finish: finish ? finish.toISOString() : undefined,
          Duration: duration,
          Milestone: activity.isMilestone ? '1' : '0',
        };

        const links = predecessorLinksBySuccessor.get(activity.id);
        if (links && links.length > 0) {
          task.PredecessorLink = links;
        }
        if (baseline) {
          task.Baseline = baseline;
        }

        tasks.push(task);
      });
    }

    await this.activityRepo.save(activities);

    const project = {
      Project: {
        Name: `SETU Working Schedule`,
        Tasks: { Task: tasks },
      },
    };

    return builder.buildObject(project);
  }

  private buildWbsOutlineNumbers(nodes: WbsNode[]): Map<number, string> {
    const outlineById = new Map<number, string>();
    const childrenByParent = new Map<number | null, WbsNode[]>();

    for (const node of nodes) {
      const list = childrenByParent.get(node.parentId || null) || [];
      list.push(node);
      childrenByParent.set(node.parentId || null, list);
    }

    const isOutline = (code: string) => /^\d+(\.\d+)*$/.test(code);

    const walk = (parentId: number | null, prefix: string | null) => {
      const children = childrenByParent.get(parentId || null) || [];
      children.sort((a, b) => {
        if (a.sequenceNo !== b.sequenceNo) return a.sequenceNo - b.sequenceNo;
        return a.id - b.id;
      });
      children.forEach((child, index) => {
        const outline =
          isOutline(child.wbsCode)
            ? child.wbsCode
            : prefix
              ? `${prefix}.${index + 1}`
              : `${index + 1}`;
        outlineById.set(child.id, outline);
        walk(child.id, outline);
      });
    };

    walk(null, null);
    return outlineById;
  }

  private formatDuration(durationDays: number): string {
    if (!durationDays || durationDays <= 0) return 'PT0H0M0S';
    const hours = Math.round(Number(durationDays) * 8);
    return `PT${hours}H0M0S`;
  }

  private buildBaseline(activity: Activity) {
    if (!activity.startDateBaseline || !activity.finishDateBaseline) return null;
    return [
      {
        Number: '0',
        Start: activity.startDateBaseline.toISOString(),
        Finish: activity.finishDateBaseline.toISOString(),
      },
    ];
  }

  private mapRelationshipType(type: RelationshipType): string {
    switch (type) {
      case RelationshipType.FF:
        return '0';
      case RelationshipType.FS:
        return '1';
      case RelationshipType.SF:
        return '2';
      case RelationshipType.SS:
        return '3';
      default:
        return '1';
    }
  }

  private formatLag(lagDays: number | null | undefined): string | undefined {
    if (!lagDays) return undefined;
    const val = Math.round(Number(lagDays) * 4800);
    return `${val}`;
  }

  async importPrimaveraP6(projectId: number, fileBuffer: Buffer) {
    // Parse P6 XML or XER
    throw new BadRequestException('P6 Import not yet implemented');
  }
}
