import { Injectable } from '@nestjs/common';
import { DataSourceRegistryService } from './data-source-registry.service';
import { QueryConfig } from './data-sources/base.data-source';

@Injectable()
export class QueryExecutorService {
  constructor(private readonly registry: DataSourceRegistryService) {}

  async executeQuery(sourceKey: string, config: QueryConfig): Promise<any[]> {
    const source = this.registry.get(sourceKey);
    return source.execute(config);
  }

  async validateAndExecute(sourceKey: string, config: QueryConfig) {
    // Basic validation here
    // In actual implementation, we'd ensure users can't fetch fields they aren't supposed to
    return this.executeQuery(sourceKey, config);
  }
}
