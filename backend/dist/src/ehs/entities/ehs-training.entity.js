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
exports.EhsTraining = exports.TrainingType = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const user_entity_1 = require("../../users/user.entity");
var TrainingType;
(function (TrainingType) {
    TrainingType["INDUCTION"] = "INDUCTION";
    TrainingType["TBT"] = "TBT";
    TrainingType["SPECIALIZED"] = "SPECIALIZED";
    TrainingType["FIRE_DRILL"] = "FIRE_DRILL";
    TrainingType["FIRST_AID"] = "FIRST_AID";
})(TrainingType || (exports.TrainingType = TrainingType = {}));
let EhsTraining = class EhsTraining {
    id;
    projectId;
    project;
    trainingType;
    status;
    date;
    topic;
    trainer;
    attendeeCount;
    attendeeNames;
    duration;
    remarks;
    createdById;
    createdBy;
    createdAt;
};
exports.EhsTraining = EhsTraining;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EhsTraining.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsTraining.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode),
    (0, typeorm_1.JoinColumn)({ name: 'projectId' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], EhsTraining.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TrainingType,
    }),
    __metadata("design:type", String)
], EhsTraining.prototype, "trainingType", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Completed' }),
    __metadata("design:type", String)
], EhsTraining.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], EhsTraining.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsTraining.prototype, "topic", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsTraining.prototype, "trainer", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], EhsTraining.prototype, "attendeeCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], EhsTraining.prototype, "attendeeNames", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], EhsTraining.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsTraining.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsTraining.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'createdById' }),
    __metadata("design:type", user_entity_1.User)
], EhsTraining.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EhsTraining.prototype, "createdAt", void 0);
exports.EhsTraining = EhsTraining = __decorate([
    (0, typeorm_1.Entity)('ehs_training_logs')
], EhsTraining);
//# sourceMappingURL=ehs-training.entity.js.map