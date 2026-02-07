import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { WbsTemplateActivity } from './wbs-template-activity.entity';

@Entity()
export class WbsTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  templateName: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  projectType: string;

  @Column({ nullable: true })
  constructionTech: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => WbsTemplateNode, (node) => node.template)
  nodes: WbsTemplateNode[];

  @CreateDateColumn()
  createdOn: Date;
}

@Entity()
export class WbsTemplateNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  templateId: number;

  @ManyToOne(() => WbsTemplate, (template) => template.nodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template: WbsTemplate;

  @Column({ nullable: true })
  parentId: number;

  // Self-referencing link (Adjacency List)
  @ManyToOne(() => WbsTemplateNode, (node) => node.children, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: WbsTemplateNode;

  @OneToMany(() => WbsTemplateNode, (node) => node.parent)
  children: WbsTemplateNode[];

  @Column()
  wbsCode: string; // Relative code (e.g., "1", "1.1")

  @Column()
  wbsName: string;

  @Column({ default: false })
  isControlAccount: boolean;

  @OneToMany(() => WbsTemplateActivity, (activity) => activity.templateNode)
  activities: WbsTemplateActivity[];
}
