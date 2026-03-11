export interface WorkOrderItem {
  id: number;
  materialCode: string;
  description: string;
  allocatedQty: number;
  uom: string;
  rate: number;
  amount: number;
  longText?: string;
  level?: number;
  isParent?: boolean;
  serialNumber?: string;
  parentSerialNumber?: string | null;
  executedQuantity?: number;
  boqQty?: number;
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
  orderType?: string;
  orderAmendNo?: string;
  projectCode?: string;
  scopeOfWork?: string;
  vendor: WorkOrderVendor;
  items: WorkOrderItem[];
}
