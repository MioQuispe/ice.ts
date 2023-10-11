import { Principal } from "@dfinity/principal"

export const NFT = {
  ext: "EXT",
  // TODO: camelCase
  icpunks: "ICPunks",
  icNaming: "ICNaming",
  departuresLabs: "DepartureLabs",
  erc721: "ERC721",
  dip721: "DIP721",
  dip721v2: "DIP721v2",
  dip721v2Final: "DIP721v2Final",
  c3: "C3",
  origyn: "Origyn",
}

export interface DABCollection {
  icon: string;
  name: string;
  description: string;
  principal_id: Principal;
  standard: string;
}

export interface NFTCollection {
  name: string;
  canisterId: string;
  standard: string;
  tokens: NFTDetails[];
  icon?: string;
  description?: string;
}

export interface NFTDetails {
  index: bigint;
  canister: string;
  id?: string;
  name?: string;
  url: string;
  metadata: any;
  standard: string;
  collection?: string;
  owner?: string;
  operator?: string;
}
