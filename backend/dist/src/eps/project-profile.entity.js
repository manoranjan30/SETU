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
exports.ProjectProfile = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("./eps.entity");
const work_calendar_entity_1 = require("../wbs/entities/work-calendar.entity");
let ProjectProfile = class ProjectProfile {
    id;
    epsNode;
    projectCode;
    projectName;
    projectType;
    projectCategory;
    projectStatus;
    projectVersion;
    description;
    owningCompany;
    businessUnit;
    projectSponsorId;
    projectManagerId;
    planningManagerId;
    costControllerId;
    approvalAuthorityId;
    country;
    state;
    city;
    siteAddress;
    latitude;
    longitude;
    landArea;
    landOwnershipType;
    zoningClassification;
    plannedStartDate;
    plannedEndDate;
    actualStartDate;
    actualEndDate;
    calendar;
    calendarId;
    shiftPattern;
    milestoneStrategy;
    currency;
    estimatedProjectCost;
    approvedBudget;
    fundingType;
    revenueModel;
    taxStructure;
    escalationClause;
    constructionTechnology;
    structuralSystem;
    numberOfBuildings;
    typicalFloorCount;
    totalBuiltupArea;
    unitMix;
    heightRestriction;
    seismicZone;
    lifecycleStage;
    createdBy;
    createdOn;
    lastUpdatedBy;
    lastUpdatedOn;
    changeReason;
};
exports.ProjectProfile = ProjectProfile;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => eps_entity_1.EpsNode, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)(),
    __metadata("design:type", eps_entity_1.EpsNode)
], ProjectProfile.prototype, "epsNode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "owningCompany", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "businessUnit", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectSponsorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "projectManagerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "planningManagerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "costControllerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "approvalAuthorityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "country", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "siteAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "landArea", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "landOwnershipType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "zoningClassification", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ProjectProfile.prototype, "plannedStartDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ProjectProfile.prototype, "plannedEndDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ProjectProfile.prototype, "actualStartDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ProjectProfile.prototype, "actualEndDate", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => work_calendar_entity_1.WorkCalendar, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'calendar_id' }),
    __metadata("design:type", work_calendar_entity_1.WorkCalendar)
], ProjectProfile.prototype, "calendar", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'calendar_id', nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "calendarId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "shiftPattern", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "milestoneStrategy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "estimatedProjectCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "approvedBudget", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "fundingType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "revenueModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "taxStructure", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ProjectProfile.prototype, "escalationClause", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "constructionTechnology", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "structuralSystem", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "numberOfBuildings", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "typicalFloorCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "totalBuiltupArea", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "unitMix", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ProjectProfile.prototype, "heightRestriction", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "seismicZone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "lifecycleStage", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ProjectProfile.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "lastUpdatedBy", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ProjectProfile.prototype, "lastUpdatedOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ProjectProfile.prototype, "changeReason", void 0);
exports.ProjectProfile = ProjectProfile = __decorate([
    (0, typeorm_1.Entity)()
], ProjectProfile);
//# sourceMappingURL=project-profile.entity.js.map