// TanStack Query hooks over the local store and the resolver. Screens use only these.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getStore, type UserEntry } from '../data/db';
import { fetchProduct } from '../data/offClient';
import type { OffProduct } from '../data/normalize';
import { mergeProduct, resolveProduct, type Resolution } from '../data/resolver';
import { findAlternatives } from './alternatives/alternatives';
import type { OverallBand } from './product/productView';
import { EMPTY_PROFILE, type Profile } from './profile/flags';

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

export function useSetSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ barcode, saved }: { barcode: string; saved: boolean }) =>
      (await getStore()).setSaved(barcode, saved, Date.now()),
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

/** A JSON setting. Updates show at once and build on the latest value, even mid-load. */
function useSetting<T>(key: string, fallback: T) {
  const qc = useQueryClient();
  const queryKey = ['setting', key];
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<T> => {
      const raw = await (await getStore()).getSetting(key);
      return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    },
  });
  const mutation = useMutation({
    mutationFn: async (value: T) => (await getStore()).setSetting(key, JSON.stringify(value)),
  });
  const update = (next: (prev: T) => T) => {
    const value = next(qc.getQueryData<T>(queryKey) ?? fallback);
    // A first load still running would put back the old value.
    void qc.cancelQueries({ queryKey });
    qc.setQueryData(queryKey, value);
    mutation.mutate(value);
  };
  return [query.data ?? fallback, update] as const;
}

export const useProfile = () => useSetting<Profile>('profile', EMPTY_PROFILE);

export type Appearance = 'system' | 'light' | 'dark';
export const useAppearance = () =>
  useSetting<{ mode: Appearance }>('appearance', { mode: 'system' });

/** Healthier options for a Poor or Bad product; cached for a day to stay well under OFF's limits. */
export function useAlternatives(barcode: string, band: OverallBand, off: OffProduct) {
  return useQuery({
    queryKey: ['alternatives', barcode, band],
    queryFn: () => findAlternatives({ barcode, band, off }),
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });
}
