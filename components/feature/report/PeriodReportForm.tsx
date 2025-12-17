'use client';

import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, FileText } from 'lucide-react';

interface PeriodReportFormProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
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

export function PeriodReportForm({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onGenerate,
  isGenerating,
  connectionId,
  costOfSalesTarget,
  payrollTarget,
  profitTarget,
  onCostOfSalesTargetChange,
  onPayrollTargetChange,
  onProfitTargetChange,
}: PeriodReportFormProps) {
  return (
    <div className="space-y-4">
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
                onSelect={onStartDateChange}
                captionLayout="dropdown"
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
                onSelect={onEndDateChange}
                captionLayout="dropdown"
                initialFocus
                disabled={(date) => (startDate ? date < startDate : false)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-end">
          <Button
            onClick={onGenerate}
            disabled={isGenerating || !connectionId || !startDate || !endDate}
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
