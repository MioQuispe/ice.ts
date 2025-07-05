# Replica Cache Invalidation Bug

## Summary

This document describes a caching bug in the ICE CLI where cached canister deployment tasks are not invalidated when the replica is restarted, causing the CLI to use stale cache instead of actually deploying canisters.

## Bug Description

When running `npx ice --logLevel=debug`, the log output shows many cache hits like:

```
[14:30:33.968] DEBUG (#85): Cache hit for cacheKey: {
  "_id": "Option",
  "_tag": "Some",
  "value": "1e5bd43cc0ab8edac6d18c74072171503bf3ebe5e575cea5bd3cc45b7b1c78b7"
}
```

Even after restarting the pocket-ic server (which should wipe all canisters from the replica), the ICE CLI continues to use cached values instead of detecting that the replica state has changed and re-deploying the canisters.

## Expected Behavior

1. When replica is restarted, canister-related cache entries should be invalidated
2. Tasks that depend on replica state (like canister deployment) should be re-executed
3. Tasks that don't depend on replica state can remain cached

## Current Behavior

1. All cached tasks remain cached regardless of replica state changes
2. Canister deployment tasks use stale cache even when canisters no longer exist
3. No mechanism exists to detect replica state changes and invalidate relevant cache

## Root Cause

The current caching system doesn't distinguish between:
- **Replica-dependent tasks**: canister creation, deployment, installation
- **Replica-independent tasks**: code compilation, binding generation, static computations

All tasks are cached based solely on their input parameters, without considering the state of the replica.

## Test Cases

The `replica-cache-invalidation.test.ts` file contains three test cases that demonstrate this bug:

### Test 1: Basic Cache Invalidation
```typescript
// First deployment - cache miss (deployCount: 1)
// Second deployment - cache hit (deployCount: still 1) ✓
// Replica restart simulation
// Third deployment - should be cache miss (deployCount: 2) ❌ FAILS
```

### Test 2: Replica State Detection
```typescript
// Task that checks replica restart count
// First run - replicaRestartCount: 0 ✓
// Restart replica
// Second run - should detect change (replicaRestartCount: 1) ❌ FAILS
```

### Test 3: Selective Cache Invalidation
```typescript
// Static task should remain cached after replica restart ✓
// Deploy task should be re-executed after replica restart ❌ FAILS
```

## Impact

- Users experience confusing behavior when replica is restarted
- Canisters may not be properly deployed after replica restart
- Debug sessions become difficult as cached results don't reflect actual state
- CI/CD pipelines may fail silently when using fresh replicas

## Proposed Solution

1. **Add replica state tracking**: Track replica restart count or state hash
2. **Tag cache-dependent tasks**: Mark tasks that depend on replica state
3. **Implement selective cache invalidation**: Only invalidate replica-dependent tasks when replica state changes
4. **Add cache invalidation API**: Allow manual cache invalidation for specific task types

## Implementation Ideas

### Option 1: Replica State Hash
```typescript
interface CachedTask {
  computeCacheKey: (input: Input, replicaStateHash: string) => string
  dependsOnReplica: boolean
}
```

### Option 2: Cache Invalidation Events
```typescript
// When replica restarts, emit invalidation event
replicaService.onRestart(() => {
  taskRegistry.invalidateWhere(task => task.dependsOnReplica)
})
```

### Option 3: Cache Key Composition
```typescript
// Include replica state in cache key for relevant tasks
const cacheKey = task.dependsOnReplica 
  ? `${baseKey}-replica-${replicaStateHash}` 
  : baseKey
```

## Files

- `replica-cache-invalidation.test.ts` - Test cases demonstrating the bug
- Original log output showing cache hits after replica restart

## Related Issues

This bug affects any workflow that involves:
- Local development with replica restarts
- CI/CD with ephemeral replicas  
- Testing with fresh replica state
- Debugging canister deployment issues