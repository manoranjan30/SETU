import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ProjectAssignmentService } from '../projects/project-assignment.service';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Role } from '../roles/role.entity';
import { createMockRepository } from '../test-utils/mock-repository';
import { fakeUser } from '../test-utils/test-fixtures';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let assignmentService: jest.Mocked<ProjectAssignmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('fake.jwt.token'),
          },
        },
        {
          provide: ProjectAssignmentService,
          useValue: {
            getUserAssignments: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(TempUser),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Role),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    assignmentService = module.get(ProjectAssignmentService);
  });

  describe('validateUser', () => {
    it('returns user without passwordHash when credentials are correct', async () => {
      const user = fakeUser() as any;
      user.passwordHash = await bcrypt.hash('secret', 10);
      usersService.findOne.mockResolvedValue(user as any);

      const result = await service.validateUser(user.username, 'secret');

      expect(result).toBeDefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.username).toBe(user.username);
    });

    it('returns null when password does not match', async () => {
      const user = fakeUser() as any;
      user.passwordHash = await bcrypt.hash('correct', 10);
      usersService.findOne.mockResolvedValue(user as any);

      const result = await service.validateUser(user.username, 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when user does not exist', async () => {
      usersService.findOne.mockResolvedValue(null);
      const result = await service.validateUser('nobody', 'pass');
      expect(result).toBeNull();
    });

    it('throws UnauthorizedException when user is deactivated', async () => {
      const user = { ...fakeUser(), isActive: false, passwordHash: 'x' } as any;
      usersService.findOne.mockResolvedValue(user as any);

      await expect(service.validateUser(user.username, 'any')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('returns access_token and user object', async () => {
      const user = { ...fakeUser(), roles: [] } as any;

      const result = await service.login(user);

      expect(result.access_token).toBe('fake.jwt.token');
      expect(result.user.id).toBe(user.id);
      expect(result.user.username).toBe(user.username);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: user.id, username: user.username }),
        expect.anything(),
      );
    });

    it('includes project_ids from assignments', async () => {
      const user = { ...fakeUser(), roles: [] } as any;
      assignmentService.getUserAssignments.mockResolvedValue([
        { project: { id: 42 }, roles: [] } as any,
      ]);

      const result = await service.login(user);
      expect(result.user.project_ids).toContain(42);
    });
  });
});
