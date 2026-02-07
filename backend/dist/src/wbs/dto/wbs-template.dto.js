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
exports.UpdateWbsTemplateNodeDto = exports.CreateWbsTemplateNodeDto = exports.ApplyTemplateDto = exports.CreateWbsTemplateDto = void 0;
const class_validator_1 = require("class-validator");
class CreateWbsTemplateDto {
    templateName;
    description;
    projectType;
}
exports.CreateWbsTemplateDto = CreateWbsTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWbsTemplateDto.prototype, "templateName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWbsTemplateDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWbsTemplateDto.prototype, "projectType", void 0);
class ApplyTemplateDto {
    templateId;
}
exports.ApplyTemplateDto = ApplyTemplateDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], ApplyTemplateDto.prototype, "templateId", void 0);
class CreateWbsTemplateNodeDto {
    templateId;
    parentId;
    wbsName;
    wbsCode;
    isControlAccount;
}
exports.CreateWbsTemplateNodeDto = CreateWbsTemplateNodeDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateWbsTemplateNodeDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateWbsTemplateNodeDto.prototype, "parentId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWbsTemplateNodeDto.prototype, "wbsName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWbsTemplateNodeDto.prototype, "wbsCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateWbsTemplateNodeDto.prototype, "isControlAccount", void 0);
class UpdateWbsTemplateNodeDto {
    wbsName;
    wbsCode;
    isControlAccount;
}
exports.UpdateWbsTemplateNodeDto = UpdateWbsTemplateNodeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateWbsTemplateNodeDto.prototype, "wbsName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateWbsTemplateNodeDto.prototype, "wbsCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateWbsTemplateNodeDto.prototype, "isControlAccount", void 0);
//# sourceMappingURL=wbs-template.dto.js.map