import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { createMockRepository } from '../test-utils/mock-repository';
import { fakeJwtPayload } from '../test-utils/test-fixtures';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let tempUserRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    tempUserRepo = createMockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: getRepositoryToken(TempUser),
          useValue: tempUserRepo,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns user object for a normal (non-temp) user', async () => {
    const payload = { ...fakeJwtPayload(), isTempUser: false };
    const result = await strategy.validate(payload);

    expect(result.id).toBe(payload.sub);
    expect(result.username).toBe(payload.username);
    expect(result.isTempUser).toBe(false);
    expect(result.vendorContext).toBeNull();
    expect(tempUserRepo.findOne).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when TempUser record not found', async () => {
    const payload = { ...fakeJwtPayload(), isTempUser: true };
    tempUserRepo.findOne!.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when TempUser status is not ACTIVE', async () => {
    const payload = { ...fakeJwtPayload(), isTempUser: true };
    tempUserRepo.findOne!.mockResolvedValue({
      id: 99,
      status: 'SUSPENDED',
      expiryDate: new Date(Date.now() + 86400000),
      workOrder: { status: 'ACTIVE', orderValidityEnd: new Date(Date.now() + 86400000) },
    });

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('throws TEMP_EXPIRED and marks TempUser EXPIRED when past expiry date', async () => {
    const payload = { ...fakeJwtPayload(), isTempUser: true };
    tempUserRepo.findOne!.mockResolvedValue({
      id: 99,
      status: 'ACTIVE',
      expiryDate: new Date('2000-01-01'), // past
      workOrder: { status: 'ACTIVE', orderValidityEnd: new Date(Date.now() + 86400000) },
    });

    await expect(strategy.validate(payload)).rejects.toThrow('TEMP_EXPIRED');
    expect(tempUserRepo.update).toHaveBeenCalledWith(99, { status: 'EXPIRED' });
  });
});
