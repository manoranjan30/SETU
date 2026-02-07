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
exports.UserRoleNodeAssignment = exports.AccessType = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const role_entity_1 = require("../roles/role.entity");
const eps_entity_1 = require("./eps.entity");
var AccessType;
(function (AccessType) {
    AccessType["ALLOW"] = "ALLOW";
    AccessType["DENY"] = "DENY";
})(AccessType || (exports.AccessType = AccessType = {}));
let UserRoleNodeAssignment = class UserRoleNodeAssignment {
    id;
    user;
    role;
    epsNode;
    appliesToSubtree;
    accessType;
    createdOn;
};
exports.UserRoleNodeAssignment = UserRoleNodeAssignment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], UserRoleNodeAssignment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserRoleNodeAssignment.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => role_entity_1.Role, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'role_id' }),
    __metadata("design:type", role_entity_1.Role)
], UserRoleNodeAssignment.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode, { eager: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'eps_node_id' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], UserRoleNodeAssignment.prototype, "epsNode", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], UserRoleNodeAssignment.prototype, "appliesToSubtree", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: AccessType, default: AccessType.ALLOW }),
    __metadata("design:type", String)
], UserRoleNodeAssignment.prototype, "accessType", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserRoleNodeAssignment.prototype, "createdOn", void 0);
exports.UserRoleNodeAssignment = UserRoleNodeAssignment = __decorate([
    (0, typeorm_1.Entity)()
], UserRoleNodeAssignment);
//# sourceMappingURL=user-role-node-assignment.entity.js.map