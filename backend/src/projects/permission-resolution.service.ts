import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm';
import {
  UserProjectAssignment,
  ProjectScopeType,
} from './entities/user-project-assignment.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Permission } from '../permissions/permission.entity';

@Injectable()
export class PermissionResolutionService {
  constructor(
    @InjectRepository(UserProjectAssignment)
    private assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(EpsNode)
    private epsRepo: TreeRepository<EpsNode>,
  ) {}

  /**
   * Resolves if a user has a specific permission on a specific EPS Node.
   * Uses Project Isolation & Scope Logic.
   */
  async hasPermission(
    userId: number,
    permissionCode: string,
    nodeId: number,
  ): Promise<boolean> {
    // 1. Get the Node
    const node = await this.epsRepo.findOne({
      where: { id: nodeId },
      relations: ['parent'],
    });
    if (!node) return false;

    // 2. Resolve Project Context
    const projectNode = await this.findProjectRoot(node);
    if (!projectNode) return false; // Node not part of a project?

    // 3. Get Assignment
    const assignment = await this.assignmentRepo.findOne({
      where: {
        user: { id: userId },
        project: { id: projectNode.id },
      },
      relations: ['role', 'role.permissions', 'scopeNode'],
    });

    if (!assignment) return false; // Strict Isolation

    // 4. Check Scope
    if (assignment.scopeType === ProjectScopeType.LIMITED) {
      if (!assignment.scopeNodeId) return false; // Invalid state

      // Check if target node is descendant of scope node
      // Optimized: if target == scope, OK. Else check ancestry.
      if (node.id !== assignment.scopeNodeId) {
        const isDescendant = await this.isDescendant(
          node,
          assignment.scopeNodeId,
        );
        if (!isDescendant) return false;
      }
    }

    // 5. Check Role Permissions
    const hasPerm = assignment.role.permissions.some(
      (p) => p.permissionCode === permissionCode,
    );
    return hasPerm;
  }

  private async findProjectRoot(node: EpsNode): Promise<EpsNode | null> {
    if (node.type === EpsNodeType.PROJECT) return node;

    // Use TreeRepository to find ancestors
    const ancestors = await this.epsRepo.findAncestors(node);
    return ancestors.find((a) => a.type === EpsNodeType.PROJECT) || null;
  }

  private async isDescendant(
    targetNode: EpsNode,
    scopeNodeId: number,
  ): Promise<boolean> {
    // Checks if targetNode is a child/grandchild of scopeNodeId
    const ancestors = await this.epsRepo.findAncestors(targetNode);
    return ancestors.some((a) => a.id === scopeNodeId);
  }
}
