import { Loader2 } from "lucide-react";

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-400 ${className}`} />;
}

export function FullScreenSpinner() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[40vh]">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
