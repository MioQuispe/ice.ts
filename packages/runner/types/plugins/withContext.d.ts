import type { PreTaskTree, ICEContext } from "../types";
export declare const withContext: (root: PreTaskTree | ((ctx: ICEContext) => PreTaskTree)) => {
    transform: (ctx: ICEContext) => any;
    children: any;
};
