export const idlFactory = ({ IDL }) => {
  const InitArgs = IDL.Record({ 'im_canister' : IDL.Principal });
  const PassKeyData = IDL.Record({ 'key' : IDL.Text, 'data' : IDL.Text });
  return IDL.Service({
    'get_passkey' : IDL.Func(
        [IDL.Vec(IDL.Text)],
        [IDL.Vec(PassKeyData)],
        ['query'],
      ),
    'get_passkey_by_anchor' : IDL.Func(
        [IDL.Nat64],
        [IDL.Vec(PassKeyData)],
        ['query'],
      ),
    'remove_passkey' : IDL.Func([IDL.Text, IDL.Nat64], [IDL.Nat64], []),
    'store_passkey' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Nat64],
        [IDL.Nat64],
        [],
      ),
  });
};
export const init = ({ IDL }) => {
  const InitArgs = IDL.Record({ 'im_canister' : IDL.Principal });
  return [IDL.Opt(InitArgs)];
};
