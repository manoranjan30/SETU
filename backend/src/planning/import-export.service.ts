import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ActivityVersion } from './entities/activity-version.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';

@Injectable()
export class ImportExportService {
  generateRevisionTemplate(
    sourceActivities: ActivityVersion[],
    relationships: ActivityRelationship[] = [],
  ): Buffer {
    // Group Relations by Successor (for Predecessors column)
    const predsMap = new Map<number, string[]>();
    relationships.forEach((rel) => {
      const succId = rel.successor?.id;
      if (!succId) return;
      if (!predsMap.has(succId)) predsMap.set(succId, []);
      // Format: ID(Type+Lag) e.g. 101(FS+0)
      const predCode = rel.predecessor?.activityCode || rel.predecessor?.id;
      predsMap
        .get(succId)
        ?.push(`${predCode}(${rel.relationshipType}+${rel.lagDays})`);
    });

    // Group by WBS Code for better structure
    const grouped = new Map<string, ActivityVersion[]>();
    sourceActivities.forEach((av) => {
      const wbsCode = av.activity?.wbsNode?.wbsCode || 'Unassigned';
      if (!grouped.has(wbsCode)) grouped.set(wbsCode, []);
      grouped.get(wbsCode)?.push(av);
    });

    const data: any[] = [];

    // Sort keys (WBS Codes)
    const sortedWbs = Array.from(grouped.keys()).sort();

    for (const wbs of sortedWbs) {
      // Add WBS Header Row
      const firstAct = grouped.get(wbs)?.[0];
      const wbsName = firstAct?.activity?.wbsNode?.wbsName || '';

      data.push({
        'Activity Reference': '', // Empty for WBS header
        'WBS Code': wbs,
        'Activity Code': '',
        'Activity Name': `[WBS] ${wbs} - ${wbsName}`,
        'Start Date': null,
        'Finish Date': null,
        Duration: null,
        Remarks: 'Summary Level (Read Only)',
        'Actual Start': null,
        'Actual Finish': null,
        Predecessors: '',
        'Total Float': null,
        'Free Float': null,
      });

      // Add Activities
      grouped.get(wbs)?.forEach((av) => {
        const predString = predsMap.get(av.activityId)?.join(', ') || '';
        data.push({
          'Activity Reference': av.activityId,
          'WBS Code': '', // Indent visual
          'Activity Code': av.activity?.activityCode || '',
          'Activity Name': av.activity?.activityName || '',
          'Start Date': av.startDate ? new Date(av.startDate) : null,
          'Finish Date': av.finishDate ? new Date(av.finishDate) : null,
          Duration: av.duration,
          Remarks: av.remarks || '',
          'Actual Start': av.activity?.startDateActual
            ? new Date(av.activity.startDateActual)
            : null,
          'Actual Finish': av.activity?.finishDateActual
            ? new Date(av.activity.finishDateActual)
            : null,
          Predecessors: predString,
          'Total Float': av.totalFloat,
          'Free Float': av.freeFloat,
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);

    // Formatting (Auto-width)
    const wscols = [
      { wch: 15 }, // ID
      { wch: 20 }, // WBS
      { wch: 15 }, // Act Code
      { wch: 50 }, // Name (Wider)
      { wch: 15 }, // Start
      { wch: 15 }, // Finish
      { wch: 10 }, // Dur
      { wch: 30 }, // Remarks
      { wch: 15 }, // Act Start
      { wch: 15 }, // Act Finish
      { wch: 30 }, // Predecessors
      { wch: 10 }, // TF
      { wch: 10 }, // FF
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule Data');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  parseRevisionFile(buffer: Buffer): any[] {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    return rows
      .filter((row: any) => row['Activity Reference']) // Filter out WBS headers
      .map((row: any) => ({
        activityId: row['Activity Reference'],
        startDate: row['Start Date'],
        finishDate: row['Finish Date'],
        duration: row['Duration'],
        remarks: row['Remarks'],
        actualStart: row['Actual Start'],
        actualFinish: row['Actual Finish'],
      }));
  }
}
