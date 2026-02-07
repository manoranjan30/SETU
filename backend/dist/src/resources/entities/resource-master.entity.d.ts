export declare enum ResourceType {
    MATERIAL = "MATERIAL",
    LABOR = "LABOR",
    PLANT = "PLANT",
    SUBCONTRACT = "SUBCONTRACT",
    OTHER = "OTHER"
}
export declare class ResourceMaster {
    id: number;
    resourceCode: string;
    resourceName: string;
    uom: string;
    resourceType: ResourceType;
    standardRate: number;
    category: string;
    specification: string;
    currency: string;
    createdOn: Date;
    updatedOn: Date;
}
