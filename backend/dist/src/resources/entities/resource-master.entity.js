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
exports.ResourceMaster = exports.ResourceType = void 0;
const typeorm_1 = require("typeorm");
var ResourceType;
(function (ResourceType) {
    ResourceType["MATERIAL"] = "MATERIAL";
    ResourceType["LABOR"] = "LABOR";
    ResourceType["PLANT"] = "PLANT";
    ResourceType["SUBCONTRACT"] = "SUBCONTRACT";
    ResourceType["OTHER"] = "OTHER";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
let ResourceMaster = class ResourceMaster {
    id;
    resourceCode;
    resourceName;
    uom;
    resourceType;
    standardRate;
    category;
    specification;
    currency;
    createdOn;
    updatedOn;
};
exports.ResourceMaster = ResourceMaster;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ResourceMaster.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], ResourceMaster.prototype, "resourceCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResourceMaster.prototype, "resourceName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ResourceMaster.prototype, "uom", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ResourceType,
        default: ResourceType.MATERIAL,
    }),
    __metadata("design:type", String)
], ResourceMaster.prototype, "resourceType", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ResourceMaster.prototype, "standardRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ResourceMaster.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], ResourceMaster.prototype, "specification", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: 'INR' }),
    __metadata("design:type", String)
], ResourceMaster.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ResourceMaster.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ResourceMaster.prototype, "updatedOn", void 0);
exports.ResourceMaster = ResourceMaster = __decorate([
    (0, typeorm_1.Entity)()
], ResourceMaster);
//# sourceMappingURL=resource-master.entity.js.map