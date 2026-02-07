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
exports.EhsIncident = exports.IncidentStatus = exports.InvestigationStatus = exports.IncidentType = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const user_entity_1 = require("../../users/user.entity");
var IncidentType;
(function (IncidentType) {
    IncidentType["NEAR_MISS"] = "NEAR_MISS";
    IncidentType["FAC"] = "FAC";
    IncidentType["MTC"] = "MTC";
    IncidentType["LTI"] = "LTI";
    IncidentType["PROPERTY_DAMAGE"] = "PROPERTY_DAMAGE";
    IncidentType["ENVIRONMENTAL"] = "ENVIRONMENTAL";
})(IncidentType || (exports.IncidentType = IncidentType = {}));
var InvestigationStatus;
(function (InvestigationStatus) {
    InvestigationStatus["PENDING"] = "PENDING";
    InvestigationStatus["IN_PROGRESS"] = "IN_PROGRESS";
    InvestigationStatus["COMPLETE"] = "COMPLETE";
})(InvestigationStatus || (exports.InvestigationStatus = InvestigationStatus = {}));
var IncidentStatus;
(function (IncidentStatus) {
    IncidentStatus["REPORTED"] = "REPORTED";
    IncidentStatus["INVESTIGATING"] = "INVESTIGATING";
    IncidentStatus["CLOSED"] = "CLOSED";
})(IncidentStatus || (exports.IncidentStatus = IncidentStatus = {}));
let EhsIncident = class EhsIncident {
    id;
    projectId;
    project;
    incidentDate;
    incidentType;
    location;
    description;
    affectedPersons;
    bodyPartAffected;
    immediateCause;
    rootCause;
    witnesses;
    photoUrls;
    firstAidGiven;
    hospitalVisit;
    daysLost;
    investigationStatus;
    investigatedById;
    investigatedBy;
    investigationDate;
    correctiveActions;
    preventiveActions;
    status;
    reportedById;
    reportedBy;
    createdAt;
    updatedAt;
};
exports.EhsIncident = EhsIncident;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EhsIncident.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsIncident.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode),
    (0, typeorm_1.JoinColumn)({ name: 'projectId' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], EhsIncident.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], EhsIncident.prototype, "incidentDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: IncidentType,
    }),
    __metadata("design:type", String)
], EhsIncident.prototype, "incidentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EhsIncident.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EhsIncident.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], EhsIncident.prototype, "affectedPersons", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EhsIncident.prototype, "bodyPartAffected", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EhsIncident.prototype, "immediateCause", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsIncident.prototype, "rootCause", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], EhsIncident.prototype, "witnesses", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], EhsIncident.prototype, "photoUrls", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EhsIncident.prototype, "firstAidGiven", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EhsIncident.prototype, "hospitalVisit", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], EhsIncident.prototype, "daysLost", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: InvestigationStatus,
        default: InvestigationStatus.PENDING,
    }),
    __metadata("design:type", String)
], EhsIncident.prototype, "investigationStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], EhsIncident.prototype, "investigatedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'investigatedById' }),
    __metadata("design:type", user_entity_1.User)
], EhsIncident.prototype, "investigatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], EhsIncident.prototype, "investigationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsIncident.prototype, "correctiveActions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsIncident.prototype, "preventiveActions", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: IncidentStatus,
        default: IncidentStatus.REPORTED,
    }),
    __metadata("design:type", String)
], EhsIncident.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsIncident.prototype, "reportedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'reportedById' }),
    __metadata("design:type", user_entity_1.User)
], EhsIncident.prototype, "reportedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EhsIncident.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EhsIncident.prototype, "updatedAt", void 0);
exports.EhsIncident = EhsIncident = __decorate([
    (0, typeorm_1.Entity)('ehs_incidents')
], EhsIncident);
//# sourceMappingURL=ehs-incident.entity.js.map