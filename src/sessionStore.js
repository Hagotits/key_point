const DB_NAME = 'skeleton-keypoint-labeler'
const DB_VERSION = 1
const STORE_NAME = 'sessions'
const UPDATED_AT_INDEX = 'updatedAt'

export const SESSION_SCHEMA_VERSION = 1

let databasePromise
const hydratedBlobs = new Map()

function getIndexedDB() {
  if (typeof globalThis === 'undefined') return null
  return globalThis.indexedDB || null
}

function normalizeSession(session) {
  if (!session) return null
  return {
    ...session,
    id: String(session.id),
    projectName: typeof session.projectName === 'string' ? session.projectName : '',
    keypointDefs: Array.isArray(session.keypointDefs) ? session.keypointDefs : [],
    edges: Array.isArray(session.edges) ? session.edges : [],
    images: Array.isArray(session.images) ? session.images : [],
    annotations:
      session.annotations && typeof session.annotations === 'object' ? session.annotations : {},
    currentImageId: session.currentImageId || null,
  }
}

function persistedImage(image) {
  const metadata = Object.fromEntries(
    Object.entries(image).filter(([key]) => key !== 'url' && key !== 'blob' && key !== 'file')
  )
  const imageBlob = image.blob ?? image.file
  return imageBlob === undefined ? metadata : { ...metadata, blob: imageBlob }
}

async function hydrateImage(image) {
  if (image.blob || image.file) return image
  if (typeof image.url !== 'string' || !image.url.startsWith('blob:')) return image
  if (typeof fetch !== 'function') throw new Error('Unable to hydrate blob URL')
  if (!hydratedBlobs.has(image.url)) {
    hydratedBlobs.set(
      image.url,
      fetch(image.url).then((response) => {
        if (!response.ok) throw new Error('Unable to hydrate blob URL')
        return response.blob()
      })
    )
  }
  return { ...image, blob: await hydratedBlobs.get(image.url) }
}

async function hydrateSession(session) {
  const images = await Promise.all(
    (Array.isArray(session.images) ? session.images : []).filter(Boolean).map(hydrateImage)
  )
  return { ...session, images }
}

export function toPersistedSession(session) {
  if (!session || typeof session !== 'object') {
    throw new TypeError('A session object is required')
  }
  if (!session.id) throw new TypeError('A session id is required')

  const now = Date.now()
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: String(session.id),
    projectName: session.projectName || '',
    keypointDefs: Array.isArray(session.keypointDefs) ? session.keypointDefs : [],
    edges: Array.isArray(session.edges) ? session.edges : [],
    images: (Array.isArray(session.images) ? session.images : [])
      .filter(Boolean)
      .map(persistedImage),
    annotations:
      session.annotations && typeof session.annotations === 'object' ? session.annotations : {},
    currentImageId: session.currentImageId || null,
    createdAt: Number.isFinite(session.createdAt) ? session.createdAt : now,
    updatedAt: now,
  }
}

export function openSessionDatabase() {
  const indexedDBApi = getIndexedDB()
  if (!indexedDBApi) {
    return Promise.reject(new Error('IndexedDB is not available in this browser'))
  }
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDBApi.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      if (!store.indexNames.contains(UPDATED_AT_INDEX)) {
        store.createIndex(UPDATED_AT_INDEX, UPDATED_AT_INDEX, { unique: false })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'))
  }).catch((error) => {
    databasePromise = undefined
    throw error
  })

  return databasePromise
}

export async function saveSession(session) {
  const record = toPersistedSession(await hydrateSession(session))
  const db = await openSessionDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(record)
    transaction.oncomplete = () => resolve(record)
    transaction.onerror = () =>
      reject(transaction.error || new Error('Unable to save session'))
    transaction.onabort = () => reject(transaction.error || new Error('Session save aborted'))
  })
}

async function readSessions(requestFactory) {
  const db = await openSessionDatabase()
  const result = await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    let request
    try {
      request = requestFactory(transaction.objectStore(STORE_NAME))
    } catch (error) {
      reject(error)
      return
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to read sessions'))
    transaction.onerror = () =>
      reject(transaction.error || new Error('Unable to read sessions'))
  })
  return result
}

export async function loadSession(id) {
  if (!id) return null
  return normalizeSession(await readSessions((store) => store.get(String(id))))
}

export async function listSessions() {
  const records = await readSessions((store) => store.getAll())
  return (Array.isArray(records) ? records : [])
    .map(normalizeSession)
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function deleteSession(id) {
  if (!id) return
  const db = await openSessionDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(String(id))
    transaction.oncomplete = resolve
    transaction.onerror = () =>
      reject(transaction.error || new Error('Unable to delete session'))
    transaction.onabort = () => reject(transaction.error || new Error('Session delete aborted'))
  })
}
