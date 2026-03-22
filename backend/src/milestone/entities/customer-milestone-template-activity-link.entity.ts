import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Activity } from '../../wbs/entities/activity.entity';
import { CustomerMilestoneTemplate } from './customer-milestone-template.entity';

@Entity('customer_milestone_template_activity_link')
@Unique('UQ_customer_milestone_template_activity', ['templateId', 'activityId'])
export class CustomerMilestoneTemplateActivityLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id', type: 'int' })
  templateId: number;

  @ManyToOne(() => CustomerMilestoneTemplate, (template) => template.activityLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: CustomerMilestoneTemplate;

  @Column({ name: 'activity_id', type: 'int' })
  activityId: number;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ name: 'sequence', type: 'int', default: 0 })
  sequence: number;
}
