import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReleaseStrategyService } from '../planning/release-strategy.service';
import { User } from '../users/user.entity';

export type ProjectApprovalActor = {
  userId: number;
  displayName: string;
  sourceType: 'PERMANENT' | 'TEMP_VENDOR';
  projectRoleIds: number[];
  projectRoleNames: string[];
  companyLabel: string;
  primaryRoleLabel: string | null;
};

@Injectable()
export class ApprovalRuntimeService {
  constructor(
    private readonly releaseStrategyService: ReleaseStrategyService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getProjectActors(projectId: number): Promise<ProjectApprovalActor[]> {
    return (await this.releaseStrategyService.getEligibleActors(
      projectId,
    )) as ProjectApprovalActor[];
  }

  async getProjectActorMap(projectId: number) {
    const actors = await this.getProjectActors(projectId);
    return new Map(actors.map((actor) => [actor.userId, actor]));
  }

  async getProjectRoleNameMap(projectId: number) {
    const actors = await this.getProjectActors(projectId);
    const roleMap = new Map<number, string>();
    for (const actor of actors) {
      (actor.projectRoleIds || []).forEach((roleId, index) => {
        if (!roleMap.has(roleId)) {
          roleMap.set(
            roleId,
            actor.projectRoleNames?.[index] ||
              actor.primaryRoleLabel ||
              `Role ${roleId}`,
          );
        }
      });
    }
    return roleMap;
  }

  async getProjectActor(projectId: number, userId: number) {
    const actors = await this.getProjectActors(projectId);
    return actors.find((actor) => actor.userId === userId) || null;
  }

  async getProjectRoleIds(projectId: number, userId: number) {
    const actor = await this.getProjectActor(projectId, userId);
    return actor?.projectRoleIds || [];
  }

  async getSignerSnapshot(projectId: number, userId: number) {
    const actor = await this.getProjectActor(projectId, userId);
    if (actor) {
      return {
        displayName: actor.displayName,
        companyLabel: actor.companyLabel,
        roleLabel:
          actor.primaryRoleLabel || actor.projectRoleNames?.[0] || 'Approver',
        sourceType: actor.sourceType,
      };
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    return {
      displayName: user?.displayName || user?.username || String(userId),
      companyLabel: 'Internal Team',
      roleLabel: user?.designation || 'Approver',
      sourceType: user?.isTempUser ? 'TEMP_VENDOR' : 'PERMANENT',
    };
  }

  async getEligibleApproverOptions(projectId: number) {
    const actors = await this.getProjectActors(projectId);
    return actors.map((actor) => ({
      id: actor.userId,
      userId: actor.userId,
      name: actor.displayName,
      company: actor.companyLabel,
      role: actor.primaryRoleLabel || actor.projectRoleNames[0] || 'Approver',
      roleLabels: actor.projectRoleNames,
      sourceType: actor.sourceType,
    }));
  }
}
