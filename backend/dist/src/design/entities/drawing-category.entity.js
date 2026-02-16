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
exports.DrawingCategory = void 0;
const typeorm_1 = require("typeorm");
let DrawingCategory = class DrawingCategory {
    id;
    name;
    code;
    isActive;
    parent;
    children;
};
exports.DrawingCategory = DrawingCategory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], DrawingCategory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DrawingCategory.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], DrawingCategory.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], DrawingCategory.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DrawingCategory, (category) => category.children, {
        nullable: true,
    }),
    __metadata("design:type", DrawingCategory)
], DrawingCategory.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DrawingCategory, (category) => category.parent),
    __metadata("design:type", Array)
], DrawingCategory.prototype, "children", void 0);
exports.DrawingCategory = DrawingCategory = __decorate([
    (0, typeorm_1.Entity)()
], DrawingCategory);
//# sourceMappingURL=drawing-category.entity.js.map