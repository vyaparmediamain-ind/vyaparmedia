import { Button } from "./Button";

interface PaginationProps {
page: number;
totalPages: number;
setPage: (update: (prev: number) => number) => void;
marginTop?: string;
}

export function Pagination({ page, totalPages, setPage, marginTop = "12px" }: Readonly<PaginationProps>) {
if (totalPages <= 1) return null;
const mtClass = marginTop === "32px" ? "mt-8" : "mt-3";
return (
<nav
aria-label="Pagination"
className={`flex items-center justify-center gap-3 mb-4 ${mtClass}`}
>
<Button
variant="secondary"
onClick={() => setPage((p) => Math.max(1, p - 1))}
disabled={page === 1}
aria-label="Go to previous page"
className="min-w-90"
>
Previous
</Button>
<span
aria-current="page"
aria-live="polite"
className="text-sm font-semibold text-secondary"
>
Page {page} of {totalPages}
</span>
<Button
variant="secondary"
onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
disabled={page === totalPages}
aria-label="Go to next page"
className="min-w-90"
>
Next
</Button>
</nav>
);
}

