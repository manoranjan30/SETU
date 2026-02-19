import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PdfTemplate } from './entities/pdf-template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplateBuilderService {
  constructor(
    @InjectRepository(PdfTemplate)
    private readonly templateRepo: Repository<PdfTemplate>,
  ) {}

  async findAll(): Promise<PdfTemplate[]> {
    return this.templateRepo.find({
      order: { updatedAt: 'DESC' },
    });
  }

  async findByCategory(category: string): Promise<PdfTemplate[]> {
    return this.templateRepo.find({
      where: { category, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<PdfTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return template;
  }

  async create(dto: CreateTemplateDto): Promise<PdfTemplate> {
    const template = this.templateRepo.create({
      name: dto.name,
      category: dto.category || 'custom',
      description: dto.description,
      templateJson: dto.templateJson || {
        zones: [],
        extractionMode: 'all_pages',
      },
    });
    return this.templateRepo.save(template);
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<PdfTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, dto);
    return this.templateRepo.save(template);
  }

  async delete(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepo.remove(template);
  }

  /**
   * Export template as JSON object (for download)
   */
  async exportAsJson(id: string): Promise<object> {
    const template = await this.findOne(id);
    return {
      $schema: 'setu-template-v1',
      meta: {
        name: template.name,
        category: template.category,
        description: template.description,
        exportedAt: new Date().toISOString(),
      },
      ...template.templateJson,
    };
  }

  /**
   * Import template from JSON object
   */
  async importFromJson(data: any): Promise<PdfTemplate> {
    const name = data.meta?.name || 'Imported Template';
    const category = data.meta?.category || 'custom';
    const description = data.meta?.description || '';

    // Remove meta from templateJson
    const { meta, $schema, ...templateJson } = data;

    const template = this.templateRepo.create({
      name: `${name} (Imported)`,
      category,
      description,
      templateJson,
    });
    return this.templateRepo.save(template);
  }
}
