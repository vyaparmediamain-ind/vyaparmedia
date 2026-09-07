export async function fetcher<T = unknown>(url: string): Promise<T> {
const res = await fetch(url);
if (!res.ok) {
const errorData = await res.json().catch(() => ({}));
const error = new Error(errorData.message || errorData.error || `An error occurred while fetching ${url}`);
(error as Error & { status?: number }).status = res.status;
throw error;
}
return res.json();
}
