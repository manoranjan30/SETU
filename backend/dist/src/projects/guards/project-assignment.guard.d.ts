import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TreeRepository } from 'typeorm';
import { ProjectAssignmentService } from '../project-assignment.service';
import { EpsNode } from '../../eps/eps.entity';
export declare class ProjectAssignmentGuard implements CanActivate {
    private assignmentService;
    private reflector;
    private epsRepo;
    constructor(assignmentService: ProjectAssignmentService, reflector: Reflector, epsRepo: TreeRepository<EpsNode>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
