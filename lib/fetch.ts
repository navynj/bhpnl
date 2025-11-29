import { SetStateAction } from 'react';
import { toast } from 'sonner';

export async function fetchData(
  url: string,
  setIsLoading?: React.Dispatch<SetStateAction<boolean>>,
  options?: RequestInit
) {
  try {
    setIsLoading && setIsLoading(true);
    const res = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      }/api/${url}`,
      options
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Something went wrong');
    }
    setIsLoading && setIsLoading(false);

    return data;
  } catch (error) {
    setIsLoading && setIsLoading(false);
    console.error(error);
    const msg = (error as Error).message;

    // Only call toast in client-side context
    if (typeof window !== 'undefined') {
      toast.error(msg, {
        action: 'Dismiss',
      });
    }
  }
}
