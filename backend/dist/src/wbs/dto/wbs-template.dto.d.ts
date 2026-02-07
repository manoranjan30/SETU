export declare class CreateWbsTemplateDto {
    templateName: string;
    description?: string;
    projectType?: string;
}
export declare class ApplyTemplateDto {
    templateId: number;
}
export declare class CreateWbsTemplateNodeDto {
    templateId: number;
    parentId?: number;
    wbsName: string;
    wbsCode: string;
    isControlAccount?: boolean;
}
export declare class UpdateWbsTemplateNodeDto {
    wbsName?: string;
    wbsCode?: string;
    isControlAccount?: boolean;
}
