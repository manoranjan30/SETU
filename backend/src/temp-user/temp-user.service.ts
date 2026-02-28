import { Injectable, BadRequestException, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { TempUser } from './entities/temp-user.entity';
import { TempRoleTemplate } from './entities/temp-role-template.entity';
import { CreateTempUserDto } from './dto/create-temp-user.dto';
import { User } from '../users/user.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';
import { ProjectAssignmentService } from '../projects/project-assignment.service';
import { Role } from '../roles/role.entity';
import { ProjectScopeType } from '../projects/entities/user-project-assignment.entity';

@Injectable()
export class TempUserService {
    constructor(
        @InjectRepository(TempUser)
        private readonly repo: Repository<TempUser>,
        @InjectRepository(TempRoleTemplate)
        private readonly templateRepo: Repository<TempRoleTemplate>,
        @InjectRepository(WorkOrder)
        private readonly workOrderRepo: Repository<WorkOrder>,
        @InjectRepository(Vendor)
        private readonly vendorRepo: Repository<Vendor>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Role)
        private readonly roleRepo: Repository<Role>,
        private readonly projectAssignmentService: ProjectAssignmentService,
    ) { }

    async getVendorsForProject(projectId: number) {
        const workOrders = await this.workOrderRepo.find({
            where: [
                { projectId, status: 'ACTIVE' },
                { projectId, status: 'IN_PROGRESS' } // Or however it's represented
            ],
            relations: ['vendor']
        });

        const today = new Date();
        const validWOs = workOrders.filter(wo => wo.orderValidityEnd && new Date(wo.orderValidityEnd) >= today);

        const vendorMap = new Map<number, Vendor>();
        for (const wo of validWOs) {
            if (wo.vendor && !vendorMap.has(wo.vendor.id)) {
                vendorMap.set(wo.vendor.id, wo.vendor);
            }
        }
        return Array.from(vendorMap.values());
    }

    async getWorkOrdersForVendorInProject(vendorId: number, projectId: number) {
        const workOrders = await this.workOrderRepo.find({
            where: [
                { vendor: { id: vendorId }, projectId, status: 'ACTIVE' },
                { vendor: { id: vendorId }, projectId, status: 'IN_PROGRESS' }
            ]
        });

        const today = new Date();
        return workOrders.filter(wo => wo.orderValidityEnd && new Date(wo.orderValidityEnd) >= today);
    }

    async create(dto: CreateTempUserDto, createdByUserId: number) {
        // 1. Validate work order
        const workOrder = await this.workOrderRepo.findOne({
            where: { id: dto.workOrderId, vendor: { id: dto.vendorId }, projectId: dto.projectId }
        });

        if (!workOrder || (workOrder.status !== 'ACTIVE' && workOrder.status !== 'IN_PROGRESS')) {
            throw new BadRequestException('Invalid/inactive Work Order');
        }
        const expiryDate = new Date(workOrder.orderValidityEnd);
        if (!workOrder.orderValidityEnd || expiryDate < new Date()) {
            throw new BadRequestException('Work order is expired or has no validity end date');
        }

        // 2. Validate template
        const template = await this.templateRepo.findOneBy({ id: dto.templateId, isActive: true });
        if (!template) throw new BadRequestException('Template not found or inactive');

        // 3. Duplicate check for same WO & mobile
        const existing = await this.repo.findOne({
            where: {
                workOrder: { id: dto.workOrderId },
                user: { username: dto.mobile }, // assuming mobile = username
                status: 'ACTIVE'
            },
            relations: ['user']
        });
        if (existing) throw new ConflictException('User already exists for this work order');

        // 4. Create base User
        const tempPassword = Math.random().toString(36).slice(-8); // e.g. a8b4c2d1
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        let user = await this.userRepo.findOneBy({ username: dto.mobile });
        if (!user) {
            user = this.userRepo.create({
                username: dto.mobile,
                displayName: dto.fullName,
                email: dto.email,
                phone: dto.mobile,
                designation: dto.designation,
                passwordHash,
                isTempUser: true,
                isFirstLogin: true
            });
            user = await this.userRepo.save(user);
        } else {
            // If user exists, we might just re-use them and reset password if they are temp user
            if (!user.isTempUser) {
                throw new BadRequestException('Phone number is already associated with a permanent system user.');
            }
            user.passwordHash = passwordHash;
            user.isFirstLogin = true;
            user = await this.userRepo.save(user);
        }

        // 5. Create TempUser record
        const tempUser = this.repo.create({
            user,
            vendor: { id: dto.vendorId },
            workOrder: { id: dto.workOrderId },
            project: { id: dto.projectId } as any,
            tempRoleTemplate: template,
            expiryDate,
            status: 'ACTIVE',
            createdById: createdByUserId
        });
        await this.repo.save(tempUser);

        // 6. Add to project team
        // Find auto-generated role for this template
        const roleName = `TEMP_ROLE_${template.id}`;
        let role = await this.roleRepo.findOneBy({ name: roleName });
        if (!role) {
            // Create if missing just in case
            // This is a minimal fallback
            role = this.roleRepo.create({ name: roleName, description: 'Auto-generated fallback' });
            role = await this.roleRepo.save(role);
        }

        await this.projectAssignmentService.assignUser(
            dto.projectId,
            user.id,
            [role.id],
            ProjectScopeType.FULL,
            undefined,
            createdByUserId
        );

        return { user, tempUser, generatedPassword: tempPassword };
    }

    async getTempUsersInProject(projectId: number) {
        return this.repo.find({
            where: { project: { id: projectId } as any },
            relations: ['user', 'vendor', 'workOrder', 'tempRoleTemplate']
        });
    }

    async suspend(id: number, reason: string, suspendedByUserId: number) {
        const tempUser = await this.repo.findOne({ where: { id }, relations: ['user', 'project'] });
        if (!tempUser) throw new NotFoundException('Temp user entry not found');

        tempUser.status = 'SUSPENDED';
        tempUser.suspendedAt = new Date();
        tempUser.suspendedById = suspendedByUserId;
        tempUser.suspensionReason = reason;

        await this.repo.save(tempUser);

        // Potentially revoke project access here, but guards check `status === ACTIVE`
        return tempUser;
    }

    async reactivate(id: number, reactivatedByUserId: number) {
        const tempUser = await this.repo.findOne({ where: { id }, relations: ['workOrder'] });
        if (!tempUser) throw new NotFoundException('Temp user entry not found');

        const workOrder = await this.workOrderRepo.findOneBy({ id: tempUser.workOrder.id });
        if (!workOrder || (workOrder.status !== 'ACTIVE' && workOrder.status !== 'IN_PROGRESS')) {
            throw new BadRequestException('Work order is not active');
        }

        if (!workOrder.orderValidityEnd || new Date(workOrder.orderValidityEnd) < new Date()) {
            throw new BadRequestException('Work order is already expired');
        }

        tempUser.status = 'ACTIVE';
        tempUser.suspendedAt = null as any;
        tempUser.suspendedById = null as any;
        tempUser.suspensionReason = null as any;
        tempUser.expiryDate = new Date(workOrder.orderValidityEnd);

        return this.repo.save(tempUser);
    }
}
