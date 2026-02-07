import { OnModuleInit } from '@nestjs/common';
import { PermissionsService } from '../permissions/permissions.service';
export declare class EpsModule implements OnModuleInit {
    private permissionsService;
    constructor(permissionsService: PermissionsService);
    onModuleInit(): Promise<void>;
}
