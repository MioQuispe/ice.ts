import type { Principal } from '@dfinity/principal';
export interface AssetDetails {
  'key' : string,
  'encodings' : Array<AssetEncodingDetails>,
  'content_type' : string,
}
export interface AssetEncodingDetails {
  'modified' : bigint,
  'sha256' : [] | [Array<number>],
  'length' : bigint,
  'content_encoding' : string,
}
export type BatchOperation = { 'CreateAsset' : CreateAssetArguments } |
  { 'UnsetAssetContent' : UnsetAssetContentArguments } |
  { 'DeleteAsset' : DeleteAssetArguments } |
  { 'SetAssetContent' : SetAssetContentArguments } |
  { 'Clear' : {} };
export interface CommitBatchArguments {
  'batch_id' : bigint,
  'operations' : Array<BatchOperation>,
}
export interface CreateAssetArguments {
  'key' : string,
  'content_type' : string,
  'headers' : [] | [Array<[string, string]>],
  'max_age' : [] | [bigint],
}
export interface CreateBatchResponse { 'batch_id' : bigint }
export interface CreateChunkArg {
  'content' : Array<number>,
  'batch_id' : bigint,
}
export interface CreateChunkResponse { 'chunk_id' : bigint }
export interface DeleteAssetArguments { 'key' : string }
export interface EncodedAsset {
  'content' : Array<number>,
  'sha256' : [] | [Array<number>],
  'content_type' : string,
  'content_encoding' : string,
  'total_length' : bigint,
}
export interface GetArg { 'key' : string, 'accept_encodings' : Array<string> }
export interface GetChunkArg {
  'key' : string,
  'sha256' : [] | [Array<number>],
  'index' : bigint,
  'content_encoding' : string,
}
export interface GetChunkResponse { 'content' : Array<number> }
export interface HttpRequest {
  'url' : string,
  'method' : string,
  'body' : Array<number>,
  'headers' : Array<[string, string]>,
}
export interface HttpResponse {
  'body' : Array<number>,
  'headers' : Array<[string, string]>,
  'streaming_strategy' : [] | [StreamingStrategy],
  'status_code' : number,
}
export interface InitArg { 'init_caller' : [] | [Principal] }
export type Result = { 'Ok' : Array<Principal> } |
  { 'Err' : string };
export interface SetAssetContentArguments {
  'key' : string,
  'sha256' : [] | [Array<number>],
  'chunk_ids' : Array<bigint>,
  'content_encoding' : string,
}
export interface StoreArg {
  'key' : string,
  'content' : Array<number>,
  'sha256' : [] | [Array<number>],
  'content_type' : string,
  'content_encoding' : string,
}
export interface StreamingCallbackHttpResponse {
  'token' : [] | [GetChunkArg],
  'body' : Array<number>,
}
export type StreamingStrategy = {
    'Callback' : { 'token' : GetChunkArg, 'callback' : [Principal, string] }
  };
export interface UnsetAssetContentArguments {
  'key' : string,
  'content_encoding' : string,
}
export interface _SERVICE {
  'authorize' : (arg_0: Principal) => Promise<undefined>,
  'clear' : () => Promise<undefined>,
  'commit_batch' : (arg_0: CommitBatchArguments) => Promise<undefined>,
  'create_asset' : (arg_0: CreateAssetArguments) => Promise<undefined>,
  'create_batch' : () => Promise<CreateBatchResponse>,
  'create_chunk' : (arg_0: CreateChunkArg) => Promise<CreateChunkResponse>,
  'delete_asset' : (arg_0: DeleteAssetArguments) => Promise<undefined>,
  'drain_authorize' : () => Promise<undefined>,
  'get' : (arg_0: GetArg) => Promise<EncodedAsset>,
  'get_chunk' : (arg_0: GetChunkArg) => Promise<GetChunkResponse>,
  'http_request' : (arg_0: HttpRequest) => Promise<HttpResponse>,
  'http_request_streaming_callback' : (arg_0: GetChunkArg) => Promise<
      StreamingCallbackHttpResponse
    >,
  'list' : () => Promise<Array<AssetDetails>>,
  'list_authorize' : () => Promise<Result>,
  'retrieve' : (arg_0: string) => Promise<Array<number>>,
  'set_asset_content' : (arg_0: SetAssetContentArguments) => Promise<undefined>,
  'store' : (arg_0: StoreArg) => Promise<undefined>,
  'unset_asset_content' : (arg_0: UnsetAssetContentArguments) => Promise<
      undefined
    >,
}
