import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionResolutionService } from './permission-resolution.service';
import {
  UserProjectAssignment,
  ProjectScopeType,
} from './entities/user-project-assignment.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { createMockRepository } from '../test-utils/mock-repository';

describe('PermissionResolutionService', () => {
  let service: PermissionResolutionService;
  let assignmentRepo: ReturnType<typeof createMockRepository>;
  let epsRepo: ReturnType<typeof createMockRepository> & {
    findAncestors: jest.Mock;
  };

  beforeEach(async () => {
    assignmentRepo = createMockRepository();
    epsRepo = {
      ...createMockRepository(),
      findAncestors: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionResolutionService,
        {
          provide: getRepositoryToken(UserProjectAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(EpsNode),
          useValue: epsRepo,
        },
      ],
    }).compile();

    service = module.get<PermissionResolutionService>(
      PermissionResolutionService,
    );
  });

  // Test 1: EPS node not found
  it('returns false when EPS node does not exist', async () => {
    epsRepo.findOne.mockResolvedValue(null);

    const result = await service.hasPermission(1, 'QUALITY.READ', 99);

    expect(result).toBe(false);
  });

  // Test 2: No PROJECT-type ancestor (orphaned node)
  it('returns false when node has no PROJECT-type ancestor', async () => {
    const node = { id: 5, type: EpsNodeType.BLOCK, parent: null } as EpsNode;
    epsRepo.findOne.mockResolvedValue(node);
    epsRepo.findAncestors.mockResolvedValue([
      { id: 3, type: EpsNodeType.TOWER },
    ]);

    const result = await service.hasPermission(1, 'QUALITY.READ', 5);

    expect(result).toBe(false);
  });

  // Test 3: No assignment for the user on this project
  it('returns false when user has no project assignment', async () => {
    const projectNode = {
      id: 10,
      type: EpsNodeType.PROJECT,
    } as EpsNode;
    const node = { id: 5, type: EpsNodeType.BLOCK, parent: null } as EpsNode;
    epsRepo.findOne.mockResolvedValue(node);
    epsRepo.findAncestors.mockResolvedValue([projectNode]);
    assignmentRepo.findOne.mockResolvedValue(null);

    const result = await service.hasPermission(1, 'QUALITY.READ', 5);

    expect(result).toBe(false);
  });

  // Test 4: FULL scope with matching permission → true
  it('returns true for FULL scope user with correct permission', async () => {
    const projectNode = {
      id: 10,
      type: EpsNodeType.PROJECT,
    } as EpsNode;
    const node = { id: 10, type: EpsNodeType.PROJECT, parent: null } as EpsNode;
    epsRepo.findOne.mockResolvedValue(node);
    epsRepo.findAncestors.mockResolvedValue([projectNode]);
    assignmentRepo.findOne.mockResolvedValue({
      scopeType: ProjectScopeType.FULL,
      roles: [
        { permissions: [{ permissionCode: 'QUALITY.READ' }] },
      ],
    } as Partial<UserProjectAssignment>);

    const result = await service.hasPermission(1, 'QUALITY.READ', 10);

    expect(result).toBe(true);
  });

  // Test 5: FULL scope but missing the permission → false
  it('returns false for FULL scope user missing the permission', async () => {
    const projectNode = {
      id: 10,
      type: EpsNodeType.PROJECT,
    } as EpsNode;
    const node = { id: 10, type: EpsNodeType.PROJECT, parent: null } as EpsNode;
    epsRepo.findOne.mockResolvedValue(node);
    epsRepo.findAncestors.mockResolvedValue([projectNode]);
    assignmentRepo.findOne.mockResolvedValue({
      scopeType: ProjectScopeType.FULL,
      roles: [
        { permissions: [{ permissionCode: 'LABOR.READ' }] },
      ],
    } as Partial<UserProjectAssignment>);

    const result = await service.hasPermission(1, 'QUALITY.READ', 10);

    expect(result).toBe(false);
  });

  // Test 6: LIMITED scope, target node NOT under scope node → false
  it('returns false for LIMITED scope when node is outside scope', async () => {
    const projectNode = {
      id: 10,
      type: EpsNodeType.PROJECT,
    } as EpsNode;
    const node = { id: 20, type: EpsNodeType.FLOOR, parent: null } as EpsNode;
    const scopeNode = { id: 30, type: EpsNodeType.BLOCK } as EpsNode;
    epsRepo.findOne.mockResolvedValue(node);
    epsRepo.findAncestors
      .mockResolvedValueOnce([projectNode]) // findProjectRoot call
      .mockResolvedValueOnce([{ id: 99 }]); // isDescendant — scope node NOT in ancestors
    assignmentRepo.findOne.mockResolvedValue({
      scopeType: ProjectScopeType.LIMITED,
      scopeNode,
      roles: [
        { permissions: [{ permissionCode: 'QUALITY.READ' }] },
      ],
    } as Partial<UserProjectAssignment>);

    const result = await service.hasPermission(1, 'QUALITY.READ', 20);

    expect(result).toBe(false);
  });

  // Test 7: LIMITED scope, target IS under scope node → true
  it('returns true for LIMITED scope when node IS within scope', async () => {
    const projectNode = {
      id: 10,
      type: EpsNodeType.PROJECT,
    } as EpsNode;
    const node = { id: 20, type: EpsNodeType.FLOOR, parent: null } as EpsNode;
    const scopeNode = { id: 30, type: EpsNodeType.BLOCK } as EpsNode;
    epsRepo.findOne.mockResolvedValue(node);
    epsRepo.findAncestors
      .mockResolvedValueOnce([projectNode]) // findProjectRoot call
      .mockResolvedValueOnce([{ id: 30 }, projectNode]); // isDescendant — scope node IS in ancestors
    assignmentRepo.findOne.mockResolvedValue({
      scopeType: ProjectScopeType.LIMITED,
      scopeNode,
      roles: [
        { permissions: [{ permissionCode: 'QUALITY.READ' }] },
      ],
    } as Partial<UserProjectAssignment>);

    const result = await service.hasPermission(1, 'QUALITY.READ', 20);

    expect(result).toBe(true);
  });
});
