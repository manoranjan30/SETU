import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectAssignmentService } from '../project-assignment.service';
export declare class ProjectAssignmentGuard implements CanActivate {
    private assignmentService;
    private reflector;
    constructor(assignmentService: ProjectAssignmentService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
