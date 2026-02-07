import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const { permissionIds, ...roleData } = createRoleDto;
    const role = this.rolesRepository.create(roleData);

    if (permissionIds && permissionIds.length > 0) {
      // We assume IDs are valid or ignore invalid ones.
      // Ideally we'd validte them, but for MVP we map them
      role.permissions = permissionIds.map((id) => ({ id }) as any);
    }

    return this.rolesRepository.save(role);
  }

  findAll(): Promise<Role[]> {
    return this.rolesRepository.find();
  }

  findOne(id: number): Promise<Role | null> {
    return this.rolesRepository.findOneBy({ id });
  }

  async update(id: number, createRoleDto: CreateRoleDto): Promise<Role | null> {
    const { permissionIds, ...roleData } = createRoleDto;

    // Load role with permissions
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) return null;
    if (role.name === 'Admin') {
      throw new ForbiddenException('Cannot modify the Admin role');
    }

    // Update fields
    Object.assign(role, roleData);

    if (permissionIds) {
      role.permissions = permissionIds.map((id) => ({ id }) as any);
    }

    return this.rolesRepository.save(role);
  }

  async remove(id: number): Promise<void> {
    const role = await this.rolesRepository.findOneBy({ id });
    if (role && role.name === 'Admin') {
      throw new ForbiddenException('Cannot delete the Admin role');
    }
    await this.rolesRepository.delete(id);
  }
}
