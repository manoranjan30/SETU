import { WbsService } from './wbs.service';
import { CreateWbsTemplateDto } from './dto/wbs-template.dto';
export declare class WbsTemplateController {
    private readonly wbsService;
    constructor(wbsService: WbsService);
    createTemplate(dto: CreateWbsTemplateDto): Promise<import("./entities/wbs-template.entity").WbsTemplate>;
    getTemplates(): Promise<import("./entities/wbs-template.entity").WbsTemplate[]>;
    getTemplateNodes(templateId: string): Promise<import("./entities/wbs-template.entity").WbsTemplateNode[]>;
    createTemplateNode(dto: any): Promise<import("./entities/wbs-template.entity").WbsTemplateNode>;
    deleteTemplateNode(nodeId: string): Promise<void>;
    deleteTemplate(templateId: string): Promise<void>;
}
