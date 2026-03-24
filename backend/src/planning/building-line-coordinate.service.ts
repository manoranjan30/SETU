import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuildingLineCoordinate } from './entities/building-line-coordinate.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';

type RoomSnapshot = {
  roomId: number;
  roomName: string;
  roomType?: string | null;
  code?: string | null;
  coordinatesText?: string | null;
};

type UnitSnapshot = {
  unitId: number;
  unitName: string;
  code?: string | null;
  coordinatesText?: string | null;
  rooms: RoomSnapshot[];
};

type FloorSnapshot = {
  floorId: number;
  floorName: string;
  towerId?: number;
  towerName?: string;
  unitCount: number;
  roomCount: number;
  units: UnitSnapshot[];
};

@Injectable()
export class BuildingLineCoordinateService {
  constructor(
    @InjectRepository(BuildingLineCoordinate)
    private readonly coordinateRepo: Repository<BuildingLineCoordinate>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(QualityFloorStructure)
    private readonly floorStructureRepo: Repository<QualityFloorStructure>,
  ) {}

  async getStructure(projectId: number) {
    const allNodes = await this.epsRepo.find({
      order: { order: 'ASC', name: 'ASC' },
    });
    const nodeById = new Map<number, EpsNode>(allNodes.map((node) => [node.id, node]));
    const childrenMap = new Map<number, EpsNode[]>();

    for (const node of allNodes) {
      if (node.parentId == null) continue;
      const bucket = childrenMap.get(node.parentId) || [];
      bucket.push(node);
      childrenMap.set(node.parentId, bucket);
    }

    const coordinates = await this.coordinateRepo.find({
      where: { projectId },
      order: { updatedAt: 'DESC' },
    });
    const coordinateMap = new Map<number, BuildingLineCoordinate>(
      coordinates.map((coordinate) => [coordinate.epsNodeId, coordinate]),
    );

    const structures = await this.floorStructureRepo.find({
      where: { projectId },
      relations: ['floor', 'tower', 'units', 'units.rooms'],
      order: {
        tower: { order: 'ASC', name: 'ASC' },
        floor: { order: 'ASC', name: 'ASC' },
        units: { sequence: 'ASC', name: 'ASC' },
      },
    });
    const structureByFloorId = new Map<number, QualityFloorStructure>();
    for (const structure of structures) {
      structureByFloorId.set(structure.floorId, structure);
    }

    const buildFloorSnapshot = (floorNodeId: number): FloorSnapshot | null => {
      const structure = structureByFloorId.get(floorNodeId);
      if (!structure) return null;

      const floorCoordinate = coordinateMap.get(floorNodeId);
      const savedUnits = new Map<number, UnitSnapshot>(
        ((floorCoordinate?.structureSnapshot as any)?.units || []).map((unit: UnitSnapshot) => [
          unit.unitId,
          unit,
        ]),
      );

      const units = (structure.units || []).map((unit) => {
        const savedUnit = savedUnits.get(unit.id);
        const savedRooms = new Map<number, RoomSnapshot>(
          (savedUnit?.rooms || []).map((room) => [room.roomId, room]),
        );
        const rooms = (unit.rooms || [])
          .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
          .map((room) => {
            const savedRoom = savedRooms.get(room.id);
            return {
              roomId: room.id,
              roomName: room.name,
              roomType: room.roomType,
              code: room.code,
              coordinatesText: savedRoom?.coordinatesText || null,
            };
          });

        return {
          unitId: unit.id,
          unitName: unit.name,
          code: unit.code,
          coordinatesText: savedUnit?.coordinatesText || null,
          rooms,
        };
      });

      return {
        floorId: structure.floorId,
        floorName: structure.floor?.name || `Floor #${structure.floorId}`,
        towerId: structure.towerId,
        towerName: structure.tower?.name,
        unitCount: units.length,
        roomCount: units.reduce((sum, unit) => sum + unit.rooms.length, 0),
        units,
      };
    };

    const aggregateFloorSnapshots = (children: any[]): FloorSnapshot[] => {
      const floors: FloorSnapshot[] = [];
      for (const child of children) {
        if (child.type === EpsNodeType.FLOOR && child.structureSnapshot?.units) {
          floors.push({
            floorId: child.structureSnapshot.floorId || child.id,
            floorName: child.structureSnapshot.floorName || child.name,
            towerId: child.structureSnapshot.towerId,
            towerName: child.structureSnapshot.towerName,
            unitCount: child.structureSnapshot.unitCount || 0,
            roomCount: child.structureSnapshot.roomCount || 0,
            units: child.structureSnapshot.units || [],
          });
        }
        if (child.children?.length) {
          floors.push(...aggregateFloorSnapshots(child.children));
        }
      }
      return floors;
    };

    const buildNode = (node: EpsNode): any => {
      const coordinate = coordinateMap.get(node.id);
      const children = (childrenMap.get(node.id) || [])
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map(buildNode);

      let structureSnapshot: any = coordinate?.structureSnapshot || null;

      if (node.type === EpsNodeType.FLOOR) {
        const floorSnapshot = buildFloorSnapshot(node.id);
        if (floorSnapshot) {
          structureSnapshot = {
            ...floorSnapshot,
            ...((coordinate?.structureSnapshot as any) || {}),
            units: floorSnapshot.units,
            unitCount: floorSnapshot.unitCount,
            roomCount: floorSnapshot.roomCount,
          };
        }
      } else if (
        node.type === EpsNodeType.PROJECT ||
        node.type === EpsNodeType.BLOCK ||
        node.type === EpsNodeType.TOWER
      ) {
        const floors = aggregateFloorSnapshots(children);
        if (floors.length > 0) {
          structureSnapshot = {
            ...(coordinate?.structureSnapshot || {}),
            floorCount: floors.length,
            unitCount: floors.reduce((sum, floor) => sum + floor.unitCount, 0),
            roomCount: floors.reduce((sum, floor) => sum + floor.roomCount, 0),
            floors: floors.map((floor) => {
              const floorCoordinate = coordinateMap.get(floor.floorId);
              return {
                floorId: floor.floorId,
                floorName: floor.floorName,
                coordinatesText: floorCoordinate?.coordinatesText || null,
                heightMeters:
                  floorCoordinate?.heightMeters != null
                    ? Number(floorCoordinate.heightMeters)
                    : null,
                unitCount: floor.unitCount,
                roomCount: floor.roomCount,
                units: floor.units,
              };
            }),
          };
        }
      }

      return {
        id: node.id,
        name: node.name,
        type: node.type,
        coordinatesId: coordinate?.id || null,
        coordinatesText: coordinate?.coordinatesText || '',
        coordinateUom: coordinate?.coordinateUom || 'mm',
        heightMeters:
          coordinate?.heightMeters != null ? Number(coordinate.heightMeters) : null,
        customFeatures: coordinate?.customFeatures || [],
        structureSnapshot,
        children,
      };
    };

    const findProjectAncestor = (startNodeId?: number | null): EpsNode | null => {
      if (!startNodeId) return null;
      let current = nodeById.get(startNodeId) || null;
      while (current) {
        if (current.type === EpsNodeType.PROJECT) {
          return current;
        }
        current =
          current.parentId != null ? nodeById.get(current.parentId) || null : null;
      }
      return null;
    };

    let root = nodeById.get(projectId) || null;
    if (root?.type !== EpsNodeType.PROJECT) {
      root = null;
    }

    if (!root) {
      for (const structure of structures) {
        const projectRoot = findProjectAncestor(structure.towerId);
        if (projectRoot) {
          root = projectRoot;
          break;
        }
      }
    }

    if (!root) {
      for (const coordinate of coordinates) {
        const projectRoot = findProjectAncestor(coordinate.epsNodeId);
        if (projectRoot) {
          root = projectRoot;
          break;
        }
      }
    }

    if (!root) {
      throw new NotFoundException(
        'No EPS structure is linked to this project yet. Create or map the project EPS hierarchy first.',
      );
    }

    return buildNode(root);
  }

