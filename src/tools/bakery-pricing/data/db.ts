// Generic, reusable IndexedDB open/upgrade helper. Deliberately not
// hardcoded to this app's schema — schema.ts supplies the name, version,
// and migrations — so the exact same code path used in production is also
// what the migration tests exercise, just with a different migrations map.

export type Migration = (db: IDBDatabase, tx: IDBTransaction, oldVersion: number) => void

export function openDatabase(
  name: string,
  version: number,
  migrations: Record<number, Migration>,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const tx = request.transaction
      if (!tx) {
        reject(new Error('Upgrade transaction unavailable'))
        return
      }
      const oldVersion = event.oldVersion
      for (let v = oldVersion + 1; v <= version; v++) {
        const migrate = migrations[v]
        if (migrate) migrate(db, tx, oldVersion)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open database'))
    request.onblocked = () => reject(new Error('Database open blocked by another open connection'))
  })
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}
