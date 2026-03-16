import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/role.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(TempUser)
    private tempUserRepository: Repository<TempUser>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOneBy({
      username: createUserDto.username,
    });
    if (existing) {
      if (existing.isTempUser) {
        throw new ConflictException(
          'This username is already associated with a temporary vendor user.',
        );
      }
      throw new ConflictException('Username is already taken.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    const roles = createUserDto.roles
      ? createUserDto.roles.map((id) => ({ id }) as Role)
      : [];

    const user = this.usersRepository.create({
      username: createUserDto.username,
      passwordHash,
      isActive: createUserDto.isActive ?? true,
      roles,
    });

    return this.usersRepository.save(user);
  }

  async findOne(username: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { username },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('user.isTempUser = :isTemp OR user.isTempUser IS NULL', {
        isTemp: false,
      })
      .getMany();
  }

  async update(id: number, updateUserDto: any): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) return null;

    if (user.isTempUser) {
      throw new BadRequestException(
        'Cannot modify temporary users through the permanent user management module.',
      );
    }

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(updateUserDto.password, salt);
    }

    if (updateUserDto.isActive !== undefined) {
      user.isActive = updateUserDto.isActive;
    }

    if (updateUserDto.roles) {
      user.roles = updateUserDto.roles.map((rId) => ({ id: rId }) as Role);
    }

    // We explicitly delete properties we don't want to overwrite or that are handled
    // But since we are modifying the 'user' entity directly, we are safe.

    return this.usersRepository.save(user);
  }

  // ===== PROFILE METHODS =====

  async getProfile(id: number): Promise<any> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) throw new ForbiddenException('User not found');

    const { passwordHash, ...safeUser } = user;

    if (user.isTempUser) {
      const tempInfo = await this.tempUserRepository.findOne({
        where: { user: { id: user.id } },
        relations: ['vendor'],
      });
      return {
        ...safeUser,
        vendor: tempInfo?.vendor,
      };
    }

    return safeUser;
  }

  async updateProfile(id: number, updateData: Partial<User>): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    Object.assign(user, updateData);
    return this.usersRepository.save(user);
  }

  async changePassword(
    id: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');

    if (!user.isFirstLogin && oldPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isMatch) throw new BadRequestException('Incorrect current password');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.isFirstLogin = false;
    return this.usersRepository.save(user);
  }

  async getSignature(id: number): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new ForbiddenException('User not found');
    return {
      signatureData: user.signatureData,
      signatureImageUrl: user.signatureImageUrl,
      signatureUpdatedAt: user.signatureUpdatedAt,
    };
  }

  async updateSignature(
    id: number,
    signatureData: string,
    signatureImageUrl?: string,
  ): Promise<any> {
    console.log(`[UsersService] Updating signature for UserID: ${id}`);
    try {
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user) {
        console.error(`[UsersService] User not found (ID: ${id})`);
        throw new ForbiddenException('User not found');
      }

      // Use update() to perform a partial update directly in the database
      // This is safer than save() as it ignores relationships and missing fields
      const updateData: any = {
        signatureData: signatureData,
        signatureUpdatedAt: new Date(),
      };

      if (signatureImageUrl !== undefined) {
        updateData.signatureImageUrl = signatureImageUrl;
      }

      const updateResult = await this.usersRepository.update(id, updateData);
      console.log(
        `[UsersService] Database updated rows: ${updateResult.affected}`,
      );

      return { success: true };
    } catch (error) {
      console.error(
        `[UsersService] Database error while updating signature:`,
        error,
      );
      throw error;
    }
  }

  // ============================

  async saveFcmToken(userId: number, token: string): Promise<void> {
    await this.usersRepository.update(userId, { fcmToken: token });
  }

  async remove(id: number): Promise<void> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) return;
    if (user.username === 'admin') {
      throw new ForbiddenException('Cannot delete the Admin user');
    }
    if (user.isTempUser) {
      throw new BadRequestException(
        'Cannot delete temporary users through the permanent user management module.',
      );
    }
    await this.usersRepository.delete(id);
  }
}
