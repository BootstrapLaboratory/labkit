export type ExternalStoreListener = () => void;

export type ExternalStoreUnsubscribe = () => void;

export type ExternalStoreUpdater<TSnapshot> = (
  currentSnapshot: TSnapshot,
) => TSnapshot;

export type ExternalStore<TSnapshot> = {
  getSnapshot(): TSnapshot;
  setSnapshot(nextSnapshot: TSnapshot): void;
  updateSnapshot(updater: ExternalStoreUpdater<TSnapshot>): void;
  subscribe(listener: ExternalStoreListener): ExternalStoreUnsubscribe;
  emit(): void;
};

export function createExternalStore<TSnapshot>(
  initialSnapshot: TSnapshot,
): ExternalStore<TSnapshot> {
  let snapshot = initialSnapshot;
  const listeners = new Set<ExternalStoreListener>();

  const emit = () => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    setSnapshot: (nextSnapshot) => {
      snapshot = nextSnapshot;
      emit();
    },
    updateSnapshot: (updater) => {
      snapshot = updater(snapshot);
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    emit,
  };
}