  async upsertCoordinate(
    projectId: number,
    epsNodeId: number,
    payload: {
      coordinatesText?: string | null;
      coordinateUom?: 'mm' | 'cm' | 'm' | null;
      heightMeters?: number | null;
      customFeatures?: any[] | null;
      structureSnapshot?: any;
    },
    userId?: number,
  ) {
    const node = await this.epsRepo.findOne({ where: { id: epsNodeId } });
    if (!node) {
      throw new NotFoundException('EPS node not found');
    }

    const existing = await this.coordinateRepo.findOne({
      where: { projectId, epsNodeId },
    });
    const entity =
      existing ||
      this.coordinateRepo.create({
        projectId,
        epsNodeId,
      });

    if (Object.prototype.hasOwnProperty.call(payload, 'coordinatesText')) {
      entity.coordinatesText = payload.coordinatesText ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'coordinateUom')) {
      entity.coordinateUom = (payload.coordinateUom || 'mm') as 'mm' | 'cm' | 'm';
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'heightMeters')) {
      entity.heightMeters = payload.heightMeters ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'customFeatures')) {
      entity.customFeatures = payload.customFeatures ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'structureSnapshot')) {
      entity.structureSnapshot = payload.structureSnapshot ?? null;
    }
    entity.updatedByUserId = userId ?? null;

    return this.coordinateRepo.save(entity);
  }
}
