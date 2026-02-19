export class SaveMicroProgressDto {
  activityId: number;
  epsNodeId: number;
  entries: MicroProgressEntryDto[];
  date: string;
  remarks?: string;
}

export class MicroProgressEntryDto {
  boqItemId: number;
  microActivityId?: number; // NULL for direct/balance execution
  quantity: number;
}
