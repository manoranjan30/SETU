import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ProjectContextGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Try Header
    let projectId = request.headers['x-project-id'];

    // 2. Try Route Param
    if (!projectId && request.params && request.params.projectId) {
      projectId = request.params.projectId;
    }

    // 3. Try Query Param
    if (!projectId && request.query && request.query.projectId) {
      projectId = request.query.projectId;
    }

    if (!projectId) {
      throw new BadRequestException(
        'Project Context Missing: projectId required in Header (x-project-id) or Path/Query',
      );
    }

    const projectIdNum = parseInt(String(projectId), 10);
    if (isNaN(projectIdNum)) {
      throw new BadRequestException('Invalid Project ID: must be a number');
    }

    // Attach to request for downstream usage
    request.projectContext = { projectId: projectIdNum };

    return true;
  }
}
