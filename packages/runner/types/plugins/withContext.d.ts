import type { PreTaskTree, CrystalContext } from "../types";
export declare const withContext: (root: PreTaskTree | ((ctx: CrystalContext) => PreTaskTree)) => {
    transform: (ctx: CrystalContext) => any;
    children: any;
};
