import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { QualityFloorStructure } from './entities/quality-floor-structure.entity';
import { QualityUnit } from './entities/quality-unit.entity';
import { QualityRoom } from './entities/quality-room.entity';

export interface BuildPreviewDto {
  unitCount: number;
  naming: {
    prefix: string;
    startNumber: number;
    increment?: number;
    pad?: number;
  };
  defaultRooms?: Array<{ name: string; roomType?: string }>;
}

export interface ApplyBuildDto {
  replaceExisting?: boolean;
  units: Array<{
    name: string;
    code?: string;
    rooms: Array<{ name: string; code?: string; roomType?: string }>;
  }>;
}

export interface CopyFloorStructureDto {
  sourceFloorId: number;
  targetFloorIds: number[];
  collisionMode?: 'REPLACE' | 'SKIP' | 'FAIL';
  naming?: {
    mode?: 'KEEP' | 'FLOOR_PREFIX_REMAP' | 'REPLACE_PREFIX';
    sourcePrefix?: string;
  };
}

export interface UpdateUnitDto {
  name?: string;
  code?: string;
}

export interface CreateRoomDto {
  name: string;
  code?: string;
  roomType?: string;
}

export interface UpdateRoomDto {
  name?: string;
  code?: string;
  roomType?: string;
}

