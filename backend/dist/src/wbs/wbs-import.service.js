"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WbsImportService = void 0;
const common_1 = require("@nestjs/common");
const XLSX = __importStar(require("xlsx"));
const xml2js = __importStar(require("xml2js"));
let WbsImportService = class WbsImportService {
    async parseAndPreview(fileBuffer) {
        const fileHeader = fileBuffer.slice(0, 5).toString('utf-8');
        if (fileHeader.trim().startsWith('<') || fileHeader.includes('<?xml')) {
            return this.parseXml(fileBuffer);
        }
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        if (jsonData.length === 0)
            throw new common_1.BadRequestException('Sheet is empty');
        const cleanedData = jsonData.map((row) => {
            const newRow = {};
            Object.keys(row).forEach((key) => {
                newRow[key.trim().toLowerCase()] = row[key];
            });
            return newRow;
        });
        const requiredKeys = ['wbscode', 'wbsname'];
        const firstRow = cleanedData[0];
        const missingKeys = requiredKeys.filter((k) => !Object.keys(firstRow).includes(k));
        if (missingKeys.length > 0) {
            throw new common_1.BadRequestException(`Missing required columns: ${missingKeys.join(', ')}`);
        }
        return cleanedData;
    }
    async parseXml(fileBuffer) {
        const parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: true,
        });
        try {
            const result = await parser.parseStringPromise(fileBuffer.toString());
            const project = result.Project || result.project;
            if (!project || !project.Tasks || !project.Tasks.Task) {
                throw new Error('Invalid MSP XML Structure: Missing Project/Tasks/Task');
            }
            let tasks = project.Tasks.Task;
            if (!Array.isArray(tasks))
                tasks = [tasks];
            const parsedData = [];
            const taskMap = new Map();
            tasks.forEach((t) => {
                const uid = t.UID;
                const name = t.Name;
                const durationStr = t.Duration;
                const start = t.Start;
                const finish = t.Finish;
                const wbs = t.WBS;
                const outlineLevel = parseInt(t.OutlineLevel || '1');
                const summary = t.Summary === '1';
                if (!name)
                    return;
                let durationDays = 0;
                if (durationStr && durationStr.startsWith('PT')) {
                    const hMatch = durationStr.match(/(\d+)H/);
                    const hours = hMatch ? parseInt(hMatch[1]) : 0;
                    durationDays = Math.ceil(hours / 8);
                }
                const row = {
                    uid,
                    wbscode: wbs,
                    wbsname: name,
                    activitycode: summary ? undefined : wbs || uid,
                    activityname: name,
                    durationplanned: durationDays,
                    startdateplanned: start,
                    finishdateplanned: finish,
                    type: summary ? 'WBS' : 'TASK',
                };
                parsedData.push(row);
                taskMap.set(uid, row);
            });
            tasks.forEach((t) => {
                if (t.PredecessorLink) {
                    let preds = t.PredecessorLink;
                    if (!Array.isArray(preds))
                        preds = [preds];
                    const predList = [];
                    preds.forEach((p) => {
                        const pUid = p.PredecessorUID;
                        const pTask = taskMap.get(pUid);
                        if (pTask && pTask.activitycode) {
                            predList.push(pTask.activitycode);
                        }
                    });
                    if (predList.length > 0) {
                        const myRow = taskMap.get(t.UID);
                        if (myRow)
                            myRow['predecessors'] = predList.join(';');
                    }
                }
            });
            return parsedData;
        }
        catch (e) {
            throw new common_1.BadRequestException('Failed to parse XML: ' + e.message);
        }
    }
    validateHierarchy(data) {
        const wbsNodes = data.filter((d) => !d.activitycode);
        const activities = data.filter((d) => d.activitycode);
        const wbsCodes = new Set(wbsNodes.map((d) => d.wbscode?.toString().trim()));
        const errors = [];
        wbsNodes.forEach((row, index) => {
            const code = row.wbscode?.toString().trim();
            if (!code) {
                errors.push(`Row ${index + 1}: Missing WBS Code`);
                return;
            }
            const parts = code.split('.');
            if (parts.length > 1) {
                const parentCode = parts.slice(0, -1).join('.');
                if (!wbsCodes.has(parentCode)) {
                    errors.push(`Row ${index + 1} (WBS ${code}): Parent WBS '${parentCode}' not found in file.`);
                }
            }
        });
        activities.forEach((row, index) => {
            const wbsCode = row.wbscode?.toString().trim();
            if (!wbsCode) {
                errors.push(`Row ${index + 1} (Activity ${row.activitycode}): Missing Parent WBS Code`);
                return;
            }
            if (!wbsCodes.has(wbsCode)) {
            }
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
                        errors.push(`Activity ${row.activitycode}: Invalid Date for ${field} (${row[field]})`);
                    }
                    else {
                        const year = dateVal.getFullYear();
                        if (year < 2000) {
                            errors.push(`Activity ${row.activitycode}: Invalid Year (${year}) for ${field}. Must be >= 2000.`);
                        }
                        else if (year > 2050) {
                            errors.push(`Activity ${row.activitycode}: Invalid Year (${year}) for ${field}. Must be <= 2050.`);
                        }
                    }
                }
            });
            if (row['durationplanned']) {
                const dur = parseInt(row['durationplanned'], 10);
                if (isNaN(dur)) {
                    errors.push(`Activity ${row.activitycode}: Invalid Duration (${row['durationplanned']})`);
                }
                else if (dur > 3650) {
                    errors.push(`Activity ${row.activitycode}: Duration too long (${dur} days). Max allowed is 3650 (10 years).`);
                }
            }
        });
        return { isValid: errors.length === 0, errors };
    }
};
exports.WbsImportService = WbsImportService;
exports.WbsImportService = WbsImportService = __decorate([
    (0, common_1.Injectable)()
], WbsImportService);
//# sourceMappingURL=wbs-import.service.js.map