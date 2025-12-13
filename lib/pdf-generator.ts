import { jsPDF } from 'jspdf';

export interface ReportData {
  Header?: {
    ReportBasis?: string;
    Currency?: string;
    StartPeriod?: string;
    EndPeriod?: string;
    Option?: Array<{
      Name?: string;
      Value?: string;
    }>;
  };
  Rows?: {
    Row?: Array<{
      ColData?: Array<{
        value?: string;
      }>;
    }>;
  };
  Columns?: {
    Column?: Array<{
      ColTitle?: string;
    }>;
  };
}

/**
 * Generate PDF from report data
 */
export function generatePDFFromReportData(
  reportData: ReportData,
  startDate: string,
  endDate: string
): Uint8Array {
  const doc = new jsPDF();
  
  // Debug: Log data structure
  console.log('PDF Generation - Report Data:', JSON.stringify(reportData, null, 2));
  console.log('PDF Generation - Rows:', reportData.Rows?.Row?.length || 0);
  console.log('PDF Generation - Columns:', reportData.Columns?.Column?.length || 0);
  
  // Set up page
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Profit & Loss Report', pageWidth / 2, yPosition, {
    align: 'center',
  });
  yPosition += 10;

  // Period
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Period: ${startDate} to ${endDate}`,
    pageWidth / 2,
    yPosition,
    { align: 'center' }
  );
  yPosition += 10;

  // Header information
  const header = reportData.Header || {};
  const hasNoData = header.Option?.some((opt: any) => opt.Name === 'NoReportData' && opt.Value === 'true');
  
  if (hasNoData) {
    yPosition += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128); // Gray color
    doc.text('Note: No transaction data available for this period', margin, yPosition);
    doc.setTextColor(0, 0, 0); // Reset to black
    yPosition += 10;
  }
  
  if (header.ReportBasis || header.Currency) {
    yPosition += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (header.ReportBasis) {
      doc.text(`Report Basis: ${header.ReportBasis}`, margin, yPosition);
      yPosition += 7;
    }
    if (header.Currency) {
      doc.text(`Currency: ${header.Currency}`, margin, yPosition);
      yPosition += 10;
    }
  }

  // Table data - handle QuickBooks P&L report structure
  // Rows can have: Header.ColData, Summary.ColData, or direct ColData
  // They can also have nested Rows.Row arrays
  interface ProcessedRow {
    ColData: Array<{ value?: string }>;
    isSection?: boolean;
    isSummary?: boolean;
    indent?: number;
  }
  
  const rows: ProcessedRow[] = [];
  
  // Flatten nested rows structure and handle Header/Summary
  const processRows = (rowArray: any[], indentLevel: number = 0) => {
    if (!Array.isArray(rowArray)) {
      console.warn('PDF Generation - rowArray is not an array:', typeof rowArray);
      return;
    }
    
    rowArray.forEach((row, idx) => {
      // Handle Header (section headers)
      if (row.Header?.ColData && Array.isArray(row.Header.ColData)) {
        const headerRow: ProcessedRow = {
          ColData: row.Header.ColData,
          isSection: true,
          indent: indentLevel,
        };
        rows.push(headerRow);
      }
      
      // Handle direct ColData (regular data rows)
      if (row.ColData && Array.isArray(row.ColData) && row.ColData.length > 0) {
        rows.push({
          ColData: row.ColData,
          indent: indentLevel,
        });
      }
      
      // Handle Summary (section summaries)
      if (row.Summary?.ColData && Array.isArray(row.Summary.ColData)) {
        const summaryRow: ProcessedRow = {
          ColData: row.Summary.ColData,
          isSummary: true,
          indent: indentLevel,
        };
        rows.push(summaryRow);
      }
      
      // Process nested rows (increase indent)
      if (row.Rows?.Row && Array.isArray(row.Rows.Row)) {
        processRows(row.Rows.Row, indentLevel + 1);
      }
    });
  };
  
  // Check data structure
  console.log('PDF Generation - reportData.Rows:', reportData.Rows);
  console.log('PDF Generation - reportData.Rows?.Row:', reportData.Rows?.Row);
  console.log('PDF Generation - reportData.Columns:', reportData.Columns);
  
  if (reportData.Rows?.Row && Array.isArray(reportData.Rows.Row)) {
    processRows(reportData.Rows.Row);
  } else {
    console.warn('PDF Generation - No valid Rows.Row array found');
  }
  
  const columns = reportData.Columns?.Column || [];
  
  console.log('PDF Generation - Processed Rows:', rows.length);
  console.log('PDF Generation - Processed Columns:', columns.length);
  
  // Log sample row data
  if (rows.length > 0) {
    console.log('PDF Generation - Sample Row:', JSON.stringify(rows[0], null, 2));
  }

  if (rows.length > 0) {
    yPosition += 5;
    
    // Table settings
    const colWidths: number[] = [];
    // Determine number of columns from the first row with data
    let maxCols = columns.length;
    rows.forEach(row => {
      if (row.ColData && row.ColData.length > maxCols) {
        maxCols = row.ColData.length;
      }
    });
    
    // If we have actual data columns, use them; otherwise use a single column for account names
    const numCols = Math.max(maxCols, 1);
    const availableWidth = pageWidth - 2 * margin;
    
    // Calculate column widths
    if (numCols === 1) {
      // Single column for account names only
      colWidths.push(availableWidth);
    } else {
      // First column wider for account names, rest for amounts
      colWidths.push(availableWidth * 0.4); // First column (account names)
      const remainingWidth = availableWidth * 0.6;
      const otherColWidth = remainingWidth / (numCols - 1);
      for (let i = 1; i < numCols; i++) {
        colWidths.push(otherColWidth);
      }
    }

    // Table header - always show header for clarity
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    let xPosition = margin;
    
    // Show column headers
    if (numCols === 1) {
      // Single column - just show "Account"
      doc.text('Account', xPosition, yPosition);
    } else {
      // Multiple columns - show all column titles
      for (let i = 0; i < numCols; i++) {
        const colTitle = i < columns.length && columns[i].ColTitle 
          ? columns[i].ColTitle 
          : i === 0 ? 'Account' : '';
        if (colTitle || i === 0) {
          doc.text(colTitle || (i === 0 ? 'Account' : ''), xPosition, yPosition);
        }
        xPosition += colWidths[i] || 0;
      }
    }
    yPosition += 8;

    // Draw line under header
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 3;

    // Table rows
    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (yPosition > pageHeight - margin - 10) {
        doc.addPage();
        yPosition = margin;
      }

      const colData = row.ColData || [];
      
      if (colData.length === 0) {
        // Skip empty rows
        return;
      }
      
      // Set font style based on row type (font size is consistent)
      if (row.isSection) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
      } else if (row.isSummary) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }
      
      // Initialize xPosition for each row
      let xPosition = margin;
      
      // Add indent for nested rows
      if (row.indent && row.indent > 0) {
        xPosition += row.indent * 10;
      }
      
      // Handle case where ColData might have fewer items than columns
      // QuickBooks sometimes returns only account names without amounts
      colData.forEach((cell, index) => {
        if (index < colWidths.length) {
          const value = cell?.value || '';
          if (value) {
            // Truncate long text
            const maxWidth = colWidths[index] - 2 - (row.indent ? row.indent * 10 : 0);
            const text = doc.splitTextToSize(value, maxWidth);
            doc.text(text, xPosition, yPosition);
          }
          xPosition += colWidths[index] || 0;
        }
      });
      
      // If there are more columns than ColData items, fill remaining columns with empty space
      // This handles cases where only account names are provided without amounts
      for (let i = colData.length; i < colWidths.length; i++) {
        xPosition += colWidths[i] || 0;
      }
      
      // Add spacing between rows
      let rowHeight = 8;
      if (row.isSection) {
        rowHeight = 10;
      } else if (row.isSummary) {
        rowHeight = 9;
      }
      yPosition += rowHeight;
      
      // Draw line after section summaries
      if (row.isSummary) {
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
        yPosition += 2;
      }
    });
    
    // If no rows were processed, add a message
    if (rows.length === 0) {
      doc.setFontSize(10);
      doc.text('No data available', pageWidth / 2, yPosition, { align: 'center' });
    }
  }

  // Return PDF as Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

/**
 * Convert PDF Uint8Array to base64 string
 */
export function pdfToBase64(pdfBytes: Uint8Array): string {
  const binary = String.fromCharCode(...pdfBytes);
  return Buffer.from(binary, 'binary').toString('base64');
}

