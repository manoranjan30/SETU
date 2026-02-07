import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { EpsNodeType } from '../eps.entity';

export class CreateEpsNodeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(EpsNodeType)
  type: EpsNodeType;

  @IsNumber()
  @IsOptional()
  parentId?: number;

  @IsNumber()
  @IsOptional()
  order?: number;
}
