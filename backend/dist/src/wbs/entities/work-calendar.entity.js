"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkCalendar = void 0;
const typeorm_1 = require("typeorm");
let WorkCalendar = class WorkCalendar {
    id;
    name;
    description;
    isDefault;
    workingDays;
    holidays;
    defaultStartTime;
    defaultEndTime;
    dailyWorkHours;
    createdOn;
    updatedOn;
    workWeeks;
};
exports.WorkCalendar = WorkCalendar;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkCalendar.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkCalendar.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], WorkCalendar.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], WorkCalendar.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '1,2,3,4,5' }),
    __metadata("design:type", Array)
], WorkCalendar.prototype, "workingDays", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], WorkCalendar.prototype, "holidays", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '09:00' }),
    __metadata("design:type", String)
], WorkCalendar.prototype, "defaultStartTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '17:00' }),
    __metadata("design:type", String)
], WorkCalendar.prototype, "defaultEndTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 4, scale: 2, default: 8.0 }),
    __metadata("design:type", Number)
], WorkCalendar.prototype, "dailyWorkHours", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WorkCalendar.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WorkCalendar.prototype, "updatedOn", void 0);
exports.WorkCalendar = WorkCalendar = __decorate([
    (0, typeorm_1.Entity)('WorkCalendar')
], WorkCalendar);
//# sourceMappingURL=work-calendar.entity.js.map