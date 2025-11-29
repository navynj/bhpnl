import { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
// import { PageInfoType } from '@/lib/types';
// import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction } from 'react';
import { cn } from '@/lib/utils';

export interface PaginationType {
  page: number;
  size: number;
  total?: number; // Optional: total page count (may not be available for cursor-based pagination)
  // info: PageInfoType;
  fetch: (params?: {
    before?: string;
    after?: string;
    page?: number;
    goToFirst?: boolean;
    goToLast?: boolean;
  }) => Promise<void>;
}

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pagination: PaginationType;
  setPagination: Dispatch<SetStateAction<PaginationType>>;
  isPending?: boolean;
}

export function DataTablePagination<TData>({
  table,
  pagination,
  setPagination,
  isPending,
}: DataTablePaginationProps<TData>) {
  // const t = useTranslations('UI');

  // const handlePreviousPage = () => {
  //   if (pagination.page <= 1 && !pagination.info?.hasPreviousPage) return;

  //   const currentFetch = pagination.fetch;
  //   const newPage = Math.max(1, pagination.page - 1);

  //   setPagination((prev) => ({ ...prev, page: newPage }));

  //   // Call fetch after state update to ensure correct pagination state
  //   // For first page, always use page: 1 (cursor-based pagination will handle it)
  //   if (currentFetch) {
  //     if (newPage === 1) {
  //       currentFetch({
  //         page: 1,
  //       });
  //     } else {
  //       const currentInfo = pagination.info;
  //       if (currentInfo?.startCursor) {
  //         currentFetch({
  //           before: currentInfo.startCursor,
  //           page: newPage,
  //         });
  //       } else {
  //         currentFetch({
  //           page: newPage,
  //         });
  //       }
  //     }
  //   }
  // };

  // const handleNextPage = () => {
  //   if (!pagination.info?.hasNextPage) {
  //     if (pagination.total && pagination.page >= pagination.total) return;
  //   }

  //   const currentInfo = pagination.info;
  //   const currentFetch = pagination.fetch;
  //   const newPage = pagination.page + 1;

  //   setPagination((prev) => ({ ...prev, page: newPage }));

  //   // Call fetch after state update to ensure correct pagination state
  //   if (currentFetch) {
  //     if (currentInfo?.endCursor) {
  //       currentFetch({
  //         after: currentInfo.endCursor,
  //         page: newPage,
  //       });
  //     } else {
  //       currentFetch({
  //         page: newPage,
  //       });
  //     }
  //   }
  // };

  return (
    <></>
    // <div className="flex items-center justify-between px-2">
    //   <div className="flex items-center flex-wrap sm:gap-2 gap-8">
    //     <div className="flex items-center space-x-2">
    //       <p className="text-sm font-medium">{t('rowsPerPage')}</p>
    //       <Select
    //         value={`${pagination.size}`}
    //         onValueChange={(value) => {
    //           table.setPageSize(Number(value));
    //           setPagination((prev) => ({
    //             ...prev,
    //             size: Number(value),
    //             page: 1,
    //           }));
    //         }}
    //       >
    //         <SelectTrigger className="h-8 w-[70px]">
    //           <SelectValue placeholder={pagination.size} />
    //         </SelectTrigger>
    //         <SelectContent side="top">
    //           {[10, 20, 30, 40, 50].map((pageSize) => (
    //             <SelectItem key={pageSize} value={`${pageSize}`}>
    //               {pageSize}
    //             </SelectItem>
    //           ))}
    //         </SelectContent>
    //       </Select>
    //     </div>

    //     {/* Navigation buttons */}
    //     <div className="flex items-center space-x-2">
    //       {/* Go to first page button */}
    //       <Button
    //         variant="outline"
    //         className={cn('h-8 w-8 p-0', isPending ? 'cursor-not-allowed' : '')}
    //         onClick={() => {
    //           setPagination((prev) => ({ ...prev, page: 1 }));
    //           pagination.fetch?.({ goToFirst: true });
    //         }}
    //         disabled={isPending || pagination.page === 1}
    //         title={t('goToFirstPage')}
    //       >
    //         <span className="sr-only">{t('goToFirstPage')}</span>
    //         <span className="text-xs">&lt;&lt;</span>
    //       </Button>

    //       <Button
    //         variant="outline"
    //         className={cn('h-8 w-8 p-0', isPending ? 'cursor-not-allowed' : '')}
    //         onClick={handlePreviousPage}
    //         disabled={
    //           isPending ||
    //           (!pagination.info?.hasPreviousPage && pagination.page <= 1)
    //         }
    //       >
    //         <span className="sr-only">{t('goToPrevPage')}</span>
    //         <ChevronLeft className="h-4 w-4" />
    //       </Button>

    //       {/* Current page info */}
    //       <div className="flex items-center justify-center text-sm font-medium min-w-[80px]">
    //         {t('page')} {pagination.page}
    //         {pagination.total && ` ${t('of')} ${pagination.total}`}
    //       </div>

    //       <Button
    //         variant="outline"
    //         className={cn('h-8 w-8 p-0', isPending ? 'cursor-not-allowed' : '')}
    //         onClick={handleNextPage}
    //         disabled={
    //           isPending ||
    //           (!pagination.info?.hasNextPage &&
    //             (pagination.total
    //               ? pagination.page >= pagination.total
    //               : false))
    //         }
    //       >
    //         <span className="sr-only">{t('goToNextPage')}</span>
    //         <ChevronRight className="h-4 w-4" />
    //       </Button>
    //     </div>
    //   </div>
    // </div>
  );
}
