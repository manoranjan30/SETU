import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';
export declare enum WaterSource {
    MUNICIPAL = "MUNICIPAL",
    TANKER = "TANKER",
    BOREWELL = "BOREWELL",
    STP = "STP",
    RAINWATER = "RAINWATER"
}
export declare class EhsEnvironmental {
    id: number;
    projectId: number;
    project: EpsNode;
    date: string;
    waterDomestic: number;
    waterConstruction: number;
    waterSource: WaterSource;
    tankerCount: number;
    hazardousWaste: number;
    nonHazardousWaste: number;
    steelScrap: number;
    concreteDebris: number;
    dustControlDone: boolean;
    sprinklingFrequency: number;
    noiseLevel: number;
    pm25: number;
    pm10: number;
    dgRunHours: number;
    fuelConsumption: number;
    electricityUsage: number;
    remarks: string;
    createdById: number;
    createdBy: User;
    createdAt: Date;
    updatedAt: Date;
}
