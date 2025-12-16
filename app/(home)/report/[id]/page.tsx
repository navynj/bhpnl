'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { fetchData } from '@/lib/fetch';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { FileDown, FileText, ExternalLink, CalendarIcon } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/Calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

interface Report {
  id: string;
  connectionId: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  notionUrl?: string;
  pdfUrl?: string;
}

interface QBConnection {
  id: string;
  realmId: string;
  locationName: string | null;
  hasAccess: boolean;
}

const ReportPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const [connectionId, setConnectionId] = useState<string>('');
  const [connectionName, setConnectionName] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState<Set<string>>(new Set());

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

    if (!startDate || !endDate) {
      toast.error('Please select both start date and end date');
      return;
    }

    if (startDate > endDate) {
      toast.error('Start date must be before end date');
      return;
    }

    try {
      setIsGenerating(true);
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

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
      fetchReports(connectionId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
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

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `P&L_Report_${reportId}.pdf`;
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

  const columns: ColumnDef<Report>[] = [
    {
      accessorKey: 'startDate',
      header: 'Start Date',
      cell: ({ row }) => {
        const date = new Date(row.original.startDate);
        return format(date, 'MMM dd, yyyy');
      },
    },
    {
      accessorKey: 'endDate',
      header: 'End Date',
      cell: ({ row }) => {
        const date = new Date(row.original.endDate);
        return format(date, 'MMM dd, yyyy');
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created At',
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return format(date, 'MMM dd, yyyy HH:mm');
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const report = row.original;
        const isDownloadingPdf = downloadingPdf.has(report.id);

        return (
          <div className="flex items-center gap-2">
            {report.notionUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(report.notionUrl, '_blank')}
                disabled={isDownloadingPdf}
              >
                <ExternalLink className="h-4 w-4" />
                View in Notion
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadPDF(report.id)}
              disabled={isDownloadingPdf}
              isLoading={isDownloadingPdf}
            >
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        );
      },
    },
  ];

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
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                  disabled={isGenerating}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <span className="pb-1.5">~</span>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                  disabled={isGenerating}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => (startDate ? date < startDate : false)}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating || !connectionId || !startDate || !endDate}
              isLoading={isGenerating}
            >
              <FileText className="h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Generated Reports</h2>
        <DataTable
          columns={columns}
          data={reports}
          isFetching={isLoadingReports}
        />
      </div>
    </div>
  );
};

export default ReportPage;
