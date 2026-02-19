import { EpsService } from './eps.service';
import { CreateEpsNodeDto } from './dto/create-eps-node.dto';
import { UpdateEpsNodeDto } from './dto/update-eps-node.dto';
import { UpdateProjectProfileDto } from './dto/update-project-profile.dto';
export declare class EpsController {
    private readonly epsService;
    constructor(epsService: EpsService);
    getProfile(id: number): Promise<import("./project-profile.entity").ProjectProfile | null>;
    updateProfile(id: number, updateProfileDto: UpdateProjectProfileDto, req: any): Promise<import("./project-profile.entity").ProjectProfile>;
    uploadFile(file: Express.Multer.File, req: any): Promise<any>;
    create(createEpsDto: CreateEpsNodeDto, req: any): Promise<import("./eps.entity").EpsNode>;
    getProjectTree(id: number): Promise<any[]>;
    findAll(req: any): Promise<import("./eps.entity").EpsNode[] | {
        id: number;
        name: string;
        type: string;
        parentId: null;
        order: number;
    }[]>;
    findOne(id: number): Promise<import("./eps.entity").EpsNode | null>;
    update(id: number, updateEpsDto: UpdateEpsNodeDto, req: any): Promise<import("./eps.entity").EpsNode | null>;
    remove(id: number, req: any): Promise<void>;
}
