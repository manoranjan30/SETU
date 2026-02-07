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
exports.WbsTemplateActivity = exports.TemplateActivityType = void 0;
const typeorm_1 = require("typeorm");
const wbs_template_entity_1 = require("./wbs-template.entity");
var TemplateActivityType;
(function (TemplateActivityType) {
    TemplateActivityType["TASK"] = "TASK";
    TemplateActivityType["MILESTONE_START"] = "MILESTONE_START";
    TemplateActivityType["MILESTONE_FINISH"] = "MILESTONE_FINISH";
    TemplateActivityType["LEVEL_OF_EFFORT"] = "LEVEL_OF_EFFORT";
})(TemplateActivityType || (exports.TemplateActivityType = TemplateActivityType = {}));
let WbsTemplateActivity = class WbsTemplateActivity {
    id;
    templateNodeId;
    templateNode;
    activityCode;
    activityName;
    activityType;
    durationPlanned;
    isMilestone;
};
exports.WbsTemplateActivity = WbsTemplateActivity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WbsTemplateActivity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WbsTemplateActivity.prototype, "templateNodeId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => wbs_template_entity_1.WbsTemplateNode, (node) => node.activities, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'template_node_id' }),
    __metadata("design:type", wbs_template_entity_1.WbsTemplateNode)
], WbsTemplateActivity.prototype, "templateNode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WbsTemplateActivity.prototype, "activityCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WbsTemplateActivity.prototype, "activityName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TemplateActivityType,
        default: TemplateActivityType.TASK,
    }),
    __metadata("design:type", String)
], WbsTemplateActivity.prototype, "activityType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WbsTemplateActivity.prototype, "durationPlanned", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], WbsTemplateActivity.prototype, "isMilestone", void 0);
exports.WbsTemplateActivity = WbsTemplateActivity = __decorate([
    (0, typeorm_1.Entity)()
], WbsTemplateActivity);
//# sourceMappingURL=wbs-template-activity.entity.js.map