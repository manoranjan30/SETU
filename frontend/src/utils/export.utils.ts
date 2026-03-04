import { utils, writeFile } from 'xlsx';
import Papa from 'papaparse';

/**
 * Basic export utility for Dashboard widgets and reports
 */
export const exportUtils = {
    /**
     * Export data to Excel (.xlsx)
     */
    toExcel: (data: any[], fileName: string, sheetName: string = 'Data') => {
        try {
            const worksheet = utils.json_to_sheet(data);
            const workbook = utils.book_new();
            utils.book_append_sheet(workbook, worksheet, sheetName);
            writeFile(workbook, `${fileName}.xlsx`);
        } catch (err) {
            console.error('Excel export failed', err);
        }
    },

    /**
     * Export data to CSV (.csv)
     */
    toCsv: (data: any[], fileName: string) => {
        try {
            const csv = Papa.unparse(data);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${fileName}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('CSV export failed', err);
        }
    },

    /**
     * Triggers browser print dialog for PDF generation
     */
    toPdf: () => {
        window.print();
    }
};
