
export interface WorkOrderItem {
    id: number;
    materialCode: string;
    shortText: string;
    quantity: number;
    uom: string;
    rate: number;
    amount: number;
    longText?: string;
    level?: number;
    isParent?: boolean;
    serialNumber?: string;
    parentSerialNumber?: string | null;
    executedQuantity?: number;
}

export interface WorkOrderVendor {
    name: string;
    vendorCode: string;
}

export interface WorkOrder {
    id: number;
    projectId: number;
    woNumber: string;
    woDate: string;
    totalAmount: number | string;
    status: string;
    vendor: WorkOrderVendor;
    items: WorkOrderItem[];
}
