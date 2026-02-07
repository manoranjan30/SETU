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
exports.WorkWeek = void 0;
const typeorm_1 = require("typeorm");
let WorkWeek = class WorkWeek {
    id;
    name;
    calendar;
    fromDate;
    toDate;
    workingDays;
};
exports.WorkWeek = WorkWeek;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkWeek.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkWeek.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('WorkCalendar', { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'calendar_id' }),
    __metadata("design:type", Object)
], WorkWeek.prototype, "calendar", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], WorkWeek.prototype, "fromDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], WorkWeek.prototype, "toDate", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], WorkWeek.prototype, "workingDays", void 0);
exports.WorkWeek = WorkWeek = __decorate([
    (0, typeorm_1.Entity)('WorkWeek')
], WorkWeek);
//# sourceMappingURL=work-week.entity.js.map