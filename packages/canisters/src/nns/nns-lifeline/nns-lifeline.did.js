export const idlFactory = ({ IDL }) => {
  return IDL.Service({
    'canister_status' : IDL.Func(
        [IDL.Record({ 'canister_id' : IDL.Principal })],
        [
          IDL.Record({
            'controller' : IDL.Principal,
            'status' : IDL.Variant({
              'stopped' : IDL.Null,
              'stopping' : IDL.Null,
              'running' : IDL.Null,
            }),
            'balance' : IDL.Vec(IDL.Tuple(IDL.Vec(IDL.Nat8), IDL.Nat)),
            'memory_size' : IDL.Nat,
            'cycles' : IDL.Nat,
            'module_hash' : IDL.Opt(IDL.Vec(IDL.Nat8)),
          }),
        ],
        [],
      ),
    'upgrade_root' : IDL.Func(
        [
          IDL.Record({
            'wasm_module' : IDL.Vec(IDL.Nat8),
            'module_arg' : IDL.Vec(IDL.Nat8),
            'stop_upgrade_start' : IDL.Bool,
          }),
        ],
        [],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
