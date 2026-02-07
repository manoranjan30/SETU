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
exports.ActivityRelationship = exports.RelationshipType = void 0;
const typeorm_1 = require("typeorm");
const activity_entity_1 = require("./activity.entity");
var RelationshipType;
(function (RelationshipType) {
    RelationshipType["FS"] = "FS";
    RelationshipType["SS"] = "SS";
    RelationshipType["FF"] = "FF";
    RelationshipType["SF"] = "SF";
})(RelationshipType || (exports.RelationshipType = RelationshipType = {}));
let ActivityRelationship = class ActivityRelationship {
    id;
    projectId;
    predecessor;
    successor;
    relationshipType;
    lagDays;
};
exports.ActivityRelationship = ActivityRelationship;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ActivityRelationship.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ActivityRelationship.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'predecessor_activity_id' }),
    __metadata("design:type", activity_entity_1.Activity)
], ActivityRelationship.prototype, "predecessor", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'successor_activity_id' }),
    __metadata("design:type", activity_entity_1.Activity)
], ActivityRelationship.prototype, "successor", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: RelationshipType,
        default: RelationshipType.FS,
    }),
    __metadata("design:type", String)
], ActivityRelationship.prototype, "relationshipType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ActivityRelationship.prototype, "lagDays", void 0);
exports.ActivityRelationship = ActivityRelationship = __decorate([
    (0, typeorm_1.Entity)()
], ActivityRelationship);
//# sourceMappingURL=activity-relationship.entity.js.map