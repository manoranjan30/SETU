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
exports.EhsObservation = exports.ObservationStatus = exports.SeverityLevel = exports.ObservationType = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const user_entity_1 = require("../../users/user.entity");
var ObservationType;
(function (ObservationType) {
    ObservationType["UNSAFE_ACT"] = "UNSAFE_ACT";
    ObservationType["UNSAFE_CONDITION"] = "UNSAFE_CONDITION";
    ObservationType["GOOD_PRACTICE"] = "GOOD_PRACTICE";
})(ObservationType || (exports.ObservationType = ObservationType = {}));
var SeverityLevel;
(function (SeverityLevel) {
    SeverityLevel["CRITICAL"] = "CRITICAL";
    SeverityLevel["SERIOUS"] = "SERIOUS";
    SeverityLevel["MINOR"] = "MINOR";
    SeverityLevel["NEGLIGIBLE"] = "NEGLIGIBLE";
})(SeverityLevel || (exports.SeverityLevel = SeverityLevel = {}));
var ObservationStatus;
(function (ObservationStatus) {
    ObservationStatus["OPEN"] = "OPEN";
    ObservationStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ObservationStatus["PENDING_VERIFICATION"] = "PENDING_VERIFICATION";
    ObservationStatus["CLOSED"] = "CLOSED";
    ObservationStatus["ESCALATED"] = "ESCALATED";
})(ObservationStatus || (exports.ObservationStatus = ObservationStatus = {}));
let EhsObservation = class EhsObservation {
    id;
    projectId;
    project;
    date;
    category;
    observationType;
    severity;
    location;
    description;
    photoUrl;
    reportedById;
    reportedBy;
    assignedToId;
    assignedTo;
    targetDate;
    correctiveAction;
    status;
    closedDate;
    closedById;
    closedBy;
    createdAt;
    updatedAt;
};
exports.EhsObservation = EhsObservation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EhsObservation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsObservation.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode),
    (0, typeorm_1.JoinColumn)({ name: 'projectId' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], EhsObservation.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], EhsObservation.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsObservation.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ObservationType,
        default: ObservationType.UNSAFE_CONDITION,
    }),
    __metadata("design:type", String)
], EhsObservation.prototype, "observationType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: SeverityLevel,
        default: SeverityLevel.MINOR,
    }),
    __metadata("design:type", String)
], EhsObservation.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EhsObservation.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], EhsObservation.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EhsObservation.prototype, "photoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsObservation.prototype, "reportedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'reportedById' }),
    __metadata("design:type", user_entity_1.User)
], EhsObservation.prototype, "reportedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], EhsObservation.prototype, "assignedToId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'assignedToId' }),
    __metadata("design:type", user_entity_1.User)
], EhsObservation.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], EhsObservation.prototype, "targetDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsObservation.prototype, "correctiveAction", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ObservationStatus,
        default: ObservationStatus.OPEN,
    }),
    __metadata("design:type", String)
], EhsObservation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], EhsObservation.prototype, "closedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], EhsObservation.prototype, "closedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'closedById' }),
    __metadata("design:type", user_entity_1.User)
], EhsObservation.prototype, "closedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EhsObservation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EhsObservation.prototype, "updatedAt", void 0);
exports.EhsObservation = EhsObservation = __decorate([
    (0, typeorm_1.Entity)('ehs_observations')
], EhsObservation);
//# sourceMappingURL=ehs-observation.entity.js.map