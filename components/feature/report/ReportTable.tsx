'use client';

import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { FileDown, ExternalLink } from 'lucide-react';
import { Report } from './types';

interface ReportTableProps {
  reports: Report[];
  isLoading: boolean;
  downloadingPdf: Set<string>;
  onDownloadPDF: (reportId: string) => void;
}

export function ReportTable({
  reports,
  isLoading,
  downloadingPdf,
  onDownloadPDF,
}: ReportTableProps) {
  const columns: ColumnDef<Report>[] = [
    {
      accessorKey: 'isMonthly',
      header: 'Type',
      cell: ({ row }) => {
        return row.original.isMonthly ? 'Monthly' : 'Period';
      },
    },
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
              onClick={() => onDownloadPDF(report.id)}
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
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Generated Reports</h2>
      <DataTable columns={columns} data={reports} isFetching={isLoading} />
    </div>
  );
}
