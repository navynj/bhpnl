'use client';

import { fetchData } from '@/lib/fetch';
import { useState } from 'react';
import { DataTable, DataTableProps } from '../ui/DataTable';

interface DataTableClientProps<T extends { id: string }>
  extends Omit<DataTableProps<T>, 'isFetching'> {
  url: string;
}

const DataTableClient = <T extends { id: string }>({
  columns,
  url,
  data: initialData,
}: DataTableClientProps<T>) => {
  const [data, setData] = useState(initialData);
  const [isFetching, setIsFetching] = useState(false);

  //   ==== refetch func.. just in case...
  //   const refetch = async () => {
  //     try {
  //       const newData = await fetchData(url, setIsFetching);
  //       if (newData) {
  //         setData(newData);
  //       }
  //     } catch (error) {
  //       // Error is already handled in fetchData (toast notification)
  //       console.error('Failed to refetch data:', error);
  //     }
  //   };

  return <DataTable columns={columns} data={data} isFetching={isFetching} />;
};

export default DataTableClient;
