import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';

@Entity('building_line_coordinates')
@Unique('UQ_building_line_coordinates_project_eps', ['projectId', 'epsNodeId'])
export class BuildingLineCoordinate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'int' })
  epsNodeId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  @Column({ type: 'text', nullable: true })
  coordinatesText: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  heightMeters: number | null;

  @Column({ type: 'jsonb', nullable: true })
  customFeatures:
    | Array<{
        id: string;
        type: 'FLOOR' | 'ELEVATION' | 'CUSTOM';
        name: string;
        coordinatesText?: string | null;
        heightMeters?: number | null;
        inheritFromBelow?: boolean;
      }>
    | null;

  @Column({ type: 'jsonb', nullable: true })
  structureSnapshot:
    | {
        floorId?: number;
        floorName?: string;
        towerId?: number;
        towerName?: string;
        floorCount?: number;
        unitCount?: number;
        roomCount?: number;
        units?: Array<{
          unitId: number;
          unitName: string;
          code?: string | null;
          coordinatesText?: string | null;
          rooms: Array<{
            roomId: number;
            roomName: string;
            roomType?: string | null;
            code?: string | null;
            coordinatesText?: string | null;
          }>;
        }>;
        floors?: Array<{
          floorId: number;
          floorName: string;
          coordinatesText?: string | null;
          heightMeters?: number | null;
          unitCount?: number;
          roomCount?: number;
          units: Array<{
            unitId: number;
            unitName: string;
            code?: string | null;
            coordinatesText?: string | null;
            rooms: Array<{
              roomId: number;
              roomName: string;
              roomType?: string | null;
              code?: string | null;
              coordinatesText?: string | null;
            }>;
          }>;
        }>;
      }
    | null;

  @Column({ type: 'int', nullable: true })
  updatedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
