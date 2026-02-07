import { EpsNodeType } from '../eps.entity';
export declare class CreateEpsNodeDto {
    name: string;
    type: EpsNodeType;
    parentId?: number;
    order?: number;
}
