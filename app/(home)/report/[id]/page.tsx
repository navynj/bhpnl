'use client';

import { useState, useEffect } from 'react';
import { fetchData } from '@/lib/fetch';
import { toast } from 'sonner';
import { format, getYear } from 'date-fns';
import { ReportTabs } from '@/components/feature/report/ReportTabs';
import { PeriodReportForm } from '@/components/feature/report/PeriodReportForm';
import { MonthlyReportForm } from '@/components/feature/report/MonthlyReportForm';
import { ReportTable } from '@/components/feature/report/ReportTable';
import {
  Report,
  QBConnection,
  ReportMode,
  SelectedMonth,
} from '@/components/feature/report/types';

const ReportPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const [connectionId, setConnectionId] = useState<string>('');
  const [connectionName, setConnectionName] = useState<string | null>(null);
  const [reportMode, setReportMode] = useState<ReportMode>('period');
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedMonths, setSelectedMonths] = useState<SelectedMonth[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [isGenerating, setIsGenerating] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState<Set<string>>(new Set());
  const [costOfSalesTarget, setCostOfSalesTarget] = useState<string>('30');
  const [payrollTarget, setPayrollTarget] = useState<string>('30');
  const [profitTarget, setProfitTarget] = useState<string>('10');

  useEffect(() => {
    const init = async () => {
      const resolvedParams = await params;
      setConnectionId(resolvedParams.id);
      fetchConnectionInfo(resolvedParams.id);
      fetchReports(resolvedParams.id);
    };
    init();
  }, [params]);

  const fetchConnectionInfo = async (connId: string) => {
    try {
      const response = await fetchData(
        'quickbook/connections?all=true',
        () => {}
      );
      if (response?.success && response?.connections) {
        const connection = response.connections.find(
          (conn: QBConnection) => conn.id === connId
        );
        if (connection) {
          setConnectionName(connection.locationName);
        }
      }
    } catch (error) {
      console.error('Failed to fetch connection info:', error);
    }
  };

  const fetchReports = async (connId: string) => {
    try {
      setIsLoadingReports(true);
      const response = await fetchData(
        `reports?connectionId=${connId}`,
        setIsLoadingReports
      );
      if (response?.success && response?.reports) {
        setReports(response.reports);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const handleGenerateReport = async () => {
    if (!connectionId) {
      toast.error('Connection ID is required');
      return;
    }

    if (reportMode === 'period') {
      if (!startDate || !endDate) {
        toast.error('Please select both start date and end date');
        return;
      }

      if (startDate > endDate) {
        toast.error('Start date must be before end date');
        return;
      }
    } else {
      if (selectedMonths.length === 0) {
        toast.error('Please select at least one month');
        return;
      }

      if (selectedMonths.length > 3) {
        toast.error('You can select up to 3 months');
        return;
      }
    }

    try {
      setIsGenerating(true);

      if (reportMode === 'period') {
        const startDateStr = format(startDate!, 'yyyy-MM-dd');
        const endDateStr = format(endDate!, 'yyyy-MM-dd');

        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          }/api/reports`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              connectionId,
              startDate: startDateStr,
              endDate: endDateStr,
              accountingMethod: 'Accrual',
              targetPercentages: {
                costOfSales: costOfSalesTarget
                  ? parseFloat(costOfSalesTarget)
                  : undefined,
                payroll: payrollTarget ? parseFloat(payrollTarget) : undefined,
                profit: profitTarget ? parseFloat(profitTarget) : undefined,
              },
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to generate report');
        }

        toast.success('Report generated and saved to Notion successfully', {
          action: data.report?.notionUrl
            ? {
                label: 'View in Notion',
                onClick: () => window.open(data.report.notionUrl, '_blank'),
              }
            : undefined,
        });
      } else {
        // Monthly report
        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          }/api/reports`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              connectionId,
              months: selectedMonths.map((m) => ({
                year: m.year,
                month: m.month + 1, // Convert 0-11 to 1-12
              })),
              accountingMethod: 'Accrual',
              targetPercentages: {
                costOfSales: costOfSalesTarget
                  ? parseFloat(costOfSalesTarget)
                  : undefined,
                payroll: payrollTarget ? parseFloat(payrollTarget) : undefined,
                profit: profitTarget ? parseFloat(profitTarget) : undefined,
              },
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to generate report');
        }

        toast.success('Report generated and saved to Notion successfully', {
          action: data.report?.notionUrl
            ? {
                label: 'View in Notion',
                onClick: () => window.open(data.report.notionUrl, '_blank'),
              }
            : undefined,
        });
      }

      fetchReports(connectionId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddMonth = (month: number) => {
    if (!selectedYear) {
      toast.error('Please select a year first');
      return;
    }

    if (selectedMonths.length >= 3) {
      toast.error('You can select up to 3 months');
      return;
    }

    const monthExists = selectedMonths.some(
      (m) => m.year === selectedYear && m.month === month
    );

    if (monthExists) {
      // 토글로 처리되므로 여기서는 에러를 표시하지 않음
      return;
    }

    setSelectedMonths([...selectedMonths, { year: selectedYear, month }]);
  };

  const handleRemoveMonth = (year: number, month: number) => {
    setSelectedMonths(
      selectedMonths.filter((m) => !(m.year === year && m.month === month))
    );
  };

  const handleDownloadPDF = async (reportId: string) => {
    if (downloadingPdf.has(reportId)) return;

    try {
      setDownloadingPdf((prev) => new Set(prev).add(reportId));
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        }/api/reports/${reportId}/pdf`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Failed to download PDF' }));
        throw new Error(error.error || 'Failed to download PDF');
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `P&L_Report_${reportId}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setDownloadingPdf((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Profit & Loss Reports</h1>
        {connectionName && (
          <p className="text-lg font-semibold mt-1 text-foreground">
            {connectionName}
          </p>
        )}
        <p className="text-muted-foreground mt-2">
          Generate and manage your QuickBooks P&L reports
        </p>
      </div>

      <div className="border rounded-lg p-6 space-y-4">
        <ReportTabs mode={reportMode} onModeChange={setReportMode} />

        {reportMode === 'period' && (
          <PeriodReportForm
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onGenerate={handleGenerateReport}
            isGenerating={isGenerating}
            connectionId={connectionId}
            costOfSalesTarget={costOfSalesTarget}
            payrollTarget={payrollTarget}
            profitTarget={profitTarget}
            onCostOfSalesTargetChange={setCostOfSalesTarget}
            onPayrollTargetChange={setPayrollTarget}
            onProfitTargetChange={setProfitTarget}
          />
        )}

        {reportMode === 'monthly' && (
          <MonthlyReportForm
            selectedYear={selectedYear}
            selectedMonths={selectedMonths}
            onYearChange={setSelectedYear}
            onAddMonth={handleAddMonth}
            onRemoveMonth={handleRemoveMonth}
            onGenerate={handleGenerateReport}
            isGenerating={isGenerating}
            connectionId={connectionId}
            costOfSalesTarget={costOfSalesTarget}
            payrollTarget={payrollTarget}
            profitTarget={profitTarget}
            onCostOfSalesTargetChange={setCostOfSalesTarget}
            onPayrollTargetChange={setPayrollTarget}
            onProfitTargetChange={setProfitTarget}
          />
        )}
      </div>

      <ReportTable
        reports={reports}
        isLoading={isLoadingReports}
        downloadingPdf={downloadingPdf}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  );
};

export default ReportPage;
