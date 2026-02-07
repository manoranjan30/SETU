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
exports.CreateBoqElementDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateBoqElementDto {
    projectId;
    epsNodeId;
    boqCode;
    boqName;
    unitOfMeasure;
    totalQuantity;
    geometryRefId;
}
exports.CreateBoqElementDto = CreateBoqElementDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the Project' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateBoqElementDto.prototype, "projectId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the EPS Node (Location)' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateBoqElementDto.prototype, "epsNodeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unique BOQ Code' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBoqElementDto.prototype, "boqCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Descriptive Name of the BOQ Item' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBoqElementDto.prototype, "boqName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unit of Measure (e.g., m3, sqft)' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBoqElementDto.prototype, "unitOfMeasure", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total Budgeted Quantity' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateBoqElementDto.prototype, "totalQuantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Reference ID for BIM/Geometry' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBoqElementDto.prototype, "geometryRefId", void 0);
//# sourceMappingURL=create-boq-element.dto.js.map