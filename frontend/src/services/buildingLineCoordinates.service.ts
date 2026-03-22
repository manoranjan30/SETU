import api from "../api/axios";

export type BuildingLineNode = {
  id: number;
  name: string;
  type: string;
  coordinatesId: number | null;
  coordinatesText: string;
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

export const buildingLineCoordinatesService = {
  async getStructure(projectId: number): Promise<BuildingLineNode> {
    const res = await api.get(`/planning/${projectId}/building-line-coordinates`);
    return res.data;
  },

  async saveNode(
    projectId: number,
    epsNodeId: number,
    payload: {
      coordinatesText?: string | null;
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
