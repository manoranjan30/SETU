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
exports.UpdateProgressDto = exports.ExecutionStatus = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["NOT_STARTED"] = "NOT_STARTED";
    ExecutionStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ExecutionStatus["COMPLETED"] = "COMPLETED";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
class UpdateProgressDto {
    actualQuantity;
    date;
    status;
}
exports.UpdateProgressDto = UpdateProgressDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cumulative Actual Quantity achieved so far' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateProgressDto.prototype, "actualQuantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Date of this progress update' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateProgressDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Status of the work',
        enum: ExecutionStatus,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ExecutionStatus),
    __metadata("design:type", String)
], UpdateProgressDto.prototype, "status", void 0);
//# sourceMappingURL=update-progress.dto.js.map