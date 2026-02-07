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
exports.CreateExecutionContextDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateExecutionContextDto {
    projectId;
    epsNodeId;
    boqElementId;
    activityId;
    plannedQuantity;
}
exports.CreateExecutionContextDto = CreateExecutionContextDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the Project' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateExecutionContextDto.prototype, "projectId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the EPS Node (Specific Location)' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateExecutionContextDto.prototype, "epsNodeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the BOQ Element (Scope)' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateExecutionContextDto.prototype, "boqElementId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the Activity (Schedule)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateExecutionContextDto.prototype, "activityId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Quantity allocated for this context' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateExecutionContextDto.prototype, "plannedQuantity", void 0);
//# sourceMappingURL=create-execution-context.dto.js.map