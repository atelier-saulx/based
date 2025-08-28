const db = @import("../../db/db.zig");
const t = @import("./types.zig");
const Mode = t.Mode;
const Op = t.Operator;
const Type = t.Type;
const ConditionsResult = t.ConditionsResult;
const c = @import("./condition.zig");
const std = @import("std");
const selva = @import("../../selva.zig");
const LibdeflateDecompressor = @import("../../db/decompress.zig").LibdeflateDecompressor;
const LibdeflateBlockState = @import("../../db/decompress.zig").LibdeflateBlockState;

inline fn condition(
    decompressor: *LibdeflateDecompressor,
    blockState: *LibdeflateBlockState,
    mode: Mode,
    q: []u8,
    v: []u8,
    i: usize,
) ConditionsResult {
    return switch (mode) {
        Mode.default => c.default(q, v, i),
        Mode.defaultVar => c.defaultVar(decompressor, blockState, q, v, i),
        Mode.orVar => c.orVar(decompressor, blockState, q, v, i),
        Mode.andFixed => c.andFixed(q, v, i),
        Mode.orFixed => c.orFixed(q, v, i),
        Mode.reference => c.reference(q, v, i),
    };
}

pub inline fn runConditions(
    decompressor: *LibdeflateDecompressor,
    blockState: *LibdeflateBlockState,
    q: []u8,
    v: []u8,
) bool {
    var i: usize = 0;
    while (i < q.len) {
        const match = @as(Type, @enumFromInt(q[i])) == Type.default;
        i += 1;
        const mode: Mode = @enumFromInt(q[i]);
        const result = condition(decompressor, blockState, mode, q, v, i);
        if (result[1] != match) {
            return false;
        }
        i += result[0];
    }
    return true;
}
