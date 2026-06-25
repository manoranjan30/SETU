import {
  IsIn,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
} from 'class-validator';

export class CreateTempUserDto {
  @IsNumber()
  vendorId: number;

  @IsNumber()
  workOrderId: number;

  @IsNumber()
  projectId: number;

  @IsNumber()
  templateId: number;

  @IsNumber()
  @IsOptional()
  @IsIn([1, 2])
  vendorApprovalRoleLevel?: number;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  isActive?: boolean;
}
