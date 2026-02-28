import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { EpsNode, EpsNodeType } from './eps.entity';
import { CreateEpsNodeDto } from './dto/create-eps-node.dto';
import { UpdateEpsNodeDto } from './dto/update-eps-node.dto';

import { ProjectProfile } from './project-profile.entity';
import { UpdateProjectProfileDto } from './dto/update-project-profile.dto';
import { PermissionResolutionService } from '../projects/permission-resolution.service';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class EpsService {
  constructor(
    @InjectRepository(EpsNode)
    private epsRepository: Repository<EpsNode>,
    @InjectRepository(ProjectProfile)
    private profileRepository: Repository<ProjectProfile>,
    private permissionService: PermissionResolutionService,
  ) { }

  async updateProfile(
    nodeId: number,
    updateProfileDto: UpdateProjectProfileDto,
    user: any,
  ): Promise<ProjectProfile> {
    await this.ensureNodeAccess(user, nodeId, 'PROJECT.PROPERTIES.UPDATE');

    const node = await this.epsRepository.findOne({
      where: { id: nodeId },
      relations: ['projectProfile'],
    });
    if (!node) throw new NotFoundException('Node not found');

    const userId = user.username || 'system';

    let profile = node.projectProfile;
    if (!profile) {
      profile = this.profileRepository.create({
        epsNode: node,
        createdBy: userId,
      });
    }

    Object.assign(profile, updateProfileDto);
    profile.lastUpdatedBy = userId;

    if (!profile.projectName) profile.projectName = node.name;

    return this.profileRepository.save(profile);
  }

  async getProfile(nodeId: number): Promise<ProjectProfile | null> {
    return this.profileRepository.findOne({
      where: { epsNode: { id: nodeId } },
    });
  }

  // Security Helper
  private async ensureNodeAccess(
    user: any,
    nodeId: number,
    permission: string,
  ): Promise<void> {
    // 1. Admin Bypass
    const roles = user.roles || [];
    const isAdmin =
      roles.includes('Admin') ||
      roles.some((r) => r === 'Admin' || r.name === 'Admin') ||
      user.role === 'Admin';
    if (isAdmin) return;

    // 2. Permission Check
    const hasPerm = await this.permissionService.hasPermission(
      user.id || user.userId || user.sub,
      permission,
      nodeId,
    );
    if (!hasPerm) {
      throw new ForbiddenException(
        `Access Denied: Missing ${permission} on Node ${nodeId}`,
      );
    }
  }

  // Helpers for Hierarchy Rules
  private getAllowedChildType(parentType: EpsNodeType): EpsNodeType | null {
    switch (parentType) {
      case EpsNodeType.COMPANY:
        return EpsNodeType.PROJECT;
      case EpsNodeType.PROJECT:
        return EpsNodeType.BLOCK;
      case EpsNodeType.BLOCK:
        return EpsNodeType.TOWER;
      case EpsNodeType.TOWER:
        return EpsNodeType.FLOOR;
      case EpsNodeType.FLOOR:
        return EpsNodeType.UNIT;
      case EpsNodeType.UNIT:
        return EpsNodeType.ROOM;
      default:
        return null;
    }
  }

  async importCsv(fileBuffer: Buffer, user: any): Promise<any> {
    const userId = user.username || 'system';
    const results: any[] = [];
    const stream = require('stream');
    const csv = require('csv-parser');

    return new Promise((resolve, reject) => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileBuffer);

      bufferStream
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', async () => {
          try {
            await this.processCsvData(results, userId);
            resolve({ message: 'Import successful', count: results.length });
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (err: any) => reject(err));
    });
  }

  private async processCsvData(rows: any[], userId: string) {
    const levels = [
      EpsNodeType.COMPANY,
      EpsNodeType.PROJECT,
      EpsNodeType.BLOCK,
      EpsNodeType.TOWER,
      EpsNodeType.FLOOR,
      EpsNodeType.UNIT,
      EpsNodeType.ROOM,
    ];

    for (const row of rows) {
      let parentId: number | null = null;
      for (const type of levels) {
        const nodeName = row[type.charAt(0) + type.slice(1).toLowerCase()];
        if (nodeName && nodeName.trim() !== '') {
          parentId = await this.findOrCreateNode(
            nodeName.trim(),
            type,
            parentId,
            userId,
          );
        }
      }
    }
  }

  private async findOrCreateNode(
    name: string,
    type: EpsNodeType,
    parentId: number | null,
    userId: string,
  ): Promise<number> {
    const whereCondition: any = { name, type };
    whereCondition.parentId = parentId ? parentId : IsNull();

    const existing = await this.epsRepository.findOne({
      where: whereCondition,
    });
    if (existing) return existing.id;

    const newNode = this.epsRepository.create({
      name,
      type,
      parentId: parentId || undefined,
      createdBy: userId,
      updatedBy: userId,
      order: 0,
    });

    const saved = await this.epsRepository.save(newNode);
    return saved.id;
  }

  async create(createDto: CreateEpsNodeDto, user: any): Promise<EpsNode> {
    const userId = user.username || 'system';
    if (!createDto.parentId) {
      if (createDto.type !== EpsNodeType.COMPANY) {
        throw new BadRequestException('Only COMPANY can be a root node.');
      }
    } else {
      await this.ensureNodeAccess(user, createDto.parentId, 'EPS.NODE.CREATE');
      const parent = await this.epsRepository.findOneBy({
        id: createDto.parentId,
      });
      if (!parent) throw new NotFoundException('Parent node not found');
      const expectedType = this.getAllowedChildType(parent.type);
      if (createDto.type !== expectedType) {
        throw new BadRequestException(
          `Invalid hierarchy. ${parent.type} can only have child of type ${expectedType}.`,
        );
      }
    }
    const node = this.epsRepository.create({
      ...createDto,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.epsRepository.save(node);
  }

  async findAll(user?: any): Promise<EpsNode[]> {
    if (!user) return []; // Fallback

    // Extract userId from JWT - JwtStrategy sets `id` from payload.sub
    const userId = user.id || user.userId || user.sub;

    const roles = (user.roles || []).map((r: any) =>
      typeof r === 'string' ? r.toLowerCase() : r.name?.toLowerCase(),
    );
    const userRole = user.role ? user.role.toLowerCase() : '';
    const isAdmin = roles.includes('admin') || userRole === 'admin';

    const qb = this.epsRepository
      .createQueryBuilder('node')
      .orderBy('node.parentId', 'ASC')
      .addOrderBy('node.order', 'ASC', 'NULLS LAST')
      // Natural sort: numeric segments sort numerically so "Floor 2" < "Floor 10"
      .addOrderBy(
        `CAST(NULLIF(regexp_replace(node.name, '[^0-9]', '', 'g'), '') AS INTEGER)`,
        'ASC',
        'NULLS LAST',
      )
      .addOrderBy('node.name', 'ASC');

    if (isAdmin) {
      const all = await qb.getMany();
      return this.sanitize(all);
    }

    // RBAC Logic - get project IDs the user is assigned to
    const rawAssignments = await this.epsRepository.manager
      .createQueryBuilder(UserProjectAssignment, 'upa')
      .select('upa.project_id', 'pid')
      .where('upa.user_id = :userId', { userId })
      .andWhere('upa.status = :status', { status: 'ACTIVE' })
      .getRawMany();

    const allowedProjectIds = rawAssignments.map((p) => p.pid);
    console.log(`[EPS RBAC] userId=${userId}, rawAssignments:`, rawAssignments);
    console.log(`[EPS RBAC] allowedProjectIds:`, allowedProjectIds);

    if (allowedProjectIds.length === 0) {
      // No assignments → show nothing (no projects)
      return [];
    }

    // Fetch all nodes and build filtered tree
    const allNodes = await qb.getMany();
    const allowedSet = new Set(allowedProjectIds.map((id) => Number(id)));

    // Phase 1: Find all assigned PROJECT nodes
    const projectNodes = allNodes.filter(
      (n) => n.type === EpsNodeType.PROJECT && allowedSet.has(n.id),
    );

    // Phase 2: Collect parent company IDs for assigned projects
    const parentCompanyIds = new Set<number>();
    for (const proj of projectNodes) {
      if (proj.parentId) parentCompanyIds.add(proj.parentId);
    }

    // Phase 3: Build visible set - company → project → all descendants
    const visibleIds = new Set<number>();
    const finalResult: EpsNode[] = [];

    for (const node of allNodes) {
      let show = false;

      if (node.type === EpsNodeType.COMPANY) {
        // Only show the company if it has an assigned project under it
        show = parentCompanyIds.has(node.id);
      } else if (node.type === EpsNodeType.PROJECT) {
        // Only show assigned projects
        show = allowedSet.has(node.id);
      } else {
        // Show descendants of visible parents (cascading down)
        if (node.parentId && visibleIds.has(node.parentId)) show = true;
      }

      if (show) {
        visibleIds.add(node.id);
        finalResult.push(node);
      }
    }

    // Natural Sort
    finalResult.sort((a, b) => {
      if ((a.parentId || 0) !== (b.parentId || 0))
        return (a.parentId || 0) - (b.parentId || 0);
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    return this.sanitize(finalResult);
  }

  // --- NEW: Project Tree Method ---
  async getProjectTree(projectId: number): Promise<any[]> {
    // 1. Fetch Project Node + All Descendants
    // Since we don't have a closure table, we must fetch all children recursively.
    // Or, simpler: Fetch EVERYTHING and filter in-memory (assuming reasonable dataset size).
    // Or, for just one project, we can use a recursive query.
    // Let's rely on simple parentId traversal from the DB if possible, OR fetch all and filter.

    // Fetch all nodes first (optimization: filter by Project ID path if we knew it? No.)
    // We can assume the tree isn't millions of rows.
    const allNodes = await this.epsRepository.find();

    // Build Tree Structure for the given Project ID
    return this.buildTree(allNodes, projectId);
  }

  private buildTree(allNodes: EpsNode[], rootId: number): any[] {
    const root = allNodes.find((n) => n.id === rootId);
    if (!root) return [];

    const tree = [
      {
        id: root.id,
        label: root.name,
        type: root.type, // Added type
        children: this.findChildrenRecursive(allNodes, root.id),
        data: root,
      },
    ];
    return tree;
  }

  private findChildrenRecursive(allNodes: EpsNode[], parentId: number): any[] {
    const children = allNodes
      .filter((n) => n.parentId === parentId)
      .sort(
        (a, b) =>
          a.order - b.order ||
          a.name.localeCompare(b.name, undefined, { numeric: true }),
      );

    return children.map((child) => ({
      id: child.id,
      label: child.name,
      type: child.type, // Added type
      children: this.findChildrenRecursive(allNodes, child.id),
      data: child,
    }));
  }
  // ------------------------------

  private sanitize(nodes: EpsNode[]): any[] {
    return nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parentId: n.parentId,
      order: n.order,
    }));
  }

  async findOne(id: number): Promise<EpsNode | null> {
    return this.epsRepository.findOne({
      where: { id },
      relations: ['children'],
    });
  }

  async update(
    id: number,
    updateDto: UpdateEpsNodeDto,
    user: any,
  ): Promise<EpsNode | null> {
    await this.ensureNodeAccess(user, id, 'EPS.NODE.UPDATE');
    await this.epsRepository.update(id, {
      ...updateDto,
      updatedBy: user.username || 'system',
    });
    return this.findOne(id);
  }

  async remove(id: number, user: any): Promise<void> {
    await this.ensureNodeAccess(user, id, 'EPS.NODE.DELETE');
    const node = await this.findOne(id);
    if (!node) throw new NotFoundException('Node not found');
    const childCount = await this.epsRepository.count({
      where: { parentId: id },
    });
    if (childCount > 0)
      throw new BadRequestException('Cannot delete node with children.');
    await this.epsRepository.delete(id);
  }
}
