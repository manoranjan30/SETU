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
exports.DrawingRevision = exports.RevisionStatus = void 0;
const typeorm_1 = require("typeorm");
const drawing_register_entity_1 = require("./drawing-register.entity");
const user_entity_1 = require("../../users/user.entity");
var RevisionStatus;
(function (RevisionStatus) {
    RevisionStatus["DRAFT"] = "DRAFT";
    RevisionStatus["SUBMITTED"] = "SUBMITTED";
    RevisionStatus["APPROVED"] = "APPROVED";
    RevisionStatus["REJECTED"] = "REJECTED";
})(RevisionStatus || (exports.RevisionStatus = RevisionStatus = {}));
let DrawingRevision = class DrawingRevision {
    id;
    registerId;
    register;
    revisionNumber;
    filePath;
    originalFileName;
    fileSize;
    fileType;
    status;
    comments;
    uploadedById;
    uploadedBy;
    uploadedAt;
};
exports.DrawingRevision = DrawingRevision;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DrawingRevision.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DrawingRevision.prototype, "registerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => drawing_register_entity_1.DrawingRegister, (register) => register.revisions),
    (0, typeorm_1.JoinColumn)({ name: 'registerId' }),
    __metadata("design:type", drawing_register_entity_1.DrawingRegister)
], DrawingRevision.prototype, "register", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DrawingRevision.prototype, "revisionNumber", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DrawingRevision.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DrawingRevision.prototype, "originalFileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], DrawingRevision.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DrawingRevision.prototype, "fileType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: RevisionStatus,
        default: RevisionStatus.DRAFT
    }),
    __metadata("design:type", String)
], DrawingRevision.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DrawingRevision.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], DrawingRevision.prototype, "uploadedById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'uploadedById' }),
    __metadata("design:type", user_entity_1.User)
], DrawingRevision.prototype, "uploadedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DrawingRevision.prototype, "uploadedAt", void 0);
exports.DrawingRevision = DrawingRevision = __decorate([
    (0, typeorm_1.Entity)()
], DrawingRevision);
//# sourceMappingURL=drawing-revision.entity.js.map