import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * PdfTemplate Entity
 *
 * Stores reusable PDF extraction templates.
 * Templates are page-agnostic: zones defined once apply to all matching pages.
 */
@Entity('pdf_templates')
export class PdfTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'custom',
  })
  category: string; // work_order, invoice, boq, custom

  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * Template configuration stored as JSONB.
   * Structure:
   * {
   *   zones: TemplateZone[],
   *   pageRules: { firstPageIndicator?, continuationIndicator? },
   *   extractionMode: 'all_pages' | 'first_only'
   * }
   */
  @Column({ type: 'jsonb', default: {} })
  templateJson: object;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
