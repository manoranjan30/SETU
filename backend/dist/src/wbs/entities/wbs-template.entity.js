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
exports.WbsTemplateNode = exports.WbsTemplate = void 0;
const typeorm_1 = require("typeorm");
const wbs_template_activity_entity_1 = require("./wbs-template-activity.entity");
let WbsTemplate = class WbsTemplate {
    id;
    templateName;
    description;
    projectType;
    constructionTech;
    isActive;
    nodes;
    createdOn;
};
exports.WbsTemplate = WbsTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WbsTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], WbsTemplate.prototype, "templateName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WbsTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WbsTemplate.prototype, "projectType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WbsTemplate.prototype, "constructionTech", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], WbsTemplate.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => WbsTemplateNode, (node) => node.template),
    __metadata("design:type", Array)
], WbsTemplate.prototype, "nodes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WbsTemplate.prototype, "createdOn", void 0);
exports.WbsTemplate = WbsTemplate = __decorate([
    (0, typeorm_1.Entity)()
], WbsTemplate);
let WbsTemplateNode = class WbsTemplateNode {
    id;
    templateId;
    template;
    parentId;
    parent;
    children;
    wbsCode;
    wbsName;
    isControlAccount;
    activities;
};
exports.WbsTemplateNode = WbsTemplateNode;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WbsTemplateNode.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WbsTemplateNode.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => WbsTemplate, (template) => template.nodes, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'template_id' }),
    __metadata("design:type", WbsTemplate)
], WbsTemplateNode.prototype, "template", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], WbsTemplateNode.prototype, "parentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => WbsTemplateNode, (node) => node.children, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'parent_id' }),
    __metadata("design:type", WbsTemplateNode)
], WbsTemplateNode.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => WbsTemplateNode, (node) => node.parent),
    __metadata("design:type", Array)
], WbsTemplateNode.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WbsTemplateNode.prototype, "wbsCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WbsTemplateNode.prototype, "wbsName", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], WbsTemplateNode.prototype, "isControlAccount", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => wbs_template_activity_entity_1.WbsTemplateActivity, (activity) => activity.templateNode),
    __metadata("design:type", Array)
], WbsTemplateNode.prototype, "activities", void 0);
exports.WbsTemplateNode = WbsTemplateNode = __decorate([
    (0, typeorm_1.Entity)()
], WbsTemplateNode);
//# sourceMappingURL=wbs-template.entity.js.map