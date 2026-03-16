import api from "../api/axios";

export type BuildingLineNode = {
  id: number;
  name: string;
  type: string;
  coordinatesId: number | null;
  coordinatesText: string;
  heightMeters: number | null;
  structureSnapshot?: {
    floorCount?: number;
    unitCount?: number;
    roomCount?: number;
    floors?: Array<{
      floorId: number;
      floorName: string;
      units: Array<{
        unitId: number;
        unitName: string;
        rooms: Array<{
          roomId: number;
          roomName: string;
          roomType?: string | null;
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
