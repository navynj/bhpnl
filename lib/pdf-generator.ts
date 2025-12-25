import { jsPDF } from 'jspdf';

export interface ReportData {
  Header?: {
    ReportBasis?: string;
    Currency?: string;
    StartPeriod?: string;
    EndPeriod?: string;
    SummarizeColumnsBy?: string;
    Option?: Array<{
      Name?: string;
      Value?: string;
    }>;
  };
  Rows?: {
    Row?: Array<any>;
  };
  Columns?: {
    Column?: Array<{
      ColTitle?: string;
      MetaData?: Array<{
        Name?: string;
        Value?: string;
      }>;
    }>;
  };
}

interface SectionData {
  header: string;
  items: Array<{ label: string; value: string; indent?: number }>;
  total: { label: string; value: string };
  isImportant?: boolean;
}

interface ExpenseSection {
  header: string;
  items: Array<{ label: string; value: string; indent?: number }>;
  total: { label: string; value: string };
}

/**
 * Format currency value
 */
function formatCurrency(value: string, currency: string = 'CAD'): string {
  if (!value || value === '') return '';

  const numValue = parseFloat(value);
  if (isNaN(numValue)) return value;

  const symbol =
    currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : currency;
  return `${symbol}${Math.abs(numValue).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Extract items from a row structure
 */
function extractItems(
  rows: any[],
  expenseSectionHeader?: string,
  indentLevel: number = 0
): Array<{ label: string; value: string; indent?: number }> {
  const items: Array<{ label: string; value: string; indent?: number }> = [];

  if (!Array.isArray(rows)) return items;

  rows.forEach((row) => {
    // Direct ColData (data rows)
    if (row.ColData && Array.isArray(row.ColData) && row.type === 'Data') {
      const label = row.ColData[0]?.value || '';
      const value = row.ColData[1]?.value || '';
      if (label) {
        // Filter out excluded items
        // Exclude E17 Payroll Expenses (only exact "E17 Payroll Expenses" section, not other payroll items)
        const upperLabel = label.toUpperCase();
        if (
          upperLabel === 'E17 PAYROLL EXPENSES' ||
          (upperLabel.startsWith('E17') &&
            upperLabel.includes('PAYROLL EXPENSES') &&
            !upperLabel.includes('L'))
        ) {
          return;
        }
        // Exclude Online Subscription Fee from Expenses C
        if (
          expenseSectionHeader?.toUpperCase().includes('EXPENSE C') &&
          label.toUpperCase().includes('ONLINE SUBSCRIPTION')
        ) {
          return;
        }
        // Exclude Travel & conference from Expenses E
        if (
          expenseSectionHeader?.toUpperCase().includes('EXPENSE E') &&
          label.toUpperCase().includes('TRAVEL') &&
          label.toUpperCase().includes('CONFERENCE')
        ) {
          return;
        }
        items.push({
          label,
          value,
          indent: indentLevel > 0 ? indentLevel : undefined,
        });
      }
    }

    // Header with nested rows (sub-sections like "Sales 01 - Clover Sales")
    if (row.Header?.ColData && row.Rows?.Row) {
      const headerLabel = row.Header.ColData[0]?.value || '';

      // Exclude E17 Payroll Expenses section entirely (only exact "E17 Payroll Expenses" section, not other payroll items)
      const upperHeaderLabel = headerLabel.toUpperCase();
      if (
        upperHeaderLabel === 'E17 PAYROLL EXPENSES' ||
        (upperHeaderLabel.startsWith('E17') &&
          upperHeaderLabel.includes('PAYROLL EXPENSES') &&
          !upperHeaderLabel.includes('L'))
      ) {
        return;
      }

      // Exclude Online Subscription from Expenses C (check header label)
      if (
        expenseSectionHeader?.toUpperCase().includes('EXPENSE C') &&
        headerLabel.toUpperCase().includes('ONLINE SUBSCRIPTION')
      ) {
        return;
      }

      // Exclude Travel & conference from Expenses E (check header label)
      if (
        expenseSectionHeader?.toUpperCase().includes('EXPENSE E') &&
        headerLabel.toUpperCase().includes('TRAVEL') &&
        headerLabel.toUpperCase().includes('CONFERENCE')
      ) {
        return;
      }

      // Check if Header has any non-empty values (excluding the label at index 0)
      // Header ColData structure: [label, value1, value2, ..., valueN]
      const headerValues = row.Header.ColData.slice(1); // Skip label
      const hasHeaderValue = headerValues.some(
        (col: any) =>
          col?.value &&
          col.value !== '' &&
          col.value !== '0' &&
          col.value !== '0.00'
      );
      const headerValue = hasHeaderValue
        ? row.Header.ColData[1]?.value || ''
        : '';

      // Check if this is a Payroll/Wages section - if so, always extract nested items for detailed display
      const isPayrollSection =
        expenseSectionHeader?.toUpperCase().includes('PAYROLL') ||
        headerLabel.toUpperCase().includes('PAYROLL') ||
        headerLabel.toUpperCase().includes('WAGES') ||
        headerLabel.toUpperCase().includes('WAGE');

      // For Payroll sections, add the header first (if it has a value), then add nested items with indentation
      if (isPayrollSection && row.Rows?.Row && Array.isArray(row.Rows.Row)) {
        // Add the header first if it has a value
        if (headerValue && hasHeaderValue) {
          items.push({ label: headerLabel, value: headerValue });
        }
        // Then add nested items with indentation
        const nestedItems = extractItems(row.Rows.Row, expenseSectionHeader, 1);
        items.push(...nestedItems);
        // Skip the summary for Payroll sections as we show individual items
        return;
      }

      // Add the header as an item if it has a value, or as a sub-section header
      if (headerValue && hasHeaderValue) {
        items.push({ label: headerLabel, value: headerValue });
      } else {
        // It's a sub-section, add its summary if available
        if (row.Summary?.ColData) {
          const summaryLabel = row.Summary.ColData[0]?.value || '';
          const summaryValue = row.Summary.ColData[1]?.value || '';
          if (summaryLabel && summaryValue) {
            // Also filter summary labels
            if (
              expenseSectionHeader?.toUpperCase().includes('EXPENSE C') &&
              summaryLabel.toUpperCase().includes('ONLINE SUBSCRIPTION')
            ) {
              return;
            }
            if (
              expenseSectionHeader?.toUpperCase().includes('EXPENSE E') &&
              summaryLabel.toUpperCase().includes('TRAVEL') &&
              summaryLabel.toUpperCase().includes('CONFERENCE')
            ) {
              return;
            }
            items.push({ label: summaryLabel, value: summaryValue });
          }
        }
      }
    }
  });

  return items;
}

/**
 * Parse report data into structured sections
 */
function parseReportData(reportData: ReportData): {
  income: SectionData | null;
  costOfSales: SectionData | null;
  grossProfit: { label: string; value: string } | null;
  expenses: {
    sections: ExpenseSection[];
    total: { label: string; value: string } | null;
  };
  otherIncome: SectionData | null;
  profit: { label: string; value: string } | null;
} {
  const rows = reportData.Rows?.Row || [];

  let income: SectionData | null = null;
  let costOfSales: SectionData | null = null;
  let grossProfit: { label: string; value: string } | null = null;
  const expenseSections: ExpenseSection[] = [];
  let expensesTotal: { label: string; value: string } | null = null;
  let otherIncome: SectionData | null = null;
  let profit: { label: string; value: string } | null = null;

  rows.forEach((row) => {
    const headerValue = row.Header?.ColData?.[0]?.value || '';
    const summary = row.Summary?.ColData;
    const summaryLabel = summary?.[0]?.value || '';
    const summaryValue = summary?.[1]?.value || '';

    // INCOME section
    if (headerValue.toUpperCase() === 'INCOME' || row.group === 'Income') {
      const items = extractItems(row.Rows?.Row || []);
      income = {
        header: 'Income',
        items,
        total: { label: summaryLabel, value: summaryValue },
      };
    }

    // COST OF GOODS SOLD / COST OF SALES section
    if (
      headerValue.toUpperCase().includes('COST OF GOODS SOLD') ||
      headerValue.toUpperCase().includes('COST OF SALES') ||
      row.group === 'COGS'
    ) {
      const items = extractItems(row.Rows?.Row || []);
      costOfSales = {
        header: 'Cost of Sales',
        items,
        total: { label: summaryLabel, value: summaryValue },
        isImportant: true,
      };
    }

    // Gross Profit (usually appears as a summary between COGS and Expenses)
    if (
      summaryLabel.toUpperCase().includes('GROSS PROFIT') ||
      summaryLabel.toUpperCase().includes('GROSS INCOME')
    ) {
      grossProfit = { label: summaryLabel, value: summaryValue };
    }

    // EXPENSES section
    if (headerValue.toUpperCase() === 'EXPENSES' || row.group === 'Expenses') {
      // Process expense sub-sections (Expense A, B, C, D, E)
      const expenseRows = row.Rows?.Row || [];

      expenseRows.forEach((expenseRow: any) => {
        const expenseHeader = expenseRow.Header?.ColData?.[0]?.value || '';
        const expenseSummary = expenseRow.Summary?.ColData;
        const expenseSummaryLabel = expenseSummary?.[0]?.value || '';
        const expenseSummaryValue = expenseSummary?.[1]?.value || '';

        // Check if this is an expense sub-section (Expense A, B, C, D, E)
        if (
          expenseHeader.toUpperCase().includes('EXPENSE') &&
          expenseRow.Rows?.Row
        ) {
          // Exclude E17 Payroll Expenses section entirely (only exact "E17 Payroll Expenses" section, not other payroll items)
          const upperExpenseHeader = expenseHeader.toUpperCase();
          if (
            upperExpenseHeader === 'E17 PAYROLL EXPENSES' ||
            (upperExpenseHeader.startsWith('E17') &&
              upperExpenseHeader.includes('PAYROLL EXPENSES') &&
              !upperExpenseHeader.includes('L'))
          ) {
            return;
          }

          const items = extractItems(expenseRow.Rows.Row, expenseHeader);
          expenseSections.push({
            header: expenseHeader,
            items,
            total: {
              label: expenseSummaryLabel,
              value: expenseSummaryValue,
            },
          });
        }
      });

      // Total for Expenses
      if (
        summaryLabel.toUpperCase().includes('TOTAL') &&
        summaryLabel.toUpperCase().includes('EXPENSES')
      ) {
        expensesTotal = { label: summaryLabel, value: summaryValue };
      }
    }

    // OTHER INCOME section
    if (
      headerValue.toUpperCase().includes('OTHER INCOME') ||
      row.group === 'OtherIncome'
    ) {
      const items = extractItems(row.Rows?.Row || []);
      otherIncome = {
        header: 'Other Income',
        items,
        total: { label: summaryLabel, value: summaryValue },
      };
    }

    // PROFIT
    if (
      summaryLabel.toUpperCase() === 'PROFIT' ||
      summaryLabel.toUpperCase() === 'NET INCOME' ||
      row.group === 'NetIncome'
    ) {
      profit = { label: summaryLabel, value: summaryValue };
    }
  });

  return {
    income,
    costOfSales,
    grossProfit,
    expenses: {
      sections: expenseSections,
      total: expensesTotal,
    },
    otherIncome,
    profit,
  };
}

/**
 * Generate PDF from report data
 */
export function generatePDFFromReportData(
  reportData: ReportData,
  startDate: string,
  endDate: string,
  locationName?: string | null,
  targetPercentages?: {
    costOfSales?: number;
    payroll?: number;
    profit?: number;
  }
): Uint8Array {
  // Debug: Log target percentages
  console.log('[PDF Generator] Target percentages:', targetPercentages);

  const doc = new jsPDF();

  // Set up page
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Header information
  const header = reportData.Header || {};
  const currency = header.Currency || 'CAD';

  // Check if this is a monthly report by looking at SummarizeColumnsBy
  const isMonthlyMode = header.SummarizeColumnsBy === 'Month';
  let months: Array<{ year: number; month: number }> = [];

  // Extract months from Columns if monthly mode
  if (isMonthlyMode) {
    const columns = reportData.Columns?.Column || [];
    // Skip first column (Account label) and last column (Total)
    // Get month columns (they have StartDate and EndDate in MetaData)
    const monthColumns = columns.filter((col: any) => {
      if (!col.MetaData) return false;
      const hasStartDate = col.MetaData.some(
        (meta: any) => meta.Name === 'StartDate'
      );
      const hasEndDate = col.MetaData.some(
        (meta: any) => meta.Name === 'EndDate'
      );
      return hasStartDate && hasEndDate;
    });

    // Extract year and month from StartDate
    // Parse date string directly to avoid timezone issues
    // QuickBooks returns dates in "YYYY-MM-DD" format
    months = monthColumns
      .map((col: any) => {
        const startDateMeta = col.MetaData.find(
          (meta: any) => meta.Name === 'StartDate'
        );
        if (startDateMeta && startDateMeta.Value) {
          // Parse "YYYY-MM-DD" format directly to avoid timezone conversion
          const dateStr = startDateMeta.Value;
          const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            const year = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10); // Already 1-12 format
            return {
              year,
              month,
            };
          }
        }
        return null;
      })
      .filter((m): m is { year: number; month: number } => m !== null);
  }

  // Fallback: check for legacy _monthlyMode flag
  if (!isMonthlyMode) {
    const legacyMonthlyMode = (reportData as any)._monthlyMode === true;
    const legacyMonths = (reportData as any)._months || [];
    if (legacyMonthlyMode && legacyMonths.length > 0) {
      months = legacyMonths;
    }
  }

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const title =
    isMonthlyMode || months.length > 0
      ? 'Monthly P&L Report'
      : 'Profit & Loss Report';
  doc.text(title, pageWidth / 2, yPosition, {
    align: 'center',
  });
  yPosition += 10;

  // Location Name
  if (locationName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(locationName, pageWidth / 2, yPosition, {
      align: 'center',
    });
    yPosition += 8;
  }

  // Period
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, yPosition, {
    align: 'center',
  });
  yPosition += 12;

  if (header.ReportBasis) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Basis: ${header.ReportBasis}`, margin, yPosition);
    yPosition += 7;
  }

  yPosition += 5;

  if ((isMonthlyMode || months.length > 0) && months.length > 0) {
    // Use monthly report rendering
    // Pass the current yPosition so generateMonthlyPDF doesn't redraw the header
    return generateMonthlyPDF(
      doc,
      reportData,
      startDate,
      endDate,
      locationName,
      months,
      currency,
      yPosition, // Pass current yPosition
      targetPercentages // Pass target percentages
    );
  }

  // Parse data for period mode
  const parsed = parseReportData(reportData);

  // Get Income total for percentage calculations
  const incomeTotal = parsed.income?.total?.value
    ? parseFloat(parsed.income.total.value)
    : 0;

  // Helper function to calculate percentage of income
  const calculatePercentage = (value: string): string => {
    if (!value || incomeTotal === 0) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';
    const percentage = (numValue / incomeTotal) * 100;
    return `${percentage.toFixed(2)}%`;
  };

  // Table settings
  const availableWidth = pageWidth - 2 * margin;
  // Increase label width to accommodate longer text and prevent overflow
  const labelWidth = availableWidth * 0.5; // Increased from 0.4 to 0.5 for better text display
  const valueWidth = availableWidth * 0.3; // Adjusted to balance with label width
  const percentageWidth = availableWidth * 0.2; // Adjusted to balance with label width
  // Calculate actual table end position based on actual column widths
  const tableEndX = margin + labelWidth + valueWidth + percentageWidth;
  const lineHeight = 7;
  const sectionSpacing = 8;
  // Font size is 10pt
  // In jsPDF, text is drawn from baseline
  // For consistent row height, we calculate based on actual text rendering
  // Single line: lineHeight (7pt) - this is the distance from baseline to next baseline
  // Multi-line: first line baseline to last line baseline + lineHeight
  const lineSpacing = 5; // Spacing between lines in multi-line text (baseline to baseline)

  // Helper function to draw a section
  const drawSection = (
    section: SectionData | null,
    isImportant: boolean = false,
    targetPercent?: number
  ) => {
    if (!section) return;

    // Check page break
    if (yPosition + 30 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    // Section header
    doc.setFontSize(isImportant ? 13 : 12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.header, margin, yPosition);
    yPosition += 8;

    // Draw line under header
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 5;

    // Column headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT', margin + labelWidth, yPosition, { align: 'right' });
    doc.text('% of Income', margin + labelWidth + valueWidth, yPosition, {
      align: 'right',
    });
    yPosition += 6;

    // Draw line under column headers
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 3;

    // Items
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    section.items.forEach((item) => {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        // Reset font size after page break
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      }

      // Split text with adequate padding to ensure text doesn't overflow into amount column
      // Use larger padding to ensure proper spacing from amount column (at least 20pt)
      const textPadding = Math.max(20, 10 * 2); // At least 20pt for 10pt font
      const labelLines = doc.splitTextToSize(
        item.label,
        labelWidth - textPadding
      );
      const startY = yPosition;

      // Calculate row height first (before drawing)
      // This ensures consistent spacing
      const rowHeight =
        labelLines.length === 1
          ? lineHeight
          : (labelLines.length - 1) * lineSpacing + lineHeight;

      // Draw all text first
      labelLines.forEach((line: string, index: number) => {
        doc.text(line, margin, startY + index * lineSpacing);
      });

      const value = formatCurrency(item.value, currency);
      const percentage = calculatePercentage(item.value);
      // Align value with the first line of label
      doc.text(value, margin + labelWidth, startY, { align: 'right' });
      if (percentage) {
        doc.setFontSize(9);
        doc.text(percentage, margin + labelWidth + valueWidth, startY, {
          align: 'right',
        });
        doc.setFontSize(10);
      }

      // Calculate the bottom of the row
      // rowHeight is the distance from startY (first line baseline) to the next row's baseline
      // But we want to draw the line at the actual bottom of the text
      // For multi-line text, the last line's baseline is: startY + (labelLines.length - 1) * lineSpacing
      // Text extends about 2-3pt below baseline, so we add that to get the actual bottom
      // For single line, we use startY + lineHeight - 2 (to account for text extending below baseline)
      const lastLineBaseline = startY + (labelLines.length - 1) * lineSpacing;
      const rowBottom = lastLineBaseline + 2; // 2pt below baseline for 10pt font

      // Draw thin line under each row (at the bottom of the row, before next row starts)
      doc.setLineWidth(0.1);
      doc.line(margin, rowBottom, tableEndX, rowBottom);

      // Update yPosition to the next row's baseline
      yPosition = startY + rowHeight;
    });

    // Total
    if (section.total.label && section.total.value) {
      if (yPosition + lineHeight + 3 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      yPosition += 3;
      doc.setFontSize(isImportant ? 12 : 11);
      doc.setFont('helvetica', 'bold');
      const totalLabel = section.total.label;
      const totalValue = formatCurrency(section.total.value, currency);
      const totalPercentage = calculatePercentage(section.total.value);

      // Split total label text to prevent overflow into amount column
      // Use larger padding for bold text (bold takes more space) and ensure no overlap
      const currentFontSize = isImportant ? 12 : 11;
      // Increase padding significantly to ensure text never overlaps with value column
      // Bold text takes more space, and we need extra margin for safety
      const textPadding = Math.max(35, currentFontSize * 3.5); // At least 35pt, or 3.5x font size for better safety
      const totalLabelLines = doc.splitTextToSize(
        totalLabel,
        labelWidth - textPadding
      );
      const totalStartY = yPosition;

      // Calculate total row height
      const totalRowHeight =
        totalLabelLines.length === 1
          ? lineHeight
          : (totalLabelLines.length - 1) * lineSpacing + lineHeight;

      // Draw total label lines
      totalLabelLines.forEach((line: string, index: number) => {
        doc.text(line, margin, totalStartY + index * lineSpacing);
      });

      // Align value with the first line of total label
      doc.text(totalValue, margin + labelWidth, totalStartY, {
        align: 'right',
      });
      if (totalPercentage) {
        doc.setFontSize(10);
        doc.text(
          totalPercentage,
          margin + labelWidth + valueWidth,
          totalStartY,
          {
            align: 'right',
          }
        );
        doc.setFontSize(isImportant ? 12 : 11);
      }

      // Draw target percentage if available
      if (targetPercent !== undefined) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        const targetText = `Target: ${targetPercent.toFixed(2)}%`;
        const targetX = margin + labelWidth + valueWidth;
        const targetY = totalStartY + 3; // Move down slightly
        doc.text(targetText, targetX, targetY, { align: 'right' });
        doc.setFont('helvetica', 'bold'); // Reset font
      }

      yPosition = totalStartY + totalRowHeight + sectionSpacing;
    } else {
      yPosition += sectionSpacing;
    }
  };

  // Draw Income
  drawSection(parsed.income);

  // Draw Cost of Sales (important!) with target percentage
  drawSection(parsed.costOfSales, true, targetPercentages?.costOfSales);

  // Draw Gross Profit
  if (parsed.grossProfit) {
    if (yPosition + 15 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    // Column headers for Gross Profit
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT', margin + labelWidth, yPosition, { align: 'right' });
    doc.text('% of Income', margin + labelWidth + valueWidth, yPosition, {
      align: 'right',
    });
    yPosition += 6;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const grossProfitValue = formatCurrency(parsed.grossProfit.value, currency);
    const grossProfitPercentage = calculatePercentage(parsed.grossProfit.value);
    doc.text(parsed.grossProfit.label, margin, yPosition);
    doc.text(grossProfitValue, margin + labelWidth, yPosition, {
      align: 'right',
    });
    if (grossProfitPercentage) {
      doc.setFontSize(10);
      doc.text(
        grossProfitPercentage,
        margin + labelWidth + valueWidth,
        yPosition,
        {
          align: 'right',
        }
      );
      doc.setFontSize(12);
    }
    yPosition += lineHeight + sectionSpacing;
  }

  // Draw Expenses
  if (parsed.expenses.sections.length > 0 || parsed.expenses.total) {
    if (yPosition + 30 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    // Expenses header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Expenses', margin, yPosition);
    yPosition += 8;

    // Draw line
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 5;

    // Column headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT', margin + labelWidth, yPosition, { align: 'right' });
    doc.text('% of Income', margin + labelWidth + valueWidth, yPosition, {
      align: 'right',
    });
    yPosition += 6;

    // Draw line under column headers
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 3;

    // Draw each expense sub-section
    parsed.expenses.sections.forEach((expenseSection, sectionIndex) => {
      if (yPosition + 20 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      // Add spacing before each expense section (except the first one)
      if (sectionIndex > 0) {
        yPosition += 3; // Extra spacing before section header
      }

      // Check if this is Fixed Expense - skip items and show only total
      const isFixedExpense = expenseSection.header
        ?.toUpperCase()
        .includes('FIXED');

      // Sub-section header (Expense A, B, C, D, E)
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(expenseSection.header, margin, yPosition);
      yPosition += 7;

      // Items - skip for Fixed Expense
      if (!isFixedExpense) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        expenseSection.items.forEach((item) => {
          if (yPosition + lineHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
            // Reset font size after page break
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
          }

          // Split text with adequate padding for expense items to prevent overflow
          // Use larger padding to ensure proper spacing from amount column (at least 20pt)
          const indentOffset = item.indent ? item.indent * 10 : 0; // 10pt per indent level
          const textPadding = Math.max(20, 10 * 2); // At least 20pt for 10pt font
          const labelLines = doc.splitTextToSize(
            item.label,
            labelWidth - textPadding - indentOffset
          );
          const startY = yPosition;

          // Calculate row height first (before drawing)
          // This ensures consistent spacing
          const rowHeight =
            labelLines.length === 1
              ? lineHeight
              : (labelLines.length - 1) * lineSpacing + lineHeight;

          // Draw all text first with indentation if needed
          labelLines.forEach((line: string, index: number) => {
            doc.text(
              line,
              margin + 10 + indentOffset,
              startY + index * lineSpacing
            );
          });

          const value = formatCurrency(item.value, currency);
          const percentage = calculatePercentage(item.value);
          // Align value with the first line of label
          // Ensure font size is correct for value
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(value, margin + labelWidth, startY, { align: 'right' });
          if (percentage) {
            doc.setFontSize(9);
            doc.text(percentage, margin + labelWidth + valueWidth, startY, {
              align: 'right',
            });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
          }

          // Calculate the bottom of the row
          // rowHeight is the distance from startY (first line baseline) to the next row's baseline
          // But we want to draw the line at the actual bottom of the text
          // For multi-line text, the last line's baseline is: startY + (labelLines.length - 1) * lineSpacing
          // Text extends about 2-3pt below baseline, so we add that to get the actual bottom
          // For single line, we use startY + lineHeight - 2 (to account for text extending below baseline)
          const lastLineBaseline =
            startY + (labelLines.length - 1) * lineSpacing;
          const rowBottom = lastLineBaseline + 2; // 2pt below baseline for 10pt font

          // Draw very thin line under each item row (E1, E2, E3, etc.)
          doc.setLineWidth(0.05);
          doc.line(margin, rowBottom, tableEndX, rowBottom);

          // Update yPosition to the next row's baseline
          yPosition = startY + rowHeight;
        });
      }

      // Sub-section total
      if (expenseSection.total.label && expenseSection.total.value) {
        if (yPosition + lineHeight + 3 > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

        yPosition += 3;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const totalLabel = expenseSection.total.label;
        const totalValue = formatCurrency(expenseSection.total.value, currency);
        const totalPercentage = calculatePercentage(expenseSection.total.value);

        // Split total label text to prevent overflow into amount column
        // Use larger padding for bold text (bold takes more space) and ensure no overlap
        const currentFontSize = 10;
        // Increase padding significantly to ensure text never overlaps with value column
        const textPadding = Math.max(35, currentFontSize * 3.5); // At least 35pt, or 3.5x font size for better safety
        const totalLabelLines = doc.splitTextToSize(
          totalLabel,
          labelWidth - textPadding
        );
        const totalStartY = yPosition;

        // Calculate total row height
        const totalRowHeight =
          totalLabelLines.length === 1
            ? lineHeight
            : (totalLabelLines.length - 1) * lineSpacing + lineHeight;

        // Draw total label lines
        totalLabelLines.forEach((line: string, index: number) => {
          doc.text(line, margin, totalStartY + index * lineSpacing);
        });

        // Align value with the first line of total label
        doc.text(totalValue, margin + labelWidth, totalStartY, {
          align: 'right',
        });
        if (totalPercentage) {
          doc.setFontSize(9);
          doc.text(
            totalPercentage,
            margin + labelWidth + valueWidth,
            totalStartY,
            {
              align: 'right',
            }
          );
          doc.setFontSize(10);
        }

        // Check if this is Payroll and has target percentage
        const isPayroll = expenseSection.total.label
          ?.toUpperCase()
          .includes('PAYROLL');
        if (isPayroll && targetPercentages?.payroll !== undefined) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          const targetText = `Target: ${targetPercentages.payroll.toFixed(2)}%`;
          const targetX = margin + labelWidth + valueWidth;
          const targetY = totalStartY + 3; // Move down slightly
          doc.text(targetText, targetX, targetY, { align: 'right' });
          doc.setFont('helvetica', 'bold'); // Reset font
        }

        yPosition = totalStartY + totalRowHeight + 2;

        // Draw line after each expense sub-section (Expense A, B, C, D, E) total
        // This separates each expense section
        // Add spacing before the line
        yPosition += 2;
        doc.setLineWidth(0.2);
        doc.line(margin, yPosition, tableEndX, yPosition);
        // Add spacing after the line (before next section header)
        yPosition += 3;
      }
    });

    // Total for Expenses
    if (parsed.expenses.total) {
      if (yPosition + lineHeight + 5 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      yPosition += 5;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const totalLabel = parsed.expenses.total.label;
      const totalValue = formatCurrency(parsed.expenses.total.value, currency);
      const totalPercentage = calculatePercentage(parsed.expenses.total.value);

      // Split total label text to prevent overflow into amount column
      // Use larger padding for bold text (bold takes more space) and ensure no overlap
      const currentFontSize = 11;
      // Increase padding significantly to ensure text never overlaps with value column
      const textPadding = Math.max(35, currentFontSize * 3.5); // At least 35pt, or 3.5x font size for better safety
      const totalLabelLines = doc.splitTextToSize(
        totalLabel,
        labelWidth - textPadding
      );
      const totalStartY = yPosition;

      // Calculate total row height
      const totalRowHeight =
        totalLabelLines.length === 1
          ? lineHeight
          : (totalLabelLines.length - 1) * lineSpacing + lineHeight;

      // Draw total label lines
      totalLabelLines.forEach((line: string, index: number) => {
        doc.text(line, margin, totalStartY + index * lineSpacing);
      });

      // Align value with the first line of total label
      doc.text(totalValue, margin + labelWidth, totalStartY, {
        align: 'right',
      });
      if (totalPercentage) {
        doc.setFontSize(10);
        doc.text(
          totalPercentage,
          margin + labelWidth + valueWidth,
          totalStartY,
          {
            align: 'right',
          }
        );
        doc.setFontSize(11);
      }
      yPosition = totalStartY + totalRowHeight + sectionSpacing;
    }
  }

  // Draw Other Income
  drawSection(parsed.otherIncome);

  // Draw Profit
  if (parsed.profit) {
    if (yPosition + 20 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    yPosition += 5;

    // Column headers for Profit
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT', margin + labelWidth, yPosition, { align: 'right' });
    doc.text('% of Income', margin + labelWidth + valueWidth, yPosition, {
      align: 'right',
    });
    yPosition += 6;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const profitValue = formatCurrency(parsed.profit.value, currency);
    const profitPercentage = calculatePercentage(parsed.profit.value);
    doc.text(parsed.profit.label, margin, yPosition);
    doc.text(profitValue, margin + labelWidth, yPosition, { align: 'right' });
    if (profitPercentage) {
      doc.setFontSize(12);
      doc.text(profitPercentage, margin + labelWidth + valueWidth, yPosition, {
        align: 'right',
      });
      doc.setFontSize(14);
    }

    // Draw target percentage if available (for Profit)
    if (targetPercentages?.profit !== undefined) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'italic');
      const targetText = `Target: ${targetPercentages.profit.toFixed(2)}%`;
      const targetX = margin + labelWidth + valueWidth;
      const targetY = yPosition + 3; // Move down slightly
      doc.text(targetText, targetX, targetY, { align: 'right' });
    }
  }

  // Return PDF as Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

/**
 * Generate PDF for monthly report mode
 */
function generateMonthlyPDF(
  doc: jsPDF,
  reportData: ReportData,
  startDate: string,
  endDate: string,
  locationName: string | null | undefined,
  months: Array<{ year: number; month: number }>,
  currency: string,
  initialYPosition: number, // Pass the yPosition from the main function
  targetPercentages?: {
    costOfSales?: number;
    payroll?: number;
    profit?: number;
  }
): Uint8Array {
  // Debug: Log target percentages
  console.log('[PDF Generator Monthly] Target percentages:', targetPercentages);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // Reduce margin for more space (especially important for 3+ months)
  const margin = 12; // Reduced from 15 to minimize left padding
  let yPosition = initialYPosition; // Use the passed yPosition instead of starting from margin

  // Note: Header (Title, Location, Period, Basis) is already drawn in generatePDFFromReportData
  // So we don't need to draw it again here - just start with the table

  // Table settings for monthly mode - optimized for multiple months
  const availableWidth = pageWidth - 2 * margin;
  const numColumns = months.length + 1; // months + Total
  // Increase label width to accommodate longer text while still leaving space for columns
  // Use responsive width: more space for label when fewer months, less when more months
  const labelWidth =
    numColumns <= 3
      ? availableWidth * 0.35 // More space for label when 3 or fewer months
      : numColumns <= 5
      ? availableWidth * 0.3 // Moderate space for 4-5 months
      : availableWidth * 0.25; // Less space for 6+ months
  // Calculate column width to fill the entire available space
  // Since we use column centers (xPos), the last column's right edge should be at pageWidth - margin
  // Last column center = margin + labelWidth + (numColumns - 1) * columnWidth
  // Last column right edge = last column center + columnWidth / 2 = pageWidth - margin
  // So: margin + labelWidth + (numColumns - 1) * columnWidth + columnWidth / 2 = pageWidth - margin
  // Solving: columnWidth = (pageWidth - 2 * margin - labelWidth) / (numColumns - 0.5)
  const columnWidth =
    (pageWidth - 2 * margin - labelWidth) / (numColumns - 0.5);
  // Calculate the actual end position - should be pageWidth - margin
  const tableEndX = pageWidth - margin;
  // Reduce line heights and spacing
  const lineHeight = 6;
  const sectionSpacing = 6;
  const lineSpacing = 4;

  // Get month labels
  const monthLabels = months.map((m) => {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return `${monthNames[m.month - 1]} ${m.year}`;
  });

  // Parse data
  const parsed = parseReportDataMonthly(reportData, months.length);

  // Get Income total for percentage calculations
  // For monthly columns: use first month's income
  // For Total column: use total income (sum of all months)
  const incomeTotalForMonths = parsed.income?.total?.values?.[0]
    ? parseFloat(parsed.income.total.values[0])
    : 0;
  const incomeTotalForTotal = parsed.income?.total?.total
    ? parseFloat(parsed.income.total.total)
    : 0;

  // Helper function to calculate percentage of income
  // isTotalColumn: true if calculating percentage for Total column
  const calculatePercentage = (
    value: string,
    isTotalColumn: boolean = false
  ): string => {
    if (!value) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    // Use total income for Total column, first month income for monthly columns
    const baseIncome = isTotalColumn
      ? incomeTotalForTotal
      : incomeTotalForMonths;
    if (baseIncome === 0) return '';

    const percentage = (numValue / baseIncome) * 100;
    return `${percentage.toFixed(2)}%`;
  };

  // Helper function to draw a section in monthly mode
  const drawMonthlySection = (
    section: MonthlySectionData | null,
    isImportant: boolean = false
  ) => {
    if (!section) return;

    // Check page break
    if (yPosition + 30 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    // Section header - smaller
    doc.setFontSize(isImportant ? 11 : 10);
    doc.setFont('helvetica', 'bold');
    doc.text(section.header, margin, yPosition);
    yPosition += 6;

    // Draw line under header - use tableEndX to match table width
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 4;

    // Column headers - smaller font
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    let xPos = margin + labelWidth;
    monthLabels.forEach((label) => {
      // Truncate long labels if needed
      const truncatedLabel = label.length > 10 ? label.substring(0, 10) : label;
      doc.text(truncatedLabel, xPos, yPosition, { align: 'center' });
      xPos += columnWidth;
    });
    doc.text('Total', xPos, yPosition, { align: 'center' });
    yPosition += 3;

    // Sub-headers: CUR and % side by side within each column
    doc.setFontSize(6);
    xPos = margin + labelWidth;
    monthLabels.forEach(() => {
      // CUR on the left, % on the right within the same column
      const curX = xPos - columnWidth / 2 + 3; // Left side of column
      const percentX = xPos + columnWidth / 2 - 3; // Right side of column
      doc.text('CUR', curX, yPosition, { align: 'left' });
      doc.text('%', percentX, yPosition, { align: 'right' });
      xPos += columnWidth;
    });
    // Total column
    const totalCurX = xPos - columnWidth / 2 + 3;
    const totalPercentX = xPos + columnWidth / 2 - 3;
    doc.text('CUR', totalCurX, yPosition, { align: 'left' });
    doc.text('%', totalPercentX, yPosition, { align: 'right' });
    yPosition += 4;

    // Draw line under column headers - use tableEndX to match table width
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 3;

    // Items - smaller font
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    section.items.forEach((item) => {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        // Reset font size after page break
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
      }

      // Split text with adequate padding to ensure text doesn't overflow into amount columns
      // Use responsive padding based on label width
      const indentOffset = item.indent ? item.indent * 8 : 0; // 8pt per indent level for monthly mode
      const textPadding = labelWidth * 0.15; // 15% of label width for padding
      const labelLines = doc.splitTextToSize(
        item.label,
        labelWidth - textPadding - indentOffset
      );
      const startY = yPosition;

      const rowHeight =
        labelLines.length === 1
          ? lineHeight
          : (labelLines.length - 1) * lineSpacing + lineHeight;

      // Draw label with indentation if needed
      labelLines.forEach((line: string, index: number) => {
        doc.text(line, margin + indentOffset, startY + index * lineSpacing);
      });

      // Draw values and percentages side by side within each column
      xPos = margin + labelWidth;
      item.values.forEach((value) => {
        const formattedValue = formatCurrency(value, currency);
        const percentage = calculatePercentage(value);

        // Value on the left, percentage on the right within the same column
        const valueX = xPos - columnWidth / 2 + 3; // Left side of column
        const percentX = xPos + columnWidth / 2 - 3; // Right side of column

        doc.setFontSize(7);
        doc.text(formattedValue, valueX, startY, { align: 'left' });

        if (percentage) {
          doc.setFontSize(6);
          doc.text(percentage, percentX, startY, { align: 'right' });
        }

        xPos += columnWidth;
      });

      // Draw total value and percentage side by side
      const totalValue = formatCurrency(item.total, currency);
      const totalPercentage = calculatePercentage(item.total, true); // true = Total column
      const totalValueX = xPos - columnWidth / 2 + 3;
      const totalPercentX = xPos + columnWidth / 2 - 3;

      doc.setFontSize(7);
      doc.text(totalValue, totalValueX, startY, { align: 'left' });

      if (totalPercentage) {
        doc.setFontSize(6);
        doc.text(totalPercentage, totalPercentX, startY, { align: 'right' });
      }

      // Draw line under row - use tableEndX instead of pageWidth - margin
      const lastLineBaseline = startY + (labelLines.length - 1) * lineSpacing;
      const rowBottom = lastLineBaseline + 2;
      doc.setLineWidth(0.1);
      doc.line(margin, rowBottom, tableEndX, rowBottom);

      // Reset font size back to label size for next item
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');

      yPosition = startY + rowHeight;
    });

    // Total - smaller font
    if (section.total && section.total.label && section.total.values) {
      if (yPosition + lineHeight + 2 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      yPosition += 2;
      doc.setFontSize(isImportant ? 10 : 9);
      doc.setFont('helvetica', 'bold');

      // Split total label text to prevent overflow into amount columns
      // Increase padding to ensure text never overlaps with value columns
      const currentFontSize = isImportant ? 10 : 9;
      const textPadding = Math.max(labelWidth * 0.25, currentFontSize * 3); // At least 25% of label width or 3x font size for better safety
      const totalLabelLines = doc.splitTextToSize(
        section.total.label,
        labelWidth - textPadding
      );
      const totalStartY = yPosition;

      // Calculate total row height
      const totalRowHeight =
        totalLabelLines.length === 1
          ? lineHeight
          : (totalLabelLines.length - 1) * lineSpacing + lineHeight;

      // Draw total label lines
      totalLabelLines.forEach((line: string, index: number) => {
        doc.text(line, margin, totalStartY + index * lineSpacing);
      });

      // Check if this is Cost of Sales and has target percentage
      const isCostOfSales =
        section.header === 'Cost of Sales' ||
        section.total.label?.toUpperCase().includes('COST OF SALES') ||
        section.total.label?.toUpperCase().includes('COST OF GOODS SOLD');
      const targetPercent = isCostOfSales
        ? targetPercentages?.costOfSales
        : undefined;

      // Draw total values and percentages side by side within each column
      // Align with the first line of total label
      xPos = margin + labelWidth;
      section.total.values.forEach((value) => {
        const formattedValue = formatCurrency(value, currency);
        const percentage = calculatePercentage(value);

        // Value on the left, percentage on the right within the same column
        const valueX = xPos - columnWidth / 2 + 3; // Left side of column
        const percentX = xPos + columnWidth / 2 - 3; // Right side of column

        doc.setFontSize(7);
        doc.text(formattedValue, valueX, totalStartY, { align: 'left' });

        if (percentage) {
          doc.setFontSize(6);
          doc.text(percentage, percentX, totalStartY, { align: 'right' });
        }

        xPos += columnWidth;
      });

      // Draw total column value and percentage side by side
      const totalValue = formatCurrency(section.total.total, currency);
      const totalPercentage = calculatePercentage(section.total.total, true); // true = Total column
      const totalValueX = xPos - columnWidth / 2 + 3;
      const totalPercentX = xPos + columnWidth / 2 - 3;

      doc.setFontSize(7);
      doc.text(totalValue, totalValueX, totalStartY, { align: 'left' });

      if (totalPercentage) {
        doc.setFontSize(6);
        doc.text(totalPercentage, totalPercentX, totalStartY, {
          align: 'right',
        });
      }

      // Draw target percentage if available (for Cost of Sales)
      if (targetPercent !== undefined) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        const targetText = `Target: ${targetPercent.toFixed(2)}%`;
        // Position target text below the percentage, slightly to the left
        const targetY = totalStartY + 3; // Move down slightly
        const targetX = totalPercentX; // Use same X position as percentage
        doc.text(targetText, targetX, targetY, { align: 'right' });
        doc.setFont('helvetica', 'bold'); // Reset font
      }

      yPosition = totalStartY + totalRowHeight + sectionSpacing;
    } else {
      yPosition += sectionSpacing;
    }
  };

  // Draw Income
  drawMonthlySection(parsed.income);

  // Draw Cost of Sales - use same font size as Income (isImportant=false)
  drawMonthlySection(parsed.costOfSales, false);

  // Draw Gross Profit - match Income section style
  if (parsed.grossProfit) {
    if (yPosition + 15 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const grossProfitValue = formatCurrency(parsed.grossProfit.total, currency);
    const grossProfitPercentage = calculatePercentage(
      parsed.grossProfit.total,
      true
    ); // true = Total column
    doc.text(parsed.grossProfit.label, margin, yPosition);

    let xPos = margin + labelWidth;
    parsed.grossProfit.values.forEach((value) => {
      const formattedValue = formatCurrency(value, currency);
      const percentage = calculatePercentage(value);

      // Value on the left, percentage on the right within the same column (match Income style)
      const valueX = xPos - columnWidth / 2 + 3;
      const percentX = xPos + columnWidth / 2 - 3;

      doc.setFontSize(7);
      doc.text(formattedValue, valueX, yPosition, { align: 'left' });

      if (percentage) {
        doc.setFontSize(6);
        doc.text(percentage, percentX, yPosition, { align: 'right' });
      }

      xPos += columnWidth;
    });

    // Total column
    const totalValueX = xPos - columnWidth / 2 + 3;
    const totalPercentX = xPos + columnWidth / 2 - 3;

    doc.setFontSize(7);
    doc.text(grossProfitValue, totalValueX, yPosition, { align: 'left' });

    if (grossProfitPercentage) {
      doc.setFontSize(6);
      doc.text(grossProfitPercentage, totalPercentX, yPosition, {
        align: 'right',
      });
    }

    yPosition += lineHeight + sectionSpacing;
  }

  // Draw Expenses
  if (parsed.expenses.sections.length > 0 || parsed.expenses.total) {
    if (yPosition + 30 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    // Expenses header - match Income section style
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Expenses', margin, yPosition);
    yPosition += 6;

    // Draw line under header - use tableEndX to match table width
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 4;

    // Column headers - match Income section style
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    let xPos = margin + labelWidth;
    monthLabels.forEach((label) => {
      // Truncate long labels if needed
      const truncatedLabel = label.length > 10 ? label.substring(0, 10) : label;
      doc.text(truncatedLabel, xPos, yPosition, { align: 'center' });
      xPos += columnWidth;
    });
    doc.text('Total', xPos, yPosition, { align: 'center' });
    yPosition += 3;

    // Sub-headers: CUR and % side by side within each column - match Income style
    doc.setFontSize(6);
    xPos = margin + labelWidth;
    monthLabels.forEach(() => {
      // CUR on the left, % on the right within the same column
      const curX = xPos - columnWidth / 2 + 3;
      const percentX = xPos + columnWidth / 2 - 3;
      doc.text('CUR', curX, yPosition, { align: 'left' });
      doc.text('%', percentX, yPosition, { align: 'right' });
      xPos += columnWidth;
    });
    // Total column
    const totalCurX = xPos - columnWidth / 2 + 3;
    const totalPercentX = xPos + columnWidth / 2 - 3;
    doc.text('CUR', totalCurX, yPosition, { align: 'left' });
    doc.text('%', totalPercentX, yPosition, { align: 'right' });
    yPosition += 4;

    // Draw line under column headers - use tableEndX to match table width
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition - 2, tableEndX, yPosition - 2);
    yPosition += 3;

    parsed.expenses.sections.forEach((expenseSection, sectionIndex) => {
      if (yPosition + 20 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      if (sectionIndex > 0) {
        yPosition += 3;
      }

      // Check if this is Fixed Expense - skip items and show only total
      const isFixedExpense = expenseSection.header
        ?.toUpperCase()
        .includes('FIXED');

      // Sub-section header - match Income section style
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(expenseSection.header, margin, yPosition);
      yPosition += 6;

      // Items - match Income section style - skip for Fixed Expense
      if (!isFixedExpense) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        expenseSection.items.forEach((item) => {
          if (yPosition + lineHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
            // Reset font size after page break
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
          }

          // Split text with adequate padding for expense items to prevent overflow
          // Use responsive padding based on label width
          const indentOffset = item.indent ? item.indent * 8 : 0; // 8pt per indent level for monthly mode
          const textPadding = labelWidth * 0.15; // 15% of label width for padding
          const labelLines = doc.splitTextToSize(
            item.label,
            labelWidth - textPadding - indentOffset
          );
          const startY = yPosition;

          const rowHeight =
            labelLines.length === 1
              ? lineHeight
              : (labelLines.length - 1) * lineSpacing + lineHeight;

          // Draw label with indentation if needed
          labelLines.forEach((line: string, index: number) => {
            doc.text(line, margin + indentOffset, startY + index * lineSpacing);
          });

          // Draw values and percentages side by side within each column - match Income style
          xPos = margin + labelWidth;
          item.values.forEach((value) => {
            const formattedValue = formatCurrency(value, currency);
            const percentage = calculatePercentage(value);

            // Value on the left, percentage on the right within the same column
            const valueX = xPos - columnWidth / 2 + 3;
            const percentX = xPos + columnWidth / 2 - 3;

            doc.setFontSize(8);
            doc.text(formattedValue, valueX, startY, { align: 'left' });

            if (percentage) {
              doc.setFontSize(6);
              doc.text(percentage, percentX, startY, { align: 'right' });
              doc.setFontSize(8); // Reset font size after percentage
            }

            xPos += columnWidth;
          });

          // Draw total value and percentage side by side
          const totalValue = formatCurrency(item.total, currency);
          const totalPercentage = calculatePercentage(item.total, true); // true = Total column
          const totalValueX = xPos - columnWidth / 2 + 3;
          const totalPercentX = xPos + columnWidth / 2 - 3;

          doc.setFontSize(8);
          doc.text(totalValue, totalValueX, startY, { align: 'left' });

          if (totalPercentage) {
            doc.setFontSize(6);
            doc.text(totalPercentage, totalPercentX, startY, {
              align: 'right',
            });
          }

          // Reset font size back to label size for next item
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');

          // Draw line under row - use tableEndX to match table width
          const lastLineBaseline =
            startY + (labelLines.length - 1) * lineSpacing;
          const rowBottom = lastLineBaseline + 2;
          doc.setLineWidth(0.1);
          doc.line(margin, rowBottom, tableEndX, rowBottom);

          yPosition = startY + rowHeight;
        });
      }

      if (
        expenseSection.total &&
        expenseSection.total.label &&
        expenseSection.total.values
      ) {
        if (yPosition + lineHeight + 3 > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

        yPosition += 2;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        // Split total label text to prevent overflow into amount columns
        // Use larger padding for bold text (bold takes more space) and ensure no overlap
        const currentFontSize = 9;
        // Use percentage of label width but ensure minimum padding - increase for better safety
        const minPadding = Math.max(25, currentFontSize * 3); // At least 25pt, or 3x font size
        const percentPadding = labelWidth * 0.25; // 25% of label width (increased from 20%)
        const textPadding = Math.max(minPadding, percentPadding);
        const totalLabelLines = doc.splitTextToSize(
          expenseSection.total.label,
          labelWidth - textPadding
        );
        const totalStartY = yPosition;

        // Calculate total row height
        const totalRowHeight =
          totalLabelLines.length === 1
            ? lineHeight
            : (totalLabelLines.length - 1) * lineSpacing + lineHeight;

        // Draw total label lines
        totalLabelLines.forEach((line: string, index: number) => {
          doc.text(line, margin, totalStartY + index * lineSpacing);
        });

        // Check if this is Payroll and has target percentage
        const isPayroll = expenseSection.total.label
          ?.toUpperCase()
          .includes('PAYROLL');
        const payrollTargetPercent = isPayroll
          ? targetPercentages?.payroll
          : undefined;

        // Draw total values and percentages side by side within each column - match Income style
        // Align with the first line of total label
        xPos = margin + labelWidth;
        expenseSection.total.values.forEach((value) => {
          const formattedValue = formatCurrency(value, currency);
          const percentage = calculatePercentage(value);

          // Value on the left, percentage on the right within the same column
          const valueX = xPos - columnWidth / 2 + 3;
          const percentX = xPos + columnWidth / 2 - 3;

          doc.setFontSize(8);
          doc.text(formattedValue, valueX, totalStartY, { align: 'left' });

          if (percentage) {
            doc.setFontSize(6);
            doc.text(percentage, percentX, totalStartY, { align: 'right' });
          }

          xPos += columnWidth;
        });

        // Draw total column value and percentage side by side
        const totalValue = formatCurrency(expenseSection.total.total, currency);
        const totalPercentage = calculatePercentage(
          expenseSection.total.total,
          true
        ); // true = Total column
        const totalValueX = xPos - columnWidth / 2 + 3;
        const totalPercentX = xPos + columnWidth / 2 - 3;

        doc.setFontSize(8);
        doc.text(totalValue, totalValueX, totalStartY, { align: 'left' });

        if (totalPercentage) {
          doc.setFontSize(6);
          doc.text(totalPercentage, totalPercentX, totalStartY, {
            align: 'right',
          });
        }

        // Draw target percentage if available (for Payroll)
        if (payrollTargetPercent !== undefined) {
          doc.setFontSize(6);
          doc.setFont('helvetica', 'italic');
          const targetText = `Target: ${payrollTargetPercent.toFixed(1)}%`;
          // Position target text below the percentage
          const targetY = totalStartY + 3; // Move down slightly
          const targetX = totalPercentX; // Use same X position as percentage
          doc.text(targetText, targetX, targetY, { align: 'right' });
          doc.setFont('helvetica', 'bold'); // Reset font
        }

        yPosition = totalStartY + totalRowHeight + 2;

        yPosition += 2;
        doc.setLineWidth(0.2);
        doc.line(margin, yPosition, tableEndX, yPosition);
        yPosition += 3;
      }
    });

    if (parsed.expenses.total) {
      if (yPosition + lineHeight + 5 > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }

      yPosition += 2;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      // Split total label text to prevent overflow into amount columns
      // Use larger padding for bold text (bold takes more space) and ensure no overlap
      const currentFontSize = 9;
      // Use percentage of label width but ensure minimum padding - increase for better safety
      const minPadding = Math.max(25, currentFontSize * 3); // At least 25pt, or 3x font size
      const percentPadding = labelWidth * 0.25; // 25% of label width (increased from 20%)
      const textPadding = Math.max(minPadding, percentPadding);
      const totalLabelLines = doc.splitTextToSize(
        parsed.expenses.total.label,
        labelWidth - textPadding
      );
      const totalStartY = yPosition;

      // Calculate total row height
      const totalRowHeight =
        totalLabelLines.length === 1
          ? lineHeight
          : (totalLabelLines.length - 1) * lineSpacing + lineHeight;

      // Draw total label lines
      totalLabelLines.forEach((line: string, index: number) => {
        doc.text(line, margin, totalStartY + index * lineSpacing);
      });

      // Draw total values and percentages side by side within each column - match Income style
      // Align with the first line of total label
      let xPos = margin + labelWidth;
      parsed.expenses.total.values.forEach((value) => {
        const formattedValue = formatCurrency(value, currency);
        const percentage = calculatePercentage(value);

        // Value on the left, percentage on the right within the same column
        const valueX = xPos - columnWidth / 2 + 3;
        const percentX = xPos + columnWidth / 2 - 3;

        doc.setFontSize(7);
        doc.text(formattedValue, valueX, totalStartY, { align: 'left' });

        if (percentage) {
          doc.setFontSize(6);
          doc.text(percentage, percentX, totalStartY, { align: 'right' });
        }

        xPos += columnWidth;
      });

      // Draw total column value and percentage side by side
      const totalValue = formatCurrency(parsed.expenses.total.total, currency);
      const totalPercentage = calculatePercentage(
        parsed.expenses.total.total,
        true
      ); // true = Total column
      const totalValueX = xPos - columnWidth / 2 + 3;
      const totalPercentX = xPos + columnWidth / 2 - 3;

      doc.setFontSize(7);
      doc.text(totalValue, totalValueX, totalStartY, { align: 'left' });

      if (totalPercentage) {
        doc.setFontSize(6);
        doc.text(totalPercentage, totalPercentX, totalStartY, {
          align: 'right',
        });
      }

      yPosition = totalStartY + totalRowHeight + sectionSpacing;
    }
  }

  // Draw Other Income
  drawMonthlySection(parsed.otherIncome);

  // Draw Profit
  if (parsed.profit) {
    if (yPosition + 20 > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    yPosition += 2;

    // Profit header - match Income section style
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(parsed.profit.label, margin, yPosition);

    // Draw profit values and percentages side by side within each column - match Income style
    let xPos = margin + labelWidth;
    parsed.profit.values.forEach((value) => {
      const formattedValue = formatCurrency(value, currency);
      const percentage = calculatePercentage(value);

      // Value on the left, percentage on the right within the same column
      const valueX = xPos - columnWidth / 2 + 3;
      const percentX = xPos + columnWidth / 2 - 3;

      doc.setFontSize(7);
      doc.text(formattedValue, valueX, yPosition, { align: 'left' });

      if (percentage) {
        doc.setFontSize(6);
        doc.text(percentage, percentX, yPosition, { align: 'right' });
      }

      xPos += columnWidth;
    });

    // Draw total column value and percentage side by side
    const profitValue = formatCurrency(parsed.profit.total, currency);
    const profitPercentage = calculatePercentage(parsed.profit.total, true); // true = Total column
    const totalValueX = xPos - columnWidth / 2 + 3;
    const totalPercentX = xPos + columnWidth / 2 - 3;

    doc.setFontSize(7);
    doc.text(profitValue, totalValueX, yPosition, { align: 'left' });

    if (profitPercentage) {
      doc.setFontSize(6);
      doc.text(profitPercentage, totalPercentX, yPosition, { align: 'right' });
    }

    // Draw target percentage if available (for Profit)
    if (targetPercentages?.profit !== undefined) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      const targetText = `Target: ${targetPercentages.profit.toFixed(2)}%`;
      // Position target text below the percentage
      const targetY = yPosition + 3; // Move down slightly
      const targetX = totalPercentX; // Use same X position as percentage
      doc.text(targetText, targetX, targetY, { align: 'right' });
    }
  }

  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

interface MonthlySectionData {
  header: string;
  items: Array<{
    label: string;
    values: string[];
    total: string;
    indent?: number;
  }>;
  total: { label: string; values: string[]; total: string } | null;
  isImportant?: boolean;
}

interface MonthlyExpenseSection {
  header: string;
  items: Array<{
    label: string;
    values: string[];
    total: string;
    indent?: number;
  }>;
  total: { label: string; values: string[]; total: string } | null;
}

/**
 * Parse report data for monthly mode
 */
function parseReportDataMonthly(
  reportData: ReportData,
  numMonths: number
): {
  income: MonthlySectionData | null;
  costOfSales: MonthlySectionData | null;
  grossProfit: { label: string; values: string[]; total: string } | null;
  expenses: {
    sections: MonthlyExpenseSection[];
    total: { label: string; values: string[]; total: string } | null;
  };
  otherIncome: MonthlySectionData | null;
  profit: { label: string; values: string[]; total: string } | null;
} {
  const rows = reportData.Rows?.Row || [];
  const columns = reportData.Columns?.Column || [];

  // Extract values from ColData array (index 0 is label, 1-N are month values, last is total)
  const getValuesFromRow = (row: any): string[] => {
    if (row.ColData && Array.isArray(row.ColData)) {
      // ColData structure: [label, month1, month2, ..., monthN, total]
      // We want month1 to monthN (skip label at index 0, skip total at the end)
      const monthValues = row.ColData.slice(1, -1); // Exclude first (label) and last (total)
      if (monthValues.length >= numMonths) {
        return monthValues
          .slice(0, numMonths)
          .map((col: any) => col?.value || '0');
      }
      // If structure is different, try to get numMonths values starting from index 1
      return row.ColData.slice(1, numMonths + 1).map(
        (col: any) => col?.value || '0'
      );
    }
    return Array(numMonths).fill('0');
  };

  const getTotalFromRow = (row: any): string => {
    if (row.ColData && Array.isArray(row.ColData)) {
      return row.ColData[row.ColData.length - 1]?.value || '0';
    }
    if (row.Summary?.ColData && Array.isArray(row.Summary.ColData)) {
      return row.Summary.ColData[row.Summary.ColData.length - 1]?.value || '0';
    }
    return '0';
  };

  const parseValue = (value: string): number => {
    if (!value || value === '') return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const sumValues = (values: string[]): string => {
    return values.reduce((sum, val) => sum + parseValue(val), 0).toString();
  };

  let income: MonthlySectionData | null = null;
  let costOfSales: MonthlySectionData | null = null;
  let grossProfit: { label: string; values: string[]; total: string } | null =
    null;
  const expenseSections: MonthlyExpenseSection[] = [];
  let expensesTotal: { label: string; values: string[]; total: string } | null =
    null;
  let otherIncome: MonthlySectionData | null = null;
  let profit: { label: string; values: string[]; total: string } | null = null;

  rows.forEach((row) => {
    const headerValue = row.Header?.ColData?.[0]?.value || '';
    const summary = row.Summary?.ColData;
    const summaryLabel = summary?.[0]?.value || '';
    // Summary ColData structure: [label, month1, month2, ..., monthN, total]
    const summaryValues = summary
      ? summary
          .slice(1, -1)
          .slice(0, numMonths)
          .map((col: any) => col?.value || '0')
      : [];
    const summaryTotal = summary
      ? summary[summary.length - 1]?.value || '0'
      : '0';

    // INCOME section
    if (headerValue.toUpperCase() === 'INCOME' || row.group === 'Income') {
      const items = extractMonthlyItems(row.Rows?.Row || [], numMonths);
      income = {
        header: 'Income',
        items,
        total: summaryLabel
          ? { label: summaryLabel, values: summaryValues, total: summaryTotal }
          : null,
      };
    }

    // COST OF GOODS SOLD / COST OF SALES section
    if (
      headerValue.toUpperCase().includes('COST OF GOODS SOLD') ||
      headerValue.toUpperCase().includes('COST OF SALES') ||
      row.group === 'COGS'
    ) {
      const items = extractMonthlyItems(row.Rows?.Row || [], numMonths);
      costOfSales = {
        header: 'Cost of Sales',
        items,
        total: summaryLabel
          ? { label: summaryLabel, values: summaryValues, total: summaryTotal }
          : null,
        isImportant: true,
      };
    }

    // Gross Profit
    if (
      summaryLabel.toUpperCase().includes('GROSS PROFIT') ||
      summaryLabel.toUpperCase().includes('GROSS INCOME')
    ) {
      grossProfit = {
        label: summaryLabel,
        values: summaryValues,
        total: summaryTotal,
      };
    }

    // EXPENSES section
    if (headerValue.toUpperCase() === 'EXPENSES' || row.group === 'Expenses') {
      const expenseRows = row.Rows?.Row || [];

      expenseRows.forEach((expenseRow: any) => {
        const expenseHeader = expenseRow.Header?.ColData?.[0]?.value || '';
        const expenseSummary = expenseRow.Summary?.ColData;
        const expenseSummaryLabel = expenseSummary?.[0]?.value || '';
        const expenseSummaryValues = expenseSummary
          ? expenseSummary
              .slice(1, numMonths + 1)
              .map((col: any) => col?.value || '0')
          : [];
        const expenseSummaryTotal = expenseSummary
          ? expenseSummary[expenseSummary.length - 1]?.value || '0'
          : '0';

        if (
          expenseHeader.toUpperCase().includes('EXPENSE') &&
          expenseRow.Rows?.Row
        ) {
          // Exclude E17 Payroll Expenses section entirely (only exact "E17 Payroll Expenses" section, not other payroll items)
          const upperExpenseHeader = expenseHeader.toUpperCase();
          if (
            upperExpenseHeader === 'E17 PAYROLL EXPENSES' ||
            (upperExpenseHeader.startsWith('E17') &&
              upperExpenseHeader.includes('PAYROLL EXPENSES') &&
              !upperExpenseHeader.includes('L'))
          ) {
            return;
          }

          const items = extractMonthlyItems(
            expenseRow.Rows.Row,
            numMonths,
            expenseHeader
          );
          expenseSections.push({
            header: expenseHeader,
            items,
            total: expenseSummaryLabel
              ? {
                  label: expenseSummaryLabel,
                  values: expenseSummaryValues,
                  total: expenseSummaryTotal,
                }
              : null,
          });
        }
      });

      if (
        summaryLabel.toUpperCase().includes('TOTAL') &&
        summaryLabel.toUpperCase().includes('EXPENSES')
      ) {
        expensesTotal = {
          label: summaryLabel,
          values: summaryValues,
          total: summaryTotal,
        };
      }
    }

    // OTHER INCOME section
    if (
      headerValue.toUpperCase().includes('OTHER INCOME') ||
      row.group === 'OtherIncome'
    ) {
      const items = extractMonthlyItems(row.Rows?.Row || [], numMonths);
      otherIncome = {
        header: 'Other Income',
        items,
        total: summaryLabel
          ? { label: summaryLabel, values: summaryValues, total: summaryTotal }
          : null,
      };
    }

    // PROFIT
    if (
      summaryLabel.toUpperCase() === 'PROFIT' ||
      summaryLabel.toUpperCase() === 'NET INCOME' ||
      row.group === 'NetIncome'
    ) {
      profit = {
        label: summaryLabel,
        values: summaryValues,
        total: summaryTotal,
      };
    }
  });

  return {
    income,
    costOfSales,
    grossProfit,
    expenses: {
      sections: expenseSections,
      total: expensesTotal,
    },
    otherIncome,
    profit,
  };
}

function extractMonthlyItems(
  rows: any[],
  numMonths: number,
  expenseSectionHeader?: string,
  indentLevel: number = 0
): Array<{ label: string; values: string[]; total: string; indent?: number }> {
  const items: Array<{
    label: string;
    values: string[];
    total: string;
    indent?: number;
  }> = [];

  if (!Array.isArray(rows)) return items;

  rows.forEach((row) => {
    // Check for Data rows (with or without type property)
    if (
      row.ColData &&
      Array.isArray(row.ColData) &&
      (!row.type || row.type === 'Data')
    ) {
      const label = row.ColData[0]?.value || '';
      if (label) {
        // Filter out excluded items
        // Exclude E17 Payroll Expenses (only exact "E17 Payroll Expenses" section, not other payroll items)
        const upperLabel = label.toUpperCase();
        if (
          upperLabel === 'E17 PAYROLL EXPENSES' ||
          (upperLabel.startsWith('E17') &&
            upperLabel.includes('PAYROLL EXPENSES') &&
            !upperLabel.includes('L'))
        ) {
          return;
        }
        // Exclude Online Subscription Fee from Expenses C
        if (
          expenseSectionHeader?.toUpperCase().includes('EXPENSE C') &&
          label.toUpperCase().includes('ONLINE SUBSCRIPTION')
        ) {
          return;
        }
        // Exclude Travel & conference from Expenses E
        if (
          expenseSectionHeader?.toUpperCase().includes('EXPENSE E') &&
          label.toUpperCase().includes('TRAVEL') &&
          label.toUpperCase().includes('CONFERENCE')
        ) {
          return;
        }

        const values = row.ColData.slice(1, numMonths + 1).map(
          (col: any) => col?.value || '0'
        );
        const total = row.ColData[row.ColData.length - 1]?.value || '0';
        items.push({
          label,
          values,
          total,
          indent: indentLevel > 0 ? indentLevel : undefined,
        });
      }
    }

    if (row.Header?.ColData && row.Rows?.Row) {
      const headerLabel = row.Header.ColData[0]?.value || '';

      // Exclude E17 Payroll Expenses section entirely (only exact "E17 Payroll Expenses" section, not other payroll items)
      const upperHeaderLabel = headerLabel.toUpperCase();
      if (
        upperHeaderLabel === 'E17 PAYROLL EXPENSES' ||
        (upperHeaderLabel.startsWith('E17') &&
          upperHeaderLabel.includes('PAYROLL EXPENSES') &&
          !upperHeaderLabel.includes('L'))
      ) {
        return;
      }

      // Exclude Online Subscription from Expenses C (check header label)
      if (
        expenseSectionHeader?.toUpperCase().includes('EXPENSE C') &&
        headerLabel.toUpperCase().includes('ONLINE SUBSCRIPTION')
      ) {
        return;
      }

      // Exclude Travel & conference from Expenses E (check header label)
      if (
        expenseSectionHeader?.toUpperCase().includes('EXPENSE E') &&
        headerLabel.toUpperCase().includes('TRAVEL') &&
        headerLabel.toUpperCase().includes('CONFERENCE')
      ) {
        return;
      }

      // ColData structure: [label, month1, month2, ..., monthN, total]
      const headerMonthValues = row.Header.ColData.slice(1, -1); // Exclude first and last
      const headerValues =
        headerMonthValues.length >= numMonths
          ? headerMonthValues
              .slice(0, numMonths)
              .map((col: any) => col?.value || '0')
          : row.Header.ColData.slice(1, numMonths + 1).map(
              (col: any) => col?.value || '0'
            );
      const headerTotal =
        row.Header.ColData[row.Header.ColData.length - 1]?.value || '0';

      // Check if Header has any non-empty values (excluding the label at index 0)
      // Header values are considered empty if all are empty, '0', or '0.00'
      const hasHeaderValue =
        headerValues.some(
          (val: string) => val && val !== '' && val !== '0' && val !== '0.00'
        ) ||
        (headerTotal && headerTotal !== '0' && headerTotal !== '0.00');

      // Check if this is a Payroll/Wages section - if so, always extract nested items for detailed display
      const isPayrollSection =
        expenseSectionHeader?.toUpperCase().includes('PAYROLL') ||
        headerLabel.toUpperCase().includes('PAYROLL') ||
        headerLabel.toUpperCase().includes('WAGES') ||
        headerLabel.toUpperCase().includes('WAGE');

      // For Payroll sections, add the header first (if it has a value), then add nested items with indentation
      if (isPayrollSection && row.Rows?.Row && Array.isArray(row.Rows.Row)) {
        // Add the header first if it has a value
        if (
          hasHeaderValue &&
          headerTotal &&
          headerTotal !== '0' &&
          headerTotal !== '0.00'
        ) {
          items.push({
            label: headerLabel,
            values: headerValues,
            total: headerTotal,
          });
        }
        // Then add nested items with indentation
        const nestedItems = extractMonthlyItems(
          row.Rows.Row,
          numMonths,
          expenseSectionHeader,
          1
        );
        items.push(...nestedItems);
        // Skip the summary for Payroll sections as we show individual items
        return;
      }

      if (
        hasHeaderValue &&
        headerTotal &&
        headerTotal !== '0' &&
        headerTotal !== '0.00'
      ) {
        items.push({
          label: headerLabel,
          values: headerValues,
          total: headerTotal,
        });
      } else {
        // Use Summary instead when Header values are empty
        if (row.Summary?.ColData) {
          const summaryLabel = row.Summary.ColData[0]?.value || '';
          // ColData structure: [label, month1, month2, ..., monthN, total]
          const summaryMonthValues = row.Summary.ColData.slice(1, -1); // Exclude first and last
          const summaryValues =
            summaryMonthValues.length >= numMonths
              ? summaryMonthValues
                  .slice(0, numMonths)
                  .map((col: any) => col?.value || '0')
              : row.Summary.ColData.slice(1, numMonths + 1).map(
                  (col: any) => col?.value || '0'
                );
          const summaryTotal =
            row.Summary.ColData[row.Summary.ColData.length - 1]?.value || '0';
          if (summaryLabel && summaryTotal && summaryTotal !== '0') {
            // Also filter summary labels
            if (
              expenseSectionHeader?.toUpperCase().includes('EXPENSE C') &&
              summaryLabel.toUpperCase().includes('ONLINE SUBSCRIPTION')
            ) {
              return;
            }
            if (
              expenseSectionHeader?.toUpperCase().includes('EXPENSE E') &&
              summaryLabel.toUpperCase().includes('TRAVEL') &&
              summaryLabel.toUpperCase().includes('CONFERENCE')
            ) {
              return;
            }
            items.push({
              label: summaryLabel,
              values: summaryValues,
              total: summaryTotal,
            });
          }
        }
      }
    }
  });

  return items;
}

/**
 * Convert PDF Uint8Array to base64 string
 */
export function pdfToBase64(pdfBytes: Uint8Array): string {
  const binary = String.fromCharCode(...pdfBytes);
  return Buffer.from(binary, 'binary').toString('base64');
}
