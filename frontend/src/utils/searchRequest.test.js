import assert from 'node:assert/strict'
import test from 'node:test'
import { createSearchRequestTracker } from './searchRequest.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function syntheticSearch(tracker, response, state) {
  const requestId = tracker.start()
  state.loading = true
  try {
    const result = await response
    if (tracker.isCurrent(requestId)) {
      state.result = result
      state.error = ''
    }
  } catch (error) {
    if (tracker.isCurrent(requestId)) {
      state.result = null
      state.error = error.message
    }
  } finally {
    if (tracker.isCurrent(requestId)) {
      state.loading = false
    }
  }
}

test('two identical searches get distinct request IDs', () => {
  const tracker = createSearchRequestTracker()
  const first = tracker.start()
  const second = tracker.start()
  assert.notEqual(first, second)
  assert.equal(tracker.isCurrent(first), false)
  assert.equal(tracker.isCurrent(second), true)
})

test('late older success does not replace the newest result or loading state', async () => {
  const tracker = createSearchRequestTracker()
  const oldResponse = deferred()
  const newResponse = deferred()
  const state = { result: null, error: '', loading: false }

  const oldSearch = syntheticSearch(tracker, oldResponse.promise, state)
  const newSearch = syntheticSearch(tracker, newResponse.promise, state)
  oldResponse.resolve('old result')
  await oldSearch
  assert.deepEqual(state, { result: null, error: '', loading: true })

  newResponse.resolve('new result')
  await newSearch
  assert.deepEqual(state, { result: 'new result', error: '', loading: false })
})

test('late older failure cannot clear the newest successful result', async () => {
  const tracker = createSearchRequestTracker()
  const oldResponse = deferred()
  const newResponse = deferred()
  const state = { result: null, error: '', loading: false }

  const oldSearch = syntheticSearch(tracker, oldResponse.promise, state)
  const newSearch = syntheticSearch(tracker, newResponse.promise, state)
  newResponse.resolve('new result')
  await newSearch
  oldResponse.reject(new Error('old failure'))
  await oldSearch
  assert.deepEqual(state, { result: 'new result', error: '', loading: false })
})

test('latest failure owns the error even if an older retry succeeds later', async () => {
  const tracker = createSearchRequestTracker()
  const oldRetry = deferred()
  const latestResponse = deferred()
  const state = { result: null, error: '', loading: false }

  const retryingSearch = syntheticSearch(tracker, oldRetry.promise, state)
  const latestSearch = syntheticSearch(tracker, latestResponse.promise, state)
  latestResponse.reject(new Error('latest failure'))
  await latestSearch
  oldRetry.resolve('stale retry')
  await retryingSearch
  assert.deepEqual(state, { result: null, error: 'latest failure', loading: false })
})
