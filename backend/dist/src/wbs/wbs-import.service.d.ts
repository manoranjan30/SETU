export declare class WbsImportService {
    parseAndPreview(fileBuffer: Buffer): Promise<any[]>;
    private parseXml;
    validateHierarchy(data: any[]): {
        isValid: boolean;
        errors: string[];
    };
}
