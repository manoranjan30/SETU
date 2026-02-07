import { WbsTemplateActivity } from './wbs-template-activity.entity';
export declare class WbsTemplate {
    id: number;
    templateName: string;
    description: string;
    projectType: string;
    constructionTech: string;
    isActive: boolean;
    nodes: WbsTemplateNode[];
    createdOn: Date;
}
export declare class WbsTemplateNode {
    id: number;
    templateId: number;
    template: WbsTemplate;
    parentId: number;
    parent: WbsTemplateNode;
    children: WbsTemplateNode[];
    wbsCode: string;
    wbsName: string;
    isControlAccount: boolean;
    activities: WbsTemplateActivity[];
}
