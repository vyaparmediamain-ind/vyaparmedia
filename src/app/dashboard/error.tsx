"use client";


import { logger } from "@/lib/logger-client";
import { useEffect } from "react";
import { Button } from "@/components/ui";

interface DashboardErrorProps {
readonly error: Error & { readonly digest?: string };
readonly reset: () => void;
}

export default function DashboardError({
error,
reset,
}: DashboardErrorProps) {
useEffect(() => {
logger.error(error);
}, [error]);

return (
<div
role="alert"
aria-live="assertive"
className="flex justify-center items-center flex-col gap-6 bg-primary text-primary h-100vh"
>
<h2>Something went wrong!</h2>
<Button
variant="primary"
aria-label="Try rendering the dashboard again"
onClick={
// Attempt to recover by trying to re-render the segment
() => reset()
}
className="text-base rounded-md px-6-py-3"
>
Try again
</Button>
</div>
);
}
