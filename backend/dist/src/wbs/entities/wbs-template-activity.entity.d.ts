import { WbsTemplateNode } from './wbs-template.entity';
export declare enum TemplateActivityType {
    TASK = "TASK",
    MILESTONE_START = "MILESTONE_START",
    MILESTONE_FINISH = "MILESTONE_FINISH",
    LEVEL_OF_EFFORT = "LEVEL_OF_EFFORT"
}
export declare class WbsTemplateActivity {
    id: number;
    templateNodeId: number;
    templateNode: WbsTemplateNode;
    activityCode: string;
    activityName: string;
    activityType: TemplateActivityType;
    durationPlanned: number;
    isMilestone: boolean;
}
