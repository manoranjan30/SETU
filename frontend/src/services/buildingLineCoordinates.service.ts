import api from "../api/axios";

export type BuildingLineNode = {
  id: number;
  name: string;
  type: string;
  coordinatesId: number | null;
  coordinatesText: string;
  coordinateUom: "mm" | "cm" | "m";
  heightMeters: number | null;
  customFeatures?: Array<{
    id: string;
    type: "FLOOR" | "ELEVATION" | "CUSTOM";
    name: string;
    coordinatesText?: string | null;
    heightMeters?: number | null;
    inheritFromBelow?: boolean;
  }>;
  structureSnapshot?: {
    floorId?: number;
    floorName?: string;
    towerId?: number;
    towerName?: string;
    floorCount?: number;
    unitCount?: number;
    roomCount?: number;
    units?: Array<{
      unitId: number;
      unitName: string;
      code?: string | null;
      coordinatesText?: string | null;
      rooms: Array<{
        roomId: number;
        roomName: string;
        roomType?: string | null;
        code?: string | null;
        coordinatesText?: string | null;
      }>;
    }>;
    floors?: Array<{
      floorId: number;
      floorName: string;
      coordinatesText?: string | null;
      heightMeters?: number | null;
      unitCount?: number;
      roomCount?: number;
      units: Array<{
        unitId: number;
        unitName: string;
        code?: string | null;
        coordinatesText?: string | null;
        rooms: Array<{
          roomId: number;
          roomName: string;
          roomType?: string | null;
          code?: string | null;
          coordinatesText?: string | null;
        }>;
      }>;
    }>;
  } | null;
  children: BuildingLineNode[];
};

export type TowerProgressFloor = {
  epsNodeId: number;
  floorName: string;
  floorIndex: number;
  progressPct: number;
  totalActivities: number;
  completedActivities: number;
  pendingActivities: number;
  inProgressActivities: number;
  openQualityObs: number;
  openEhsObs: number;
  pendingRfis: number;
  rejectedRfis: number;
  hasActiveWork: boolean;
  activities?: Array<{
    id: number;
    activityCode: string;
    activityName: string;
    status: string;
    progressPct: number;
    budgetedValue?: number;
    actualValue?: number;
    startDatePlanned: string | null;
    finishDatePlanned: string | null;
    schedulePath?: string[];
  }>;
};

export type TowerProgressTower = {
  epsNodeId: number;
  towerName: string;
  floors: TowerProgressFloor[];
};

export type TowerProgressResponse = {
  towers: TowerProgressTower[];
};

export const buildingLineCoordinatesService = {
  async getStructure(projectId: number): Promise<BuildingLineNode> {
    const res = await api.get(`/planning/${projectId}/building-line-coordinates`);
    return res.data;
  },

  async getTowerProgress(projectId: number): Promise<TowerProgressResponse> {
    const res = await api.get(`/planning/${projectId}/tower-progress`);
    return res.data;
  },

  async saveNode(
    projectId: number,
    epsNodeId: number,
    payload: {
      coordinatesText?: string | null;
      coordinateUom?: "mm" | "cm" | "m" | null;
      heightMeters?: number | null;
      customFeatures?: any[] | null;
      structureSnapshot?: any;
    },
  ) {
    const res = await api.put(
      `/planning/${projectId}/building-line-coordinates/${epsNodeId}`,
      payload,
    );
    return res.data;
  },
};
