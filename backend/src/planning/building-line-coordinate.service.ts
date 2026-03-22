import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuildingLineCoordinate } from './entities/building-line-coordinate.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';

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

    const structuresByTower = new Map<number, QualityFloorStructure[]>();
    for (const structure of structures) {
      const bucket = structuresByTower.get(structure.towerId) || [];
      bucket.push(structure);
      structuresByTower.set(structure.towerId, bucket);
    }

    const buildNode = (node: EpsNode): any => {
      const coordinate = coordinateMap.get(node.id);
      const children = (childrenMap.get(node.id) || [])
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map(buildNode);
      const towerStructures =
        node.type === EpsNodeType.TOWER ? structuresByTower.get(node.id) || [] : [];

      const structureSnapshot =
        coordinate?.structureSnapshot ||
        (node.type === EpsNodeType.TOWER
          ? {
              floorCount: towerStructures.length,
              unitCount: towerStructures.reduce(
                (sum, floor) => sum + (floor.units?.length || 0),
                0,
              ),
              roomCount: towerStructures.reduce(
                (sum, floor) =>
                  sum +
                  (floor.units || []).reduce(
                    (unitSum, unit) => unitSum + (unit.rooms?.length || 0),
                    0,
                  ),
                0,
              ),
              floors: towerStructures.map((floor) => ({
                floorId: floor.floorId,
                floorName: floor.floor?.name || `Floor #${floor.floorId}`,
                units: (floor.units || []).map((unit) => ({
                  unitId: unit.id,
                  unitName: unit.name,
                  rooms: (unit.rooms || []).map((room) => ({
                    roomId: room.id,
                    roomName: room.name,
                    roomType: room.roomType,
                  })),
                })),
              })),
            }
          : null);

      return {
        id: node.id,
        name: node.name,
        type: node.type,
        coordinatesId: coordinate?.id || null,
        coordinatesText: coordinate?.coordinatesText || '',
        heightMeters:
          coordinate?.heightMeters != null
            ? Number(coordinate.heightMeters)
            : null,
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

    entity.coordinatesText =
      payload.coordinatesText != null ? payload.coordinatesText : entity.coordinatesText;
    entity.heightMeters =
      payload.heightMeters != null ? payload.heightMeters : entity.heightMeters;
    entity.customFeatures =
      payload.customFeatures != null
        ? payload.customFeatures
        : entity.customFeatures;
    entity.structureSnapshot =
      payload.structureSnapshot != null
        ? payload.structureSnapshot
        : entity.structureSnapshot;
    entity.updatedByUserId = userId ?? null;

    return this.coordinateRepo.save(entity);
  }
}
