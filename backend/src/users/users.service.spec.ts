import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { createMockRepository } from '../test-utils/mock-repository';
import { fakeUser } from '../test-utils/test-fixtures';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof createMockRepository>;
  let tempUserRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    userRepo = createMockRepository();
    tempUserRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(TempUser), useValue: tempUserRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('throws ConflictException when username already exists (non-temp)', async () => {
      userRepo.findOneBy!.mockResolvedValue(fakeUser());
      await expect(
        service.create({ username: 'testuser', password: 'pass', isActive: true }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when username already exists (temp user)', async () => {
      userRepo.findOneBy!.mockResolvedValue({ ...fakeUser(), isTempUser: true });
      await expect(
        service.create({ username: 'testuser', password: 'pass', isActive: true }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password and saves the user', async () => {
      userRepo.findOneBy!.mockResolvedValue(null);
      userRepo.create!.mockImplementation((dto: any) => ({ ...dto }));
      userRepo.save!.mockImplementation(async (u: any) => ({ id: 99, ...u }));

      const result = await service.create({ username: 'newuser', password: 'secret', isActive: true });

      expect(result.username).toBe('newuser');
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser' }),
      );
      const savedArg = (userRepo.save as jest.Mock).mock.calls[0][0];
      const isHashed = await bcrypt.compare('secret', savedArg.passwordHash);
      expect(isHashed).toBe(true);
    });
  });

  describe('findOne', () => {
    it('returns user when found', async () => {
      const user = fakeUser();
      userRepo.findOne!.mockResolvedValue(user);
      const result = await service.findOne('testuser');
      expect(result).toEqual(user);
    });

    it('returns null when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      const result = await service.findOne('nobody');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const user = fakeUser();
      userRepo.findOne!.mockResolvedValue(user);
      const result = await service.findById(1);
      expect(result).toEqual(user);
    });

    it('returns null when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      const result = await service.findById(999);
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('throws BadRequestException for temp user', async () => {
      const tempUser = { ...fakeUser(), isTempUser: true, roles: [] } as any;
      userRepo.findOne!.mockResolvedValue(tempUser);

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('hashes new password when provided', async () => {
      const user = { ...fakeUser(), roles: [] } as any;
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue(user);

      await service.update(1, { password: 'newpass' });

      const savedUser = (userRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedUser.passwordHash).toBeDefined();
      const isHashed = await bcrypt.compare('newpass', savedUser.passwordHash);
      expect(isHashed).toBe(true);
    });

    it('returns null when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      const result = await service.update(999, {});
      expect(result).toBeNull();
    });

    it('updates isActive when provided', async () => {
      const user = { ...fakeUser(), roles: [] } as any;
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue({ ...user, isActive: false });

      await service.update(1, { isActive: false });

      const savedUser = (userRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedUser.isActive).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('throws NotFoundException when user not found', async () => {
      userRepo.findOneBy!.mockResolvedValue(null);
      await expect(service.changePassword(999, 'old', 'new')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when old password is wrong', async () => {
      const user = {
        ...fakeUser(),
        passwordHash: await bcrypt.hash('correct', 10),
        isFirstLogin: false,
      } as any;
      userRepo.findOneBy!.mockResolvedValue(user);

      await expect(service.changePassword(1, 'wrong', 'new')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates password hash and clears isFirstLogin flag on success', async () => {
      const user = {
        ...fakeUser(),
        passwordHash: await bcrypt.hash('oldpass', 10),
        isFirstLogin: true,   // starts true — service must clear it to false
      } as any;
      userRepo.findOneBy!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue(user);

      await service.changePassword(1, 'oldpass', 'newpass');

      const savedUser = (userRepo.save as jest.Mock).mock.calls[0][0];
      const isHashed = await bcrypt.compare('newpass', savedUser.passwordHash);
      expect(isHashed).toBe(true);
      expect(savedUser.isFirstLogin).toBe(false);
    });

    it('skips old password check when isFirstLogin is true', async () => {
      const user = {
        ...fakeUser(),
        passwordHash: await bcrypt.hash('oldpass', 10),
        isFirstLogin: true,
      } as any;
      userRepo.findOneBy!.mockResolvedValue(user);
      userRepo.save!.mockResolvedValue(user);

      // Should not throw even if oldPassword is wrong because isFirstLogin=true
      await expect(service.changePassword(1, 'wrong', 'newpass')).resolves.not.toThrow();
      const savedUser = (userRepo.save as jest.Mock).mock.calls[0][0];
      expect(savedUser.isFirstLogin).toBe(false);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when deleting admin user', async () => {
      userRepo.findOneBy!.mockResolvedValue({ ...fakeUser(), username: 'admin' } as any);
      await expect(service.remove(2)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for temp users', async () => {
      userRepo.findOneBy!.mockResolvedValue({ ...fakeUser(), isTempUser: true } as any);
      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });

    it('deletes a regular user', async () => {
      userRepo.findOneBy!.mockResolvedValue(fakeUser() as any);
      userRepo.delete!.mockResolvedValue({ affected: 1 });

      await service.remove(1);
      expect(userRepo.delete).toHaveBeenCalledWith(1);
    });

    it('returns silently when user not found', async () => {
      userRepo.findOneBy!.mockResolvedValue(null);
      await expect(service.remove(999)).resolves.toBeUndefined();
      expect(userRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('throws ForbiddenException when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      await expect(service.getProfile(999)).rejects.toThrow(ForbiddenException);
    });

    it('returns user profile without passwordHash', async () => {
      const user = { ...fakeUser(), passwordHash: 'should-be-stripped', roles: [] } as any;
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.getProfile(1);
      expect(result.passwordHash).toBeUndefined();
      expect(result.username).toBe(user.username);
    });

    it('includes vendor info for temp users', async () => {
      const tempUser = { ...fakeUser(), isTempUser: true, roles: [] } as any;
      const vendor = { id: 5, name: 'Test Vendor' };
      userRepo.findOne!.mockResolvedValue(tempUser);
      tempUserRepo.findOne!.mockResolvedValue({ vendor });

      const result = await service.getProfile(1);
      expect(result.passwordHash).toBeUndefined();
      expect(result.vendor).toEqual(vendor);
    });
  });
});
