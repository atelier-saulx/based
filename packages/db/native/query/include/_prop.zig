const Query = @import("../common.zig");
const std = @import("std");
const db = @import("../../db/db.zig");
const Node = @import("../../db/node.zig");
const results = @import("../results.zig");
const errors = @import("../../errors.zig");
const utils = @import("../../utils.zig");
const o = @import("./opts.zig");
const t = @import("../../types.zig");

// pub inline fn partial(
//     comptime isEdge: bool,
//     ctx: *Query.QueryCtx,
//     result: *results.Result,
//     includeMain: []u8,
// ) !usize {
//     const original = result.*.value;
//     const size = utils.read(u16, includeMain, 0);
//     const value = try ctx.allocator.alloc(u8, size);
//     var mainPos: usize = 2;
//     var j: usize = 0;
//     while (mainPos < includeMain.len) {
//         const mainOp = includeMain[mainPos..];
//         const start = utils.read(u16, mainOp, 0);
//         const len = utils.read(u16, mainOp, 2);
//         utils.copy(u8, value, original[start .. start + len], j);
//         j += len;
//         mainPos += 4;
//     }
//     result.*.value = value;
//     if (isEdge) {
//         return size + 2;
//     } else {
//         return size + 1;
//     }
// }
