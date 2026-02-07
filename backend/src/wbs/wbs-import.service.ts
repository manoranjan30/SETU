import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as xml2js from 'xml2js';
import { CreateWbsDto } from './dto/wbs.dto';

@Injectable()
export class WbsImportService {
  async parseAndPreview(fileBuffer: Buffer) {
    // Detect File Type
    const fileHeader = fileBuffer.slice(0, 5).toString('utf-8');
    if (fileHeader.trim().startsWith('<') || fileHeader.includes('<?xml')) {
      return this.parseXml(fileBuffer);
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Expected Header: Code, Name, Type (Task/CA), ParentCode (optional)
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    // Basic Validation
    if (jsonData.length === 0) throw new BadRequestException('Sheet is empty');

    // Normalize keys (trim spaces, lowercase)
    const cleanedData = jsonData.map((row: any) => {
      const newRow: any = {};
      Object.keys(row).forEach((key) => {
        newRow[key.trim().toLowerCase()] = row[key];
      });
      return newRow;
    });

    // Validate structure
    const requiredKeys = ['wbscode', 'wbsname'];
    // Activity fields optional: activitycode, activityname, type, duration
    const firstRow = cleanedData[0];
    const missingKeys = requiredKeys.filter(
      (k) => !Object.keys(firstRow).includes(k),
    );

    if (missingKeys.length > 0) {
      throw new BadRequestException(
        `Missing required columns: ${missingKeys.join(', ')}`,
      );
    }

    return cleanedData;
  }

  private async parseXml(fileBuffer: Buffer) {
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true,
    });
    try {
      const result = await parser.parseStringPromise(fileBuffer.toString());
      const project = result.Project || result.project; // Case insensitive check

      if (!project || !project.Tasks || !project.Tasks.Task) {
        throw new Error(
          'Invalid MSP XML Structure: Missing Project/Tasks/Task',
        );
      }

      let tasks = project.Tasks.Task;
      if (!Array.isArray(tasks)) tasks = [tasks]; // Handle single task case

      const parsedData: any[] = [];
      const taskMap = new Map<string, any>();

      // First Pass: Collect Tasks
      tasks.forEach((t: any) => {
        // MSP XML often includes a root summary task (UID 0) and summary tasks.
        // We map Summary Tasks to WBS Nodes and Leaf Tasks to Activities.

        const uid = t.UID;
        const name = t.Name;
        const durationStr = t.Duration; // Format: PT8H0M0S
        const start = t.Start;
        const finish = t.Finish;
        const wbs = t.WBS; // MSP WBS Code e.g. "1.2"
        const outlineLevel = parseInt(t.OutlineLevel || '1');
        const summary = t.Summary === '1';

        // Skip blank tasks
        if (!name) return;

        // Duration Parsing (PT8H -> Days)
        let durationDays = 0;
        if (durationStr && durationStr.startsWith('PT')) {
          // Simple Regex for Hours
          const hMatch = durationStr.match(/(\d+)H/);
          const hours = hMatch ? parseInt(hMatch[1]) : 0;
          durationDays = Math.ceil(hours / 8); // Assume 8h day for now (Standard)
        }

        const row: any = {
          uid,
          wbscode: wbs, // Direct use of MSP WBS
          wbsname: name, // For WBS Nodes

          // Fields for Activity
          activitycode: summary ? undefined : wbs || uid, // Use WBS or UID as code
          activityname: name,
          durationplanned: durationDays,
          startdateplanned: start,
          finishdateplanned: finish,
          type: summary ? 'WBS' : 'TASK',
        };

        parsedData.push(row);
        taskMap.set(uid, row);
      });

      // Note: Predecessors in MSP XML are nested:
      /*
            <Task>
                <PredecessorLink>
                    <PredecessorUID>2</PredecessorUID>
                    <Type>1</Type>
                </PredecessorLink>
            </Task>
            */
      // We might need to handle relationships separately or attach them to row.
      // For now, let's just return the flat structure matching Excel import expectations.
      // The current system expects flat rows.
      // Relationships are imported? The current Excel import doesn't seem to handle Predecessors column explicitly in the code I reviewed earlier?
      // Wait, I saw 'PREDECESSORS' column in the Schedule Table UI.
      // Let's check `cpm.service` logic or `Activity` entity. `ActivityRelationship` entity exists.
      // The Excel import service `parseAndPreview` DOES NOT seem to normalize `predecessors` column.
      // But `ScheduleImportWizard` calls `import` endpoint.
      // I need to check the CONTROLLER `ProjectsController` -> `importSchedule` to see how it handles the parsed data.
      // The `parseAndPreview` is just for PREVIEW?
      // Ah, `importSchedule` likely calls `parseAndPreview` then saves.
      // I should look at `wbs.controller` or `projects.controller`.

      // Assuming we just map to the same field names as Excel:
      // If Excel had 'predecessors', I should add it here too.
      // MSP XML:
      tasks.forEach((t: any) => {
        if (t.PredecessorLink) {
          let preds = t.PredecessorLink;
          if (!Array.isArray(preds)) preds = [preds];

          const predList: string[] = [];
          preds.forEach((p: any) => {
            const pUid = p.PredecessorUID;
            const pTask = taskMap.get(pUid);
            if (pTask && pTask.activitycode) {
              predList.push(pTask.activitycode); // Use activity code as simple ID
            }
          });

          if (predList.length > 0) {
            const myRow = taskMap.get(t.UID);
            if (myRow) myRow['predecessors'] = predList.join(';'); // Semicolon sep
          }
        }
      });

      return parsedData;
    } catch (e) {
      throw new BadRequestException('Failed to parse XML: ' + e.message);
    }
  }

  // Logic to validate relative hierarchy
  validateHierarchy(data: any[]) {
    // 1. Identify WBS Nodes (rows without activitycode)
    // If a row has activitycode, it is an ACTIVITY, and wbscode is its PARENT.
    // If a row has NO activitycode, it is a WBS NODE.

    const wbsNodes = data.filter((d) => !d.activitycode);
    const activities = data.filter((d) => d.activitycode);

    const wbsCodes = new Set(wbsNodes.map((d) => d.wbscode?.toString().trim()));
    const errors: string[] = [];

    // Validate WBS Hierarchy
    wbsNodes.forEach((row, index) => {
      const code = row.wbscode?.toString().trim();
      if (!code) {
        errors.push(`Row ${index + 1}: Missing WBS Code`);
        return;
      }

      // Check Parent Existence based on code structure (e.g., 1.1 -> parent 1)
      const parts = code.split('.');
      if (parts.length > 1) {
        const parentCode = parts.slice(0, -1).join('.');
        if (!wbsCodes.has(parentCode)) {
          // Check if parent might be in DB?
          // For bulk import, we usually expect full tree or at least parent in file.
          // We warning or error? Error ensures integrity.
          errors.push(
            `Row ${index + 1} (WBS ${code}): Parent WBS '${parentCode}' not found in file.`,
          );
        }
      }
    });

    // Validate Activities
    activities.forEach((row, index) => {
      const wbsCode = row.wbscode?.toString().trim();
      if (!wbsCode) {
        errors.push(
          `Row ${index + 1} (Activity ${row.activitycode}): Missing Parent WBS Code`,
        );
        return;
      }
      if (!wbsCodes.has(wbsCode)) {
        // Warning: Parent WBS might exist in DB but not in File.
        // If we strictly enforce "File contains everything", then Error.
        // Given this is "Import Data" which might append activities to existing WBS?
        // If so, we can't validate against Set.
        // Let's allow it but warn? Or assume valid.
        // For now, let's strictly require WBS in file OR we skipp validation if we can't check DB.
        // Let's assume strict for now to avoid orphans.
        // actually, user might want to import activities to existing WBS.
        // So we should NOT error here if not in file.
        // Check: if not in file, is it a valid format? Yes.
      }

      // DATE VALIDATION
      const dateFields = [
        'startdateplanned',
        'finishdateplanned',
        'startdateactual',
        'finishdateactual',
      ];
      dateFields.forEach((field) => {
        if (row[field]) {
          const dateVal = new Date(row[field]);
          if (isNaN(dateVal.getTime())) {
            errors.push(
              `Activity ${row.activitycode}: Invalid Date for ${field} (${row[field]})`,
            );
          } else {
            // Check for Year < 2000 OR > 2050 (Sanity Check)
            const year = dateVal.getFullYear();
            if (year < 2000) {
              errors.push(
                `Activity ${row.activitycode}: Invalid Year (${year}) for ${field}. Must be >= 2000.`,
              );
            } else if (year > 2050) {
              errors.push(
                `Activity ${row.activitycode}: Invalid Year (${year}) for ${field}. Must be <= 2050.`,
              );
            }
          }
        }
      });

      // DURATION VALIDATION
      if (row['durationplanned']) {
        const dur = parseInt(row['durationplanned'], 10);
        if (isNaN(dur)) {
          errors.push(
            `Activity ${row.activitycode}: Invalid Duration (${row['durationplanned']})`,
          );
        } else if (dur > 3650) {
          errors.push(
            `Activity ${row.activitycode}: Duration too long (${dur} days). Max allowed is 3650 (10 years).`,
          );
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  }
}
