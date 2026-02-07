"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const design_controller_1 = require("./design.controller");
const design_service_1 = require("./design.service");
const drawing_category_entity_1 = require("./entities/drawing-category.entity");
const drawing_register_entity_1 = require("./entities/drawing-register.entity");
const drawing_revision_entity_1 = require("./entities/drawing-revision.entity");
const user_entity_1 = require("../users/user.entity");
let DesignModule = class DesignModule {
};
exports.DesignModule = DesignModule;
exports.DesignModule = DesignModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                drawing_category_entity_1.DrawingCategory,
                drawing_register_entity_1.DrawingRegister,
                drawing_revision_entity_1.DrawingRevision,
                user_entity_1.User
            ])
        ],
        controllers: [design_controller_1.DesignController],
        providers: [design_service_1.DesignService],
        exports: [design_service_1.DesignService]
    })
], DesignModule);
//# sourceMappingURL=design.module.js.map