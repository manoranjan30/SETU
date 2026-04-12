import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { UsersService } from '../users/users.service';
import { ProjectAssignmentService } from '../projects/project-assignment.service';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { createMockRepository } from '../test-utils/mock-repository';
import { fakeUser } from '../test-utils/test-fixtures';

const TEST_JWT_SECRET = 'test-secret';

function buildModule(usersServiceOverride: any, tempUserFindOne: any = jest.fn().mockResolvedValue(null)) {
  return Test.createTestingModule({
    imports: [
      PassportModule,
      JwtModule.register({
        secret: TEST_JWT_SECRET,
        signOptions: { expiresIn: '1h' },
      }),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      LocalStrategy,
      // Provide JwtStrategy inline so we can inject the same TEST_JWT_SECRET
      // and the mocked TempUser repo before the strategy's constructor runs.
      {
        provide: JwtStrategy,
        useFactory: (tempUserRepo: any) => {
          // Patch env so the strategy picks up test-secret
          const original = process.env.JWT_SECRET;
          process.env.JWT_SECRET = TEST_JWT_SECRET;
          const strategy = new JwtStrategy(tempUserRepo);
          process.env.JWT_SECRET = original;
          return strategy;
        },
        inject: [getRepositoryToken(TempUser)],
      },
      {
        provide: UsersService,
        useValue: usersServiceOverride,
      },
      {
        provide: ProjectAssignmentService,
        useValue: {
          getUserAssignments: jest.fn().mockResolvedValue([]),
          assignUser: jest.fn(),
        },
      },
      {
        provide: getRepositoryToken(TempUser),
        useValue: {
          ...createMockRepository(),
          findOne: tempUserFindOne,
        },
      },
      {
        provide: getRepositoryToken(Role),
        useValue: createMockRepository(),
      },
      {
        provide: getRepositoryToken(User),
        useValue: createMockRepository(),
      },
    ],
  }).compile();
}

describe('Auth Integration', () => {
  let app: INestApplication;
  let mockUser: any;

  beforeEach(async () => {
    mockUser = {
      ...fakeUser(),
      passwordHash: await bcrypt.hash('password123', 10),
      roles: [],
    } as any;

    const module: TestingModule = await buildModule({
      findOne: jest.fn().mockResolvedValue(mockUser),
    });

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // POST /auth/login
  // ---------------------------------------------------------------------------
  describe('POST /auth/login', () => {
    it('returns 201 with access_token on valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(201);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.user.username).toBe('testuser');
    });

    it('returns 401 on wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'wrongpass' })
        .expect(401);
    });

    it('returns 401 for non-existent user', async () => {
      const module2 = await buildModule({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const app2 = module2.createNestApplication();
      await app2.init();

      await request(app2.getHttpServer())
        .post('/auth/login')
        .send({ username: 'nobody', password: 'pass' })
        .expect(401);

      await app2.close();
    });

    it('returns 401 for deactivated user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      const module3 = await buildModule({
        findOne: jest.fn().mockResolvedValue(inactiveUser),
      });
      const app3 = module3.createNestApplication();
      await app3.init();

      await request(app3.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(401);

      await app3.close();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /auth/profile
  // ---------------------------------------------------------------------------
  describe('GET /auth/profile', () => {
    it('returns 401 without Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('returns 200 with user profile when valid JWT is supplied', async () => {
      // First login to get a real token signed with TEST_JWT_SECRET
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(201);

      const token = loginRes.body.access_token;
      expect(token).toBeDefined();

      const profileRes = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileRes.body.username).toBe('testuser');
    });

    it('returns 401 when a malformed/invalid token is supplied', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });
  });
});
