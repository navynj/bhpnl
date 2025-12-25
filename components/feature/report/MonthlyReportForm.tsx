'use client';

import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { format, getYear } from 'date-fns';
import { FileText, X } from 'lucide-react';
import { SelectedMonth } from './types';

interface MonthlyReportFormProps {
  selectedYear: number;
  selectedMonths: SelectedMonth[];
  onYearChange: (year: number) => void;
  onAddMonth: (month: number) => void;
  onRemoveMonth: (year: number, month: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  connectionId: string;
  costOfSalesTarget: string;
  payrollTarget: string;
  profitTarget: string;
  onCostOfSalesTargetChange: (value: string) => void;
  onPayrollTargetChange: (value: string) => void;
  onProfitTargetChange: (value: string) => void;
}

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

const getYearOptions = () => {
  const currentYear = getYear(new Date());
  return [currentYear, currentYear - 1, currentYear - 2];
};

export function MonthlyReportForm({
  selectedYear,
  selectedMonths,
  onYearChange,
  onAddMonth,
  onRemoveMonth,
  onGenerate,
  isGenerating,
  connectionId,
  costOfSalesTarget,
  payrollTarget,
  profitTarget,
  onCostOfSalesTargetChange,
  onPayrollTargetChange,
  onProfitTargetChange,
}: MonthlyReportFormProps) {
  const handleToggleMonth = (month: number) => {
    const isSelected = selectedMonths.some(
      (m) => m.year === selectedYear && m.month === month
    );

    if (isSelected) {
      // 이미 선택된 경우 제거
      onRemoveMonth(selectedYear, month);
    } else {
      // 선택되지 않은 경우 추가
      onAddMonth(month);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-start justify-between space-y-4">
        <div className="flex gap-5 items-start ">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">
                Select Year
              </label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => onYearChange(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">
              Select Month <span className="text-red-500">(Max 3 months)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {monthNames.map((monthName, index) => {
                const monthNumber = index; // 0-11
                const isSelected = selectedMonths.some(
                  (m) => m.year === selectedYear && m.month === monthNumber
                );
                const isDisabled = selectedMonths.length >= 3 && !isSelected;

                return (
                  <Button
                    key={monthName}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handleToggleMonth(monthNumber)}
                    disabled={isGenerating || isDisabled}
                    className="w-fit"
                  >
                    {monthName}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
        {/* Selected Months */}
        <div className="flex justify-between items-end">
          <div className="space-y-2 w-[320px]">
            <label className="text-sm font-medium">Selected Months:</label>
            <div className="flex flex-wrap gap-2">
              {selectedMonths.length > 0 ? (
                selectedMonths.map((month) => (
                  <div
                    key={`${month.year}-${month.month}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md"
                  >
                    <span className="text-sm">
                      {format(new Date(month.year, month.month, 1), 'MMM yyyy')}
                    </span>
                    <button
                      onClick={() => onRemoveMonth(month.year, month.month)}
                      className="text-muted-foreground hover:text-foreground"
                      disabled={isGenerating}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No months selected</span>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">&nbsp;</label>
          <Button
            onClick={onGenerate}
            disabled={
              isGenerating || !connectionId || selectedMonths.length === 0
            }
            isLoading={isGenerating}
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Cost of Sales Target (%)
          </label>
          <Input
            type="number"
            value={costOfSalesTarget}
            onChange={(e) => onCostOfSalesTargetChange(e.target.value)}
            placeholder="e.g., 30.5"
            disabled={isGenerating}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">
            Payroll Target (%)
          </label>
          <Input
            type="number"
            value={payrollTarget}
            onChange={(e) => onPayrollTargetChange(e.target.value)}
            placeholder="e.g., 25.0"
            disabled={isGenerating}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">
            Profit Target (%)
          </label>
          <Input
            type="number"
            value={profitTarget}
            onChange={(e) => onProfitTargetChange(e.target.value)}
            placeholder="e.g., 15.0"
            disabled={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
