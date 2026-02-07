import { DesignService } from './design.service';
import { User } from '../users/user.entity';
export declare class DesignController {
    private readonly designService;
    constructor(designService: DesignService);
    getCategories(): Promise<import("./entities/drawing-category.entity").DrawingCategory[]>;
    createCategory(body: {
        name: string;
        code: string;
        parentId?: number;
    }): Promise<import("./entities/drawing-category.entity").DrawingCategory>;
    getRegister(projectId: number, categoryId?: number): Promise<import("./entities/drawing-register.entity").DrawingRegister[]>;
    createRegisterItem(projectId: number, body: {
        categoryId: number;
        drawingNumber: string;
        title: string;
    }): Promise<import("./entities/drawing-register.entity").DrawingRegister>;
    uploadRevision(projectId: number, registerId: number, revisionNumber: string, file: Express.Multer.File, user: User): Promise<import("./entities/drawing-revision.entity").DrawingRevision>;
}
