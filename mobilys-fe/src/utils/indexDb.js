import { get, set, del } from "idb-keyval";

export function makeKey({ prefix = "joukou", scenarioId, tag } = {}) {
    if (!scenarioId) throw new Error("makeKey: 'scenarioId' is required");
    const head = prefix ? `${prefix}-${scenarioId}` : String(scenarioId);
    return tag ? `${head}:${tag}` : head;
}

function resolveKey(keyOrParams) {
    if (typeof keyOrParams === "string") return keyOrParams;
    return makeKey(keyOrParams);
}

export async function saveCsvToIDB(keyOrParams, file) {
    const key = resolveKey(keyOrParams);
    const blob = file instanceof Blob ? file : new Blob([file]);
    await set(key, blob);
    return key;
}

export async function loadCsvFromIDB(keyOrParams) {
    const key = resolveKey(keyOrParams);
    return await get(key); // Blob | undefined
}

export async function removeCsvFromIDB(keyOrParams) {
    const key = resolveKey(keyOrParams);
    await del(key);
}

export async function hasCsvInIDB(keyOrParams) {
    const key = resolveKey(keyOrParams);
    const v = await get(key);
    return !!v;
}

export function deleteDB(dbName) {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
        } catch {
            resolve();
        }
    });
}

export async function clearAllIndexedDB() {
    try {
        if (typeof indexedDB.databases === "function") {
            console.log("Clearing all IndexedDB databases");
            const dbs = await indexedDB.databases();
            await Promise.all(
                (dbs || [])
                    .map((db) => db && db.name)
                    .filter(Boolean)
                    .map((name) => deleteDB(name))
            );
        } else {
            const knownDbNames = ["keyval", "od", "joukou"];
            await Promise.all(knownDbNames.map((name) => deleteDB(name)));
        }
    } catch {
        // swallow error: best-effort
    }
}
