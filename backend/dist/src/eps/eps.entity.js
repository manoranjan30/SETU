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
exports.EpsNode = exports.EpsNodeType = void 0;
const typeorm_1 = require("typeorm");
const project_profile_entity_1 = require("./project-profile.entity");
var EpsNodeType;
(function (EpsNodeType) {
    EpsNodeType["COMPANY"] = "COMPANY";
    EpsNodeType["PROJECT"] = "PROJECT";
    EpsNodeType["BLOCK"] = "BLOCK";
    EpsNodeType["TOWER"] = "TOWER";
    EpsNodeType["FLOOR"] = "FLOOR";
    EpsNodeType["UNIT"] = "UNIT";
    EpsNodeType["ROOM"] = "ROOM";
})(EpsNodeType || (exports.EpsNodeType = EpsNodeType = {}));
let EpsNode = class EpsNode {
    id;
    name;
    type;
    parentId;
    parent;
    children;
    order;
    createdBy;
    updatedBy;
    projectProfile;
    createdAt;
    updatedAt;
};
exports.EpsNode = EpsNode;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EpsNode.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EpsNode.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: EpsNodeType,
    }),
    __metadata("design:type", String)
], EpsNode.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], EpsNode.prototype, "parentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => EpsNode, (node) => node.children, { onDelete: 'RESTRICT' }),
    (0, typeorm_1.JoinColumn)({ name: 'parentId' }),
    __metadata("design:type", EpsNode)
], EpsNode.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => EpsNode, (node) => node.parent),
    __metadata("design:type", Array)
], EpsNode.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], EpsNode.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'system' }),
    __metadata("design:type", String)
], EpsNode.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'system' }),
    __metadata("design:type", String)
], EpsNode.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => project_profile_entity_1.ProjectProfile, (profile) => profile.epsNode, {
        cascade: true,
    }),
    __metadata("design:type", project_profile_entity_1.ProjectProfile)
], EpsNode.prototype, "projectProfile", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EpsNode.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EpsNode.prototype, "updatedAt", void 0);
exports.EpsNode = EpsNode = __decorate([
    (0, typeorm_1.Entity)()
], EpsNode);
//# sourceMappingURL=eps.entity.js.map