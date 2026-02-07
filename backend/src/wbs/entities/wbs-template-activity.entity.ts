import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WbsTemplateNode } from './wbs-template.entity';

export enum TemplateActivityType {
  TASK = 'TASK',
  MILESTONE_START = 'MILESTONE_START',
  MILESTONE_FINISH = 'MILESTONE_FINISH',
  LEVEL_OF_EFFORT = 'LEVEL_OF_EFFORT',
}

@Entity()
export class WbsTemplateActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  templateNodeId: number;

  @ManyToOne(() => WbsTemplateNode, (node) => node.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_node_id' })
  templateNode: WbsTemplateNode;

  @Column()
  activityCode: string;

  @Column()
  activityName: string;

  @Column({
    type: 'enum',
    enum: TemplateActivityType,
    default: TemplateActivityType.TASK,
  })
  activityType: TemplateActivityType;

  @Column({ type: 'int', default: 0 })
  durationPlanned: number;

  @Column({ default: false })
  isMilestone: boolean;
}
