'use client';

import { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/utils';
import { PropsWithChildren } from 'react';

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  options?: string[];
  title?: string;
  enableFilter?: boolean;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  options = [],
}: DataTableColumnHeaderProps<TData, TValue>) {
  const sorted = column.getIsSorted();
  const currentFilterValue = column.getFilterValue() as string | undefined;
  const canSort = column.getCanSort();
  const canHide = column.getCanHide();

  const ColulmnHeader = ({
    children,
    className,
    ...props
  }: PropsWithChildren<{ className?: string }>) => {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn('-ml-3 h-8 data-[state=open]:bg-accent', className)}
        {...props}
      >
        {title && <span>{title}</span>}
        {children}
      </Button>
    );
  };

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {canHide || canSort ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ColulmnHeader>
              {sorted === 'desc' ? (
                <ArrowDown className="ml-1 h-3.5 w-3.5" />
              ) : sorted === 'asc' ? (
                <ArrowUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5" />
              )}
            </ColulmnHeader>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start">
            {options.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                  Filter
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={currentFilterValue ?? ''}
                  onValueChange={(value) =>
                    column.setFilterValue(value === '' ? undefined : value)
                  }
                >
                  <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
                  {options.map((v) => (
                    <DropdownMenuRadioItem key={String(v)} value={String(v)}>
                      {String(v)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            {options.length > 0 && <DropdownMenuSeparator />}
            {canSort && sorted && (
              <>
                <DropdownMenuItem onClick={() => column.clearSorting()}>
                  <X className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                  Clear sort
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {canSort && (
              <>
                <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                  Asc
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                  Desc
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </>
            )}
            {canHide && (
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
                Hide
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <ColulmnHeader className="cursor-default hover:bg-transparent active:scale-100" />
      )}
    </div>
  );
}
