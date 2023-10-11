export const idlFactory = ({ IDL }) => {
  const CanisterIdRecord = IDL.Record({ 'canister_id' : IDL.Principal });
  const CanisterStatusType = IDL.Variant({
    'stopped' : IDL.Null,
    'stopping' : IDL.Null,
    'running' : IDL.Null,
  });
  const DefiniteCanisterSettings = IDL.Record({
    'controllers' : IDL.Vec(IDL.Principal),
  });
  const CanisterStatusResult = IDL.Record({
    'status' : CanisterStatusType,
    'memory_size' : IDL.Nat,
    'cycles' : IDL.Nat,
    'settings' : DefiniteCanisterSettings,
    'module_hash' : IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const ChangeCanisterControllersRequest = IDL.Record({
    'target_canister_id' : IDL.Principal,
    'new_controllers' : IDL.Vec(IDL.Principal),
  });
  const ChangeCanisterControllersError = IDL.Record({
    'code' : IDL.Opt(IDL.Int32),
    'description' : IDL.Text,
  });
  const ChangeCanisterControllersResult = IDL.Variant({
    'Ok' : IDL.Null,
    'Err' : ChangeCanisterControllersError,
  });
  const ChangeCanisterControllersResponse = IDL.Record({
    'change_canister_controllers_result' : ChangeCanisterControllersResult,
  });
  return IDL.Service({
    'canister_status' : IDL.Func(
        [CanisterIdRecord],
        [CanisterStatusResult],
        [],
      ),
    'change_canister_controllers' : IDL.Func(
        [ChangeCanisterControllersRequest],
        [ChangeCanisterControllersResponse],
        [],
      ),
    'get_build_metadata' : IDL.Func([], [IDL.Text], ['query']),
  });
};
export const init = ({ IDL }) => { return []; };
