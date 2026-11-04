// Text read from the label photos on the Scan screen, handed to the entry form for checking.
// In memory only: the photos and their text never leave the phone and aren't stored.

export interface PendingLabel {
  nutrition: string[];
  ingredients: string[];
}

const pending = new Map<string, PendingLabel>();

export const putPendingLabel = (id: string, label: PendingLabel) => pending.set(id, label);

export const getPendingLabel = (id: string) => pending.get(id);
export const clearPendingLabel = (id: string) => pending.delete(id);
