import { ExceptionFilter, ArgumentsHost, NotFoundException } from '@nestjs/common';
export declare class SpaFallbackFilter implements ExceptionFilter {
    catch(exception: NotFoundException, host: ArgumentsHost): void;
}
