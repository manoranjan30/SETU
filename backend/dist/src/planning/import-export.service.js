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
exports.ImportExportService = void 0;
const common_1 = require("@nestjs/common");
const XLSX = __importStar(require("xlsx"));
let ImportExportService = class ImportExportService {
    generateRevisionTemplate(sourceActivities, relationships = []) {
        const predsMap = new Map();
        relationships.forEach((rel) => {
            const succId = rel.successor?.id;
            if (!succId)
                return;
            if (!predsMap.has(succId))
                predsMap.set(succId, []);
            const predCode = rel.predecessor?.activityCode || rel.predecessor?.id;
            predsMap
                .get(succId)
                ?.push(`${predCode}(${rel.relationshipType}+${rel.lagDays})`);
        });
        const grouped = new Map();
        sourceActivities.forEach((av) => {
            const wbsCode = av.activity?.wbsNode?.wbsCode || 'Unassigned';
            if (!grouped.has(wbsCode))
                grouped.set(wbsCode, []);
            grouped.get(wbsCode)?.push(av);
        });
        const data = [];
        const sortedWbs = Array.from(grouped.keys()).sort();
        for (const wbs of sortedWbs) {
            const firstAct = grouped.get(wbs)?.[0];
            const wbsName = firstAct?.activity?.wbsNode?.wbsName || '';
            data.push({
                'Activity Reference': '',
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
            grouped.get(wbs)?.forEach((av) => {
                const predString = predsMap.get(av.activityId)?.join(', ') || '';
                data.push({
                    'Activity Reference': av.activityId,
                    'WBS Code': '',
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
        const wscols = [
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            { wch: 50 },
            { wch: 15 },
            { wch: 15 },
            { wch: 10 },
            { wch: 30 },
            { wch: 15 },
            { wch: 15 },
            { wch: 30 },
            { wch: 10 },
            { wch: 10 },
        ];
        ws['!cols'] = wscols;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Schedule Data');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    parseRevisionFile(buffer) {
        const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        return rows
            .filter((row) => row['Activity Reference'])
            .map((row) => ({
            activityId: row['Activity Reference'],
            startDate: row['Start Date'],
            finishDate: row['Finish Date'],
            duration: row['Duration'],
            remarks: row['Remarks'],
            actualStart: row['Actual Start'],
            actualFinish: row['Actual Finish'],
        }));
    }
};
exports.ImportExportService = ImportExportService;
exports.ImportExportService = ImportExportService = __decorate([
    (0, common_1.Injectable)()
], ImportExportService);
//# sourceMappingURL=import-export.service.js.map