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
exports.Permission = exports.PermissionScope = exports.PermissionAction = void 0;
const typeorm_1 = require("typeorm");
var PermissionAction;
(function (PermissionAction) {
    PermissionAction["CREATE"] = "CREATE";
    PermissionAction["READ"] = "READ";
    PermissionAction["UPDATE"] = "UPDATE";
    PermissionAction["DELETE"] = "DELETE";
    PermissionAction["SPECIAL"] = "SPECIAL";
})(PermissionAction || (exports.PermissionAction = PermissionAction = {}));
var PermissionScope;
(function (PermissionScope) {
    PermissionScope["SYSTEM"] = "SYSTEM";
    PermissionScope["COMPANY"] = "COMPANY";
    PermissionScope["PROJECT"] = "PROJECT";
    PermissionScope["NODE"] = "NODE";
})(PermissionScope || (exports.PermissionScope = PermissionScope = {}));
let Permission = class Permission {
    id;
    permissionCode;
    permissionName;
    moduleName;
    entityName;
    actionType;
    scopeLevel;
    description;
    isSystem;
    isActive;
    createdOn;
    updatedOn;
};
exports.Permission = Permission;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Permission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], Permission.prototype, "permissionCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Permission.prototype, "permissionName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Permission.prototype, "moduleName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Permission.prototype, "entityName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PermissionAction,
        default: PermissionAction.READ,
    }),
    __metadata("design:type", String)
], Permission.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PermissionScope,
        default: PermissionScope.SYSTEM,
    }),
    __metadata("design:type", String)
], Permission.prototype, "scopeLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Permission.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Permission.prototype, "isSystem", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Permission.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Permission.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Permission.prototype, "updatedOn", void 0);
exports.Permission = Permission = __decorate([
    (0, typeorm_1.Entity)()
], Permission);
//# sourceMappingURL=permission.entity.js.map