// Tests for the Bakery Pricing Calculator's IndexedDB schema and the
// generic open/upgrade mechanism it's built on. Uses fake-indexeddb (a
// full reimplementation of the IndexedDB algorithm, not a hand-rolled
// mock) so these run fast in Node; see bakeryPricingRealBrowserData.test.ts
// for the companion real-browser check.
//
// Run with: node --test test/tools/bakeryPricingDb.test.ts

import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase, promisifyRequest, promisifyTransaction } from '../../src/tools/bakery-pricing/data/db.ts'
import {
  openAppDatabase,
  DB_NAME,
  DB_VERSION,
  STORE_INGREDIENTS,
  STORE_RECIPES,
  STORE_USAGES,
  INDEX_USAGES_BY_RECIPE,
  INDEX_USAGES_BY_INGREDIENT,
  INDEX_INGREDIENTS_BY_NAME,
} from '../../src/tools/bakery-pricing/data/schema.ts'

test('fresh database creation: all object stores and indexes exist', async () => {
  const db = await openAppDatabase()
  try {
    assert.equal(db.name, DB_NAME)
    assert.equal(db.version, DB_VERSION)
    assert.ok(db.objectStoreNames.contains(STORE_INGREDIENTS))
    assert.ok(db.objectStoreNames.contains(STORE_RECIPES))
    assert.ok(db.objectStoreNames.contains(STORE_USAGES))

    const tx = db.transaction([STORE_INGREDIENTS, STORE_USAGES], 'readonly')
    assert.ok(tx.objectStore(STORE_INGREDIENTS).indexNames.contains(INDEX_INGREDIENTS_BY_NAME))
    assert.ok(tx.objectStore(STORE_USAGES).indexNames.contains(INDEX_USAGES_BY_RECIPE))
    assert.ok(tx.objectStore(STORE_USAGES).indexNames.contains(INDEX_USAGES_BY_INGREDIENT))
  } finally {
    db.close()
    indexedDB.deleteDatabase(DB_NAME)
  }
})

test('upgrade migration: data inserted at an earlier version survives an upgrade that adds new structure', async () => {
  const name = `migration-check-${crypto.randomUUID()}`

  // A hypothetical "version 1" — exercises the exact same openDatabase()
  // code path production uses, just with a different migrations map.
  const v1 = await openDatabase(name, 1, {
    1: (db) => {
      db.createObjectStore('widgets', { keyPath: 'id' })
    },
  })
  const writeTx = v1.transaction(['widgets'], 'readwrite')
  writeTx.objectStore('widgets').add({ id: 'w1', label: 'pre-upgrade widget' })
  await promisifyTransaction(writeTx)
  v1.close()

  // "Version 2": adds a new store and index via a second migration step.
  const v2 = await openDatabase(name, 2, {
    1: (db) => {
      db.createObjectStore('widgets', { keyPath: 'id' })
    },
    2: (db) => {
      const gadgets = db.createObjectStore('gadgets', { keyPath: 'id' })
      gadgets.createIndex('byLabel', 'label')
    },
  })
  try {
    assert.equal(v2.version, 2)
    assert.ok(v2.objectStoreNames.contains('widgets'), 'pre-existing store must survive the upgrade')
    assert.ok(v2.objectStoreNames.contains('gadgets'), 'new store must be added by the upgrade')

    const readTx = v2.transaction(['widgets'], 'readonly')
    const widget = await promisifyRequest(readTx.objectStore('widgets').get('w1'))
    assert.deepEqual(widget, { id: 'w1', label: 'pre-upgrade widget' }, 'pre-upgrade data must survive intact')
  } finally {
    v2.close()
    indexedDB.deleteDatabase(name)
  }
})

test('opening an already-current-version database a second time does not re-run migrations', async () => {
  const first = await openAppDatabase()
  first.close()
  const second = await openAppDatabase()
  try {
    assert.equal(second.version, DB_VERSION)
    assert.ok(second.objectStoreNames.contains(STORE_INGREDIENTS))
  } finally {
    second.close()
    indexedDB.deleteDatabase(DB_NAME)
  }
})
