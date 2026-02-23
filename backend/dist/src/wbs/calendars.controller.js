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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const work_week_entity_1 = require("./entities/work-week.entity");
const work_calendar_entity_1 = require("./entities/work-calendar.entity");
const project_profile_entity_1 = require("../eps/project-profile.entity");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const permissions_guard_1 = require("../auth/permissions.guard");
const permissions_decorator_1 = require("../auth/permissions.decorator");
let CalendarsController = class CalendarsController {
    calendarRepo;
    workWeekRepo;
    profileRepo;
    constructor(calendarRepo, workWeekRepo, profileRepo) {
        this.calendarRepo = calendarRepo;
        this.workWeekRepo = workWeekRepo;
        this.profileRepo = profileRepo;
    }
    async findAll() {
        const cals = await this.calendarRepo.find();
        for (const cal of cals) {
            cal.workWeeks = await this.workWeekRepo.find({
                where: { calendar: { id: cal.id } },
            });
        }
        return cals;
    }
    async findOne(id) {
        const cal = await this.calendarRepo.findOne({ where: { id } });
        if (!cal)
            throw new common_1.NotFoundException(`Calendar with ID ${id} not found`);
        cal.workWeeks = await this.workWeekRepo.find({
            where: { calendar: { id: cal.id } },
        });
        return cal;
    }
    async create(calendarData) {
        if (calendarData.isDefault) {
            await this.calendarRepo.update({ isDefault: true }, { isDefault: false });
        }
        const newCal = this.calendarRepo.create(calendarData);
        return this.calendarRepo.save(newCal);
    }
    async update(id, calendarData) {
        const cal = await this.findOne(id);
        if (calendarData.isDefault) {
            await this.calendarRepo.update({ isDefault: true }, { isDefault: false });
        }
        this.calendarRepo.merge(cal, calendarData);
        return this.calendarRepo.save(cal);
    }
    async remove(id) {
        const usageCount = await this.profileRepo.count({
            where: { calendar: { id: id } },
        });
        if (usageCount > 0) {
            throw new common_1.BadRequestException(`Cannot delete Calendar. It is currently assigned to ${usageCount} Project(s).`);
        }
        const result = await this.calendarRepo.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Calendar with ID ${id} not found`);
        }
    }
};
exports.CalendarsController = CalendarsController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.CALENDAR.READ'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CalendarsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.CALENDAR.READ'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CalendarsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.CALENDAR.CREATE'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CalendarsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.CALENDAR.UPDATE'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], CalendarsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, permissions_decorator_1.Permissions)('SCHEDULE.CALENDAR.DELETE'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CalendarsController.prototype, "remove", null);
exports.CalendarsController = CalendarsController = __decorate([
    (0, common_1.Controller)('calendars'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __param(0, (0, typeorm_1.InjectRepository)(work_calendar_entity_1.WorkCalendar)),
    __param(1, (0, typeorm_1.InjectRepository)(work_week_entity_1.WorkWeek)),
    __param(2, (0, typeorm_1.InjectRepository)(project_profile_entity_1.ProjectProfile)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CalendarsController);
//# sourceMappingURL=calendars.controller.js.map