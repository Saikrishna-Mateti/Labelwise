// TanStack Query hooks over the local store and the resolver. Screens use only these.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getStore, type UserEntry } from '../data/db';
import { fetchProduct } from '../data/offClient';
import { mergeProduct, resolveProduct, type Resolution } from '../data/resolver';

export function useProduct(barcode: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['product', barcode],
    queryFn: async () => {
      const result = await resolveProduct(barcode, { store: await getStore(), fetchProduct });
      // The scan was recorded before the product was cached; refresh history so it shows the product.
      qc.invalidateQueries({ queryKey: ['scans'] });
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
