import {
  Injectable,
  OnModuleInit,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { IDataSource } from './data-sources/base.data-source';
import { ActivityListSource } from './data-sources/activity-list.source';
import { BoqBurnSource } from './data-sources/boq-burn.source';
import { LaborDailySource } from './data-sources/labor-daily.source';
import { ProgressDailySource } from './data-sources/progress-daily.source';
import { ProjectPortfolioSource } from './data-sources/project-portfolio.source';

@Injectable()
export class DataSourceRegistryService implements OnModuleInit {
  private readonly logger = new Logger(DataSourceRegistryService.name);
  private sources: Map<string, IDataSource> = new Map();

  constructor(
    @Optional()
    @Inject(ActivityListSource)
    private activityList?: ActivityListSource,
    @Optional() @Inject(BoqBurnSource) private boqBurn?: BoqBurnSource,
    @Optional() @Inject(LaborDailySource) private laborDaily?: LaborDailySource,
    @Optional()
    @Inject(ProgressDailySource)
    private progressDaily?: ProgressDailySource,
    @Optional()
    @Inject(ProjectPortfolioSource)
    private projectPortfolio?: ProjectPortfolioSource,
  ) {}

  onModuleInit() {
    // Auto-register all injected data sources
    const builtInSources: (IDataSource | undefined)[] = [
      this.activityList,
      this.boqBurn,
      this.laborDaily,
      this.progressDaily,
      this.projectPortfolio,
    ];

    for (const source of builtInSources) {
      if (source) {
        this.register(source);
      }
    }

    this.logger.log(
      `Data Source Registry initialized with ${this.sources.size} source(s).`,
    );
  }

  register(source: IDataSource) {
    if (this.sources.has(source.key)) {
      this.logger.warn(
        `Data source "${source.key}" already registered. Overwriting.`,
      );
    }
    this.sources.set(source.key, source);
    this.logger.log(`Registered: ${source.key} (${source.label})`);
  }

  get(key: string): IDataSource {
    const source = this.sources.get(key);
    if (!source) {
      throw new Error(`Data source '${key}' not found in registry.`);
    }
    return source;
  }

  getAll(): IDataSource[] {
    return Array.from(this.sources.values());
  }

  /** Returns metadata (key, label, fields, filters) without executing queries */
  getAllMeta() {
    return this.getAll().map((s) => ({
      key: s.key,
      label: s.label,
      module: s.module,
      scope: s.scope,
      fields: s.fields,
      filters: s.filters,
    }));
  }

  has(key: string): boolean {
    return this.sources.has(key);
  }
}
