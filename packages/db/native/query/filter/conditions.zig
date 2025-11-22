const std = @import("std");
const db = @import("../../db/db.zig");
const FilterConditionsResult = @import("../common.zig").FilterConditionsResult;
const c = @import("./condition.zig");
const deflate = @import("../../deflate.zig");
const t = @import("../../types.zig");

inline fn condition(
    decompressor: *deflate.Decompressor,
    blockState: *deflate.BlockState,
    mode: t.FilterMode,
    q: []u8,
    v: []u8,
    i: usize,
) FilterConditionsResult {
    return switch (mode) {
        t.FilterMode.default => c.default(q, v, i),
        t.FilterMode.defaultVar => c.defaultVar(decompressor, blockState, q, v, i),
        t.FilterMode.orVar => c.orVar(decompressor, blockState, q, v, i),
        t.FilterMode.andFixed => c.andFixed(q, v, i),
        t.FilterMode.orFixed => c.orFixed(q, v, i),
        t.FilterMode.reference => c.reference(q, v, i),
    };
}

pub inline fn runConditions(
    decompressor: *deflate.Decompressor,
    blockState: *deflate.BlockState,
    q: []u8,
    v: []u8,
) bool {
    var i: usize = 0;
    while (i < q.len) {
        const match = @as(t.FilterType, @enumFromInt(q[i])) == t.FilterType.default;
        i += 1;
        const mode: t.FilterMode = @enumFromInt(q[i]);
        const result = condition(decompressor, blockState, mode, q, v, i);
        if (result[1] != match) {
            return false;
        }
        i += result[0];
    }
    return true;
}
