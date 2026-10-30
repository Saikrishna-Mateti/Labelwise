// TanStack Query hooks over the local store and the resolver. Screens use only these.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getStore, type UserEntry } from '../data/db';
import { fetchProduct } from '../data/offClient';
import type { OffProduct } from '../data/normalize';
import { mergeProduct, resolveProduct, type Resolution } from '../data/resolver';
import { findAlternatives } from './alternatives/alternatives';
import type { OverallBand } from './product/productView';

const DAY_MS = 24 * 60 * 60 * 1000;

export function useProduct(barcode: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['product', barcode],
    queryFn: async () => {
      const result = await resolveProduct(barcode, { store: await getStore(), fetchProduct });
      // The scan was recorded before the product was cached; refresh lists so they show the product.
      qc.invalidateQueries({ queryKey: ['scans'] });
      qc.invalidateQueries({ queryKey: ['saved'] });
      return result;
    },
  });
}

/** Saves the user's values and rescores at once from what is already loaded; no network call. */
export function useSaveEntry(barcode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Omit<UserEntry, 'updatedAt'>) => {
      const entry = { ...values, updatedAt: Date.now() };
      await (await getStore()).putUserEntry(barcode, entry);
      return entry;
    },
    onSuccess: (entry) => {
      qc.setQueryData<Resolution>(['product', barcode], (prev) => {
        const ok =
          prev?.status === 'ok' ? (prev as Extract<Resolution, { status: 'ok' }>) : undefined;
        const product = mergeProduct(barcode, ok?.product.off, entry);
        product.offFetchedAt = ok?.product.offFetchedAt;
        return ok?.offError
          ? { status: 'ok', product, offError: ok.offError }
          : { status: 'ok', product };
      });
      qc.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}

export function useScans() {
  return useQuery({ queryKey: ['scans'], queryFn: async () => (await getStore()).listScans() });
}

export function useRecordScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (barcode: string) => (await getStore()).addScan(barcode, Date.now()),
    onSettled: () => qc.invalidateQueries({ queryKey: ['scans'] }),
  });
}

export function useDeleteScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await getStore()).deleteScan(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['scans'] }),
  });
}

export function useClearScans() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await getStore()).clearScans(),
    onSettled: () => qc.invalidateQueries({ queryKey: ['scans'] }),
  });
}

export function useClearSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await getStore()).clearSaved(),
    // Also refreshes each product's bookmark button.
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}

export function useRemoveSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (barcode: string) => (await getStore()).setSaved(barcode, false, Date.now()),
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
}

export function useSavedList() {
  return useQuery({ queryKey: ['saved'], queryFn: async () => (await getStore()).listSaved() });
}

/** Whether a product is saved, and a toggle that updates the button at once. */
export function useSaved(barcode: string) {
  const qc = useQueryClient();
  const key = ['saved', barcode];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => (await getStore()).isSaved(barcode),
  });
  const mutation = useMutation({
    mutationFn: async (saved: boolean) => (await getStore()).setSaved(barcode, saved, Date.now()),
    onMutate: (saved) => qc.setQueryData(key, saved),
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  });
  return [query.data ?? false, mutation.mutate] as const;
}

export type PrimaryMethod = 'inr' | 'nutriscore';
const PRIMARY_KEY = 'primaryMethod';

export function usePrimaryMethod() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['setting', PRIMARY_KEY],
    queryFn: async (): Promise<PrimaryMethod> =>
      (await (await getStore()).getSetting(PRIMARY_KEY)) === 'nutriscore' ? 'nutriscore' : 'inr',
  });
  const mutation = useMutation({
    mutationFn: async (m: PrimaryMethod) => (await getStore()).setSetting(PRIMARY_KEY, m),
    onMutate: (m) => qc.setQueryData(['setting', PRIMARY_KEY], m),
  });
  return [query.data ?? 'inr', mutation.mutate] as const;
}

/** Healthier options for a Poor or Bad product; cached for a day to stay well under OFF's limits. */
export function useAlternatives(barcode: string, band: OverallBand, off: OffProduct) {
  return useQuery({
    queryKey: ['alternatives', barcode, band],
    queryFn: () => findAlternatives({ barcode, band, off }),
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });
}
