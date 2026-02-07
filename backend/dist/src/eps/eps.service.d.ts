import { Repository } from 'typeorm';
import { EpsNode } from './eps.entity';
import { CreateEpsNodeDto } from './dto/create-eps-node.dto';
import { UpdateEpsNodeDto } from './dto/update-eps-node.dto';
import { ProjectProfile } from './project-profile.entity';
import { UpdateProjectProfileDto } from './dto/update-project-profile.dto';
import { PermissionResolutionService } from '../projects/permission-resolution.service';
export declare class EpsService {
    private epsRepository;
    private profileRepository;
    private permissionService;
    constructor(epsRepository: Repository<EpsNode>, profileRepository: Repository<ProjectProfile>, permissionService: PermissionResolutionService);
    updateProfile(nodeId: number, updateProfileDto: UpdateProjectProfileDto, user: any): Promise<ProjectProfile>;
    getProfile(nodeId: number): Promise<ProjectProfile | null>;
    private ensureNodeAccess;
    private getAllowedChildType;
    importCsv(fileBuffer: Buffer, user: any): Promise<any>;
    private processCsvData;
    private findOrCreateNode;
    create(createDto: CreateEpsNodeDto, user: any): Promise<EpsNode>;
    findAll(user?: any): Promise<EpsNode[]>;
    getProjectTree(projectId: number): Promise<any[]>;
    private buildTree;
    private findChildrenRecursive;
    private sanitize;
    findOne(id: number): Promise<EpsNode | null>;
    update(id: number, updateDto: UpdateEpsNodeDto, user: any): Promise<EpsNode | null>;
    remove(id: number, user: any): Promise<void>;
}
