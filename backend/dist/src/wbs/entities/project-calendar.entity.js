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
exports.ProjectCalendar = void 0;
const typeorm_1 = require("typeorm");
let ProjectCalendar = class ProjectCalendar {
    id;
    projectId;
    workingDays;
    holidays;
    defaultStartTime;
    defaultEndTime;
    createdOn;
    updatedOn;
};
exports.ProjectCalendar = ProjectCalendar;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ProjectCalendar.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ProjectCalendar.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '1,2,3,4,5' }),
    __metadata("design:type", Array)
], ProjectCalendar.prototype, "workingDays", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], ProjectCalendar.prototype, "holidays", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '09:00' }),
    __metadata("design:type", String)
], ProjectCalendar.prototype, "defaultStartTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '17:00' }),
    __metadata("design:type", String)
], ProjectCalendar.prototype, "defaultEndTime", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ProjectCalendar.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ProjectCalendar.prototype, "updatedOn", void 0);
exports.ProjectCalendar = ProjectCalendar = __decorate([
    (0, typeorm_1.Entity)()
], ProjectCalendar);
//# sourceMappingURL=project-calendar.entity.js.map