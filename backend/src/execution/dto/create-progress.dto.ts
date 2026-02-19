export class CreateProgressDto {
  activityId: number;
  epsNodeId: number;
  boqItemId: number;
  microActivityId?: number; // NEW: Optional micro activity link
  quantity: number;
  date: Date;
  remarks?: string;
}

export class ValidateProgressDto {
  activityId: number;
  boqItemId: number;
  microActivityId?: number;
  quantity: number;
}
