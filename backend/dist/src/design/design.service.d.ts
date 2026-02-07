import { Repository } from 'typeorm';
import { DrawingCategory } from './entities/drawing-category.entity';
import { DrawingRegister } from './entities/drawing-register.entity';
import { DrawingRevision } from './entities/drawing-revision.entity';
export declare class DesignService {
    private categoryRepo;
    private registerRepo;
    private revisionRepo;
    constructor(categoryRepo: Repository<DrawingCategory>, registerRepo: Repository<DrawingRegister>, revisionRepo: Repository<DrawingRevision>);
    findAllCategories(): Promise<DrawingCategory[]>;
    createCategory(name: string, code: string, parentId?: number): Promise<DrawingCategory>;
    getRegister(projectId: number, categoryId?: number): Promise<DrawingRegister[]>;
    createRegisterItem(data: Partial<DrawingRegister>): Promise<DrawingRegister>;
    createRevision(registerId: number, userId: number, fileData: {
        path: string;
        filename: string;
        size: number;
        mimetype: string;
    }, revisionNumber: string): Promise<DrawingRevision>;
}
