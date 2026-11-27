export function createSearchRequestTracker() {
  let latestId = 0

  return {
    start() {
      latestId += 1
      return latestId
    },
    isCurrent(requestId) {
      return requestId === latestId
    },
  }
}
