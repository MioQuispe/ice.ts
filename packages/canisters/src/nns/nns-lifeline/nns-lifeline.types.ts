import type { Principal } from '@dfinity/principal';
export interface _SERVICE {
  'canister_status' : (arg_0: { 'canister_id' : Principal }) => Promise<
      {
        'controller' : Principal,
        'status' : { 'stopped' : null } |
          { 'stopping' : null } |
          { 'running' : null },
        'balance' : Array<[Array<number>, bigint]>,
        'memory_size' : bigint,
        'cycles' : bigint,
        'module_hash' : [] | [Array<number>],
      }
    >,
  'upgrade_root' : (
      arg_0: {
        'wasm_module' : Array<number>,
        'module_arg' : Array<number>,
        'stop_upgrade_start' : boolean,
      },
    ) => Promise<undefined>,
}