@Injectable()
export class QualityStructureService {
  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(QualityFloorStructure)
    private readonly floorStructureRepo: Repository<QualityFloorStructure>,
    @InjectRepository(QualityUnit)
    private readonly unitRepo: Repository<QualityUnit>,
    @InjectRepository(QualityRoom)
    private readonly roomRepo: Repository<QualityRoom>,
  ) {}

  async getFloorStructure(projectId: number, floorId: number) {
    const structure = await this.floorStructureRepo.findOne({
      where: { projectId, floorId },
      relations: ['units', 'units.rooms'],
      order: {
        units: { sequence: 'ASC' },
      } as any,
    });

    if (!structure) {
      return {
        floorId,
        projectId,
        units: [],
      };
    }

    for (const unit of structure.units || []) {
      unit.rooms = [...(unit.rooms || [])].sort(
        (a, b) => a.sequence - b.sequence,
      );
    }

    return structure;
  }

  previewBuild(floorId: number, dto: BuildPreviewDto) {
    if (!dto.unitCount || dto.unitCount <= 0) {
      throw new BadRequestException('unitCount must be > 0');
    }

    const increment = dto.naming.increment ?? 1;
    const pad = dto.naming.pad ?? 0;
    const defaultRooms = dto.defaultRooms || [];

    const units = Array.from({ length: dto.unitCount }, (_, idx) => {
      const serial = dto.naming.startNumber + idx * increment;
      const serialText =
        pad > 0 ? String(serial).padStart(pad, '0') : String(serial);
      const name = `${dto.naming.prefix}${serialText}`;
      return {
        index: idx + 1,
        name,
        rooms: defaultRooms.map((r) => ({
          name: r.name,
          roomType: r.roomType || null,
        })),
      };
    });

    return {
      floorId,
      unitCount: dto.unitCount,
      naming: {
        ...dto.naming,
        increment,
        pad,
      },
      units,
    };
  }

  async applyBuild(floorId: number, dto: ApplyBuildDto) {
    if (!dto.units?.length) {
      throw new BadRequestException('At least one unit is required');
    }

    const { projectId, towerId } =
      await this.resolveProjectAndTowerForFloor(floorId);

    let floorStructure = await this.floorStructureRepo.findOne({
      where: { projectId, floorId },
    });

    if (!floorStructure) {
      floorStructure = await this.floorStructureRepo.save(
        this.floorStructureRepo.create({ projectId, towerId, floorId }),
      );
    }

    if (dto.replaceExisting !== false) {
      await this.unitRepo.delete({ floorStructureId: floorStructure.id });
    }

    const existingCount = await this.unitRepo.count({
      where: { floorStructureId: floorStructure.id },
    });

    for (let i = 0; i < dto.units.length; i++) {
      const unitInput = dto.units[i];
      if (!unitInput.name?.trim()) {
        throw new BadRequestException(`Unit name missing at row ${i + 1}`);
      }

      const savedUnit = await this.unitRepo.save(
        this.unitRepo.create({
          floorStructureId: floorStructure.id,
          name: unitInput.name.trim(),
          code: unitInput.code?.trim() || undefined,
          sequence: existingCount + i,
        }),
      );

      const rooms = (unitInput.rooms || []).filter((r) => r.name?.trim());
      if (rooms.length > 0) {
        await this.roomRepo.save(
          rooms.map((room, idx) =>
            this.roomRepo.create({
              unitId: savedUnit.id,
              name: room.name.trim(),
              code: room.code?.trim() || undefined,
              roomType: room.roomType?.trim() || undefined,
              sequence: idx,
            }),
          ),
        );
      }
    }

    return this.getFloorStructure(projectId, floorId);
  }

  async copyFloorStructure(dto: CopyFloorStructureDto) {
    if (!dto.targetFloorIds?.length) {
      throw new BadRequestException('targetFloorIds must not be empty');
    }

    const sourceMeta = await this.resolveProjectAndTowerForFloor(
      dto.sourceFloorId,
    );
    const sourceFloorNode = await this.epsRepo.findOne({
      where: { id: dto.sourceFloorId },
    });

    const sourceStructure = await this.floorStructureRepo.findOne({
      where: { projectId: sourceMeta.projectId, floorId: dto.sourceFloorId },
      relations: ['units', 'units.rooms'],
    });

    if (!sourceStructure) {
      throw new NotFoundException(
        'No quality structure exists on source floor',
      );
    }

    const collisionMode = dto.collisionMode || 'REPLACE';
    const namingMode = dto.naming?.mode || 'FLOOR_PREFIX_REMAP';

    const copiedTo: number[] = [];
    const skipped: number[] = [];

    for (const targetFloorId of dto.targetFloorIds) {
      const targetMeta =
        await this.resolveProjectAndTowerForFloor(targetFloorId);
      const targetFloorNode = await this.epsRepo.findOne({
        where: { id: targetFloorId },
      });

      let targetStructure = await this.floorStructureRepo.findOne({
        where: { projectId: targetMeta.projectId, floorId: targetFloorId },
      });

      if (!targetStructure) {
        targetStructure = await this.floorStructureRepo.save(
          this.floorStructureRepo.create({
            projectId: targetMeta.projectId,
            towerId: targetMeta.towerId,
            floorId: targetFloorId,
          }),
        );
      }

      const targetHasUnits =
        (await this.unitRepo.count({
          where: { floorStructureId: targetStructure.id },
        })) > 0;

      if (targetHasUnits) {
        if (collisionMode === 'SKIP') {
          skipped.push(targetFloorId);
          continue;
        }
        if (collisionMode === 'FAIL') {
          throw new BadRequestException(
            `Target floor ${targetFloorId} already has units configured`,
          );
        }
        await this.unitRepo.delete({ floorStructureId: targetStructure.id });
      }

      for (const sourceUnit of sourceStructure.units || []) {
        const mappedUnitName = this.mapUnitName(
          sourceUnit.name,
          namingMode,
          sourceFloorNode?.name || '',
          targetFloorNode?.name || '',
          dto.naming?.sourcePrefix,
        );

        const newUnit = await this.unitRepo.save(
          this.unitRepo.create({
            floorStructureId: targetStructure.id,
            name: mappedUnitName,
            code: sourceUnit.code,
            sequence: sourceUnit.sequence,
          }),
        );

        const sourceRooms = [...(sourceUnit.rooms || [])].sort(
          (a, b) => a.sequence - b.sequence,
        );
        if (sourceRooms.length > 0) {
          await this.roomRepo.save(
            sourceRooms.map((room) =>
              this.roomRepo.create({
                unitId: newUnit.id,
                name: room.name,
                code: room.code,
                roomType: room.roomType,
                sequence: room.sequence,
              }),
            ),
          );
        }
      }

      copiedTo.push(targetFloorId);
    }

    return {
      sourceFloorId: dto.sourceFloorId,
      copiedTo,
      skipped,
      collisionMode,
      namingMode,
    };
  }

  async renameNode(id: number, newName: string) {
    const unit = await this.unitRepo.findOne({ where: { id } });
    if (unit) {
      unit.name = newName;
      return this.unitRepo.save(unit);
    }

    const room = await this.roomRepo.findOne({ where: { id } });
    if (room) {
      room.name = newName;
      return this.roomRepo.save(room);
    }

    throw new NotFoundException('Quality structure node not found');
  }

  async updateUnit(unitId: number, dto: UpdateUnitDto) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');

    if (typeof dto.name === 'string') unit.name = dto.name.trim();
    if (typeof dto.code === 'string') unit.code = dto.code.trim() || null;

    return this.unitRepo.save(unit);
  }

  async deleteUnit(unitId: number) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    await this.unitRepo.remove(unit);
    return { success: true };
  }

  async createRoom(unitId: number, dto: CreateRoomDto) {
    const unit = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unit not found');
    if (!dto.name?.trim())
      throw new BadRequestException('Room name is required');

    const maxSeq = await this.roomRepo
      .createQueryBuilder('room')
      .select('MAX(room.sequence)', 'max')
      .where('room.unitId = :unitId', { unitId })
      .getRawOne<{ max: number | string | null }>();

    const nextSeq = (Number(maxSeq?.max) || 0) + 1;

    const room = this.roomRepo.create({
      unitId,
      name: dto.name.trim(),
      code: dto.code?.trim() || undefined,
      roomType: dto.roomType?.trim() || undefined,
      sequence: nextSeq,
    });
    return this.roomRepo.save(room);
  }

  async updateRoom(roomId: number, dto: UpdateRoomDto) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    if (typeof dto.name === 'string') room.name = dto.name.trim();
    if (typeof dto.code === 'string') room.code = dto.code.trim() || null;
    if (typeof dto.roomType === 'string')
      room.roomType = dto.roomType.trim() || null;

    return this.roomRepo.save(room);
  }

  async deleteRoom(roomId: number) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    await this.roomRepo.remove(room);
    return { success: true };
  }

  private mapUnitName(
    sourceUnitName: string,
    mode: 'KEEP' | 'FLOOR_PREFIX_REMAP' | 'REPLACE_PREFIX',
    sourceFloorName: string,
    targetFloorName: string,
    sourcePrefix?: string,
  ) {
    if (mode === 'KEEP') return sourceUnitName;

    if (mode === 'REPLACE_PREFIX' && sourcePrefix) {
      const sourceFloorPrefix = this.extractNumberToken(sourceFloorName);
      const targetFloorPrefix = this.extractNumberToken(targetFloorName);
      if (!sourceFloorPrefix || !targetFloorPrefix) return sourceUnitName;
      if (sourceUnitName.startsWith(sourcePrefix)) {
        return `${targetFloorPrefix}${sourceUnitName.slice(sourcePrefix.length)}`;
      }
      return sourceUnitName;
    }

    // FLOOR_PREFIX_REMAP: 101 -> 201, 1001 -> 2001, if unit name is numeric.
    if (/^\d+$/.test(sourceUnitName)) {
      const sourceFloorNo = this.extractNumberToken(sourceFloorName);
      const targetFloorNo = this.extractNumberToken(targetFloorName);
      if (!sourceFloorNo || !targetFloorNo) return sourceUnitName;

      if (sourceUnitName.startsWith(sourceFloorNo)) {
        return `${targetFloorNo}${sourceUnitName.slice(sourceFloorNo.length)}`;
      }
    }

    return sourceUnitName;
  }

  private extractNumberToken(text: string): string | null {
    const m = text?.match(/\d+/);
    return m?.[0] || null;
  }

  private async resolveProjectAndTowerForFloor(floorId: number) {
    const floor = await this.epsRepo.findOne({ where: { id: floorId } });
    if (!floor || floor.type !== EpsNodeType.FLOOR) {
      throw new BadRequestException('Invalid floor node');
    }

    const tower = await this.epsRepo.findOne({ where: { id: floor.parentId } });
    if (!tower || tower.type !== EpsNodeType.TOWER) {
      throw new BadRequestException('Floor is not under a tower');
    }

    const projectId = await this.findAncestorByType(
      tower.id,
      EpsNodeType.PROJECT,
    );
    if (!projectId) {
      throw new BadRequestException('Project ancestor not found for floor');
    }

    return { projectId, towerId: tower.id };
  }

  private async findAncestorByType(
    nodeId: number,
    type: EpsNodeType,
  ): Promise<number | null> {
    let current = await this.epsRepo.findOne({ where: { id: nodeId } });
    while (current) {
      if (current.type === type) return current.id;
      if (!current.parentId) return null;
      current = await this.epsRepo.findOne({ where: { id: current.parentId } });
    }
    return null;
  }
}
