import { Loader } from '@/components/ui/Loader';

export default function Loading() {
  return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Loader className="w-8 h-8" />
    </div>
  );
}

