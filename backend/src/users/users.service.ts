import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
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
    return this.usersRepository.find({ relations: ['roles'] });
  }

  async update(id: number, updateUserDto: any): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) return null;

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

  async remove(id: number): Promise<void> {
    const user = await this.usersRepository.findOneBy({ id });
    if (user && user.username === 'admin') {
      throw new ForbiddenException('Cannot delete the Admin user');
    }
    await this.usersRepository.delete(id);
  }
}
