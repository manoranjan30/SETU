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
exports.DrawingRegister = exports.DrawingStatus = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const drawing_category_entity_1 = require("./drawing-category.entity");
const drawing_revision_entity_1 = require("./drawing-revision.entity");
var DrawingStatus;
(function (DrawingStatus) {
    DrawingStatus["PLANNED"] = "PLANNED";
    DrawingStatus["IN_PROGRESS"] = "IN_PROGRESS";
    DrawingStatus["GFC"] = "GFC";
    DrawingStatus["OBSOLETE"] = "OBSOLETE";
    DrawingStatus["HOLD"] = "HOLD";
})(DrawingStatus || (exports.DrawingStatus = DrawingStatus = {}));
let DrawingRegister = class DrawingRegister {
    id;
    projectId;
    project;
    categoryId;
    category;
    drawingNumber;
    title;
    status;
    currentRevisionId;
    currentRevision;
    revisions;
    createdAt;
    updatedAt;
};
exports.DrawingRegister = DrawingRegister;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DrawingRegister.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DrawingRegister.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode),
    (0, typeorm_1.JoinColumn)({ name: 'projectId' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], DrawingRegister.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DrawingRegister.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => drawing_category_entity_1.DrawingCategory),
    (0, typeorm_1.JoinColumn)({ name: 'categoryId' }),
    __metadata("design:type", drawing_category_entity_1.DrawingCategory)
], DrawingRegister.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DrawingRegister.prototype, "drawingNumber", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DrawingRegister.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: DrawingStatus,
        default: DrawingStatus.PLANNED
    }),
    __metadata("design:type", String)
], DrawingRegister.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], DrawingRegister.prototype, "currentRevisionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => drawing_revision_entity_1.DrawingRevision, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'currentRevisionId' }),
    __metadata("design:type", drawing_revision_entity_1.DrawingRevision)
], DrawingRegister.prototype, "currentRevision", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => drawing_revision_entity_1.DrawingRevision, (revision) => revision.register),
    __metadata("design:type", Array)
], DrawingRegister.prototype, "revisions", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DrawingRegister.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DrawingRegister.prototype, "updatedAt", void 0);
exports.DrawingRegister = DrawingRegister = __decorate([
    (0, typeorm_1.Entity)()
], DrawingRegister);
//# sourceMappingURL=drawing-register.entity.js.map