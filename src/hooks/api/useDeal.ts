"use client";

/**
 * useDeal — SWR hook for a single deal's data + all deal mutation actions.
 *
 * Replaces the scattered fetch() calls in useDealDetail.ts by delegating
 * all mutations to apiClient.deals.* while keeping SWR for the GET.
 */
import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { type DealDetail, type SingleDealResponse } from "@/lib/schemas";
import { haptic } from "@/lib/haptics";

export interface DealMutationState {
  isSubmitting: boolean;
  isUploadingContent: boolean;
}

export interface UseDealResult {
  deal: DealDetail | null;
  isLoading: boolean;
  error: string;
  refresh: () => void;
  mutationState: DealMutationState;
  // Mutations
  sign: () => Promise<boolean>;
  cancel: () => Promise<boolean>;
  reject: (reason: string) => Promise<boolean>;
  doAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean>;
  updateProduct: (payload: Record<string, unknown>) => Promise<boolean>;
  uploadContent: (file: File, folder?: string) => Promise<string | null>;
}

export function useDeal(
  id: string | null | undefined,
  sessionUserId: string | null | undefined,
  onToast: (type: "success" | "error" | "info", message: string) => void,
): UseDealResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingContent, setIsUploadingContent] = useState(false);

  const { data: dealData, isLoading, error: fetchErr, mutate } = useSWR<SingleDealResponse>(
    id && sessionUserId ? `/api/deals/${id}` : null,
    fetcher,
  );

  const deal: DealDetail | null = dealData?.deal ?? null;

  const error = fetchErr ? "Failed to fetch deal" : "";
  const refresh = useCallback(() => { mutate(); }, [mutate]);

  /** Generic error extractor */
  const extractMessage = (err: unknown): string => {
    if (err instanceof ApiClientError) return err.message;
    if (err instanceof Error) return err.message;
    return String(err);
  };

  const sign = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    setIsSubmitting(true);
    try {
      await apiClient.deals.sign(id);
      haptic.success();
      onToast("success", "Contract signed successfully.");
      refresh();
      return true;
    } catch (err) {
      onToast("error", extractMessage(err));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [id, onToast, refresh]);

  const cancel = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    setIsSubmitting(true);
    try {
      const data = await apiClient.deals.cancel(id) as { message?: string };
      haptic.success();
      onToast("success", data?.message ?? "Deal cancelled successfully.");
      refresh();
      return true;
    } catch (err) {
      onToast("error", extractMessage(err));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [id, onToast, refresh]);

  const reject = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!id) return false;
      setIsSubmitting(true);
      try {
        await apiClient.deals.reject(id, reason);
        haptic.success();
        onToast("success", "Invite successfully rejected.");
        refresh();
        return true;
      } catch (err) {
        onToast("error", extractMessage(err));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [id, onToast, refresh],
  );

  const doAction = useCallback(
    async (action: string, payload?: Record<string, unknown>): Promise<boolean> => {
      if (!id) return false;
      setIsSubmitting(true);
      try {
        const data = await apiClient.deals.action({
          action,
          dealId: id,
          ...payload,
        }) as { message?: string };
        haptic.success();
        onToast("success", data?.message ?? "Success!");
        refresh();
        return true;
      } catch (err) {
        onToast("error", extractMessage(err));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [id, onToast, refresh],
  );

  const updateProduct = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      if (!id) return false;
      setIsSubmitting(true);
      try {
        await apiClient.deals.updateProduct(id, payload);
        haptic.success();
        onToast("success", "Product status updated.");
        refresh();
        return true;
      } catch (err) {
        onToast("error", extractMessage(err));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [id, onToast, refresh],
  );

  const uploadContent = useCallback(
    async (file: File, folder = "content"): Promise<string | null> => {
      setIsUploadingContent(true);
      try {
        const data = await apiClient.upload.file(file, folder);
        const url = data?.data?.url ?? data?.url ?? null;
        if (data?.success && url) {
          onToast("success", "File uploaded successfully");
          return url;
        }
        onToast("error", "Upload failed: " + (data?.message ?? "Unknown error"));
        return null;
      } catch (err) {
        onToast("error", extractMessage(err));
        return null;
      } finally {
        setIsUploadingContent(false);
      }
    },
    [onToast],
  );

  return {
    deal,
    isLoading,
    error,
    refresh,
    mutationState: { isSubmitting, isUploadingContent },
    sign,
    cancel,
    reject,
    doAction,
    updateProduct,
    uploadContent,
  };
}
