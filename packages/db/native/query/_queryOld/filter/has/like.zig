const std = @import("std");
const simd = std.simd;
const strSearch = @import("../search.zig").strSearch;
const vec = @import("./vector.zig").vec;
const read = @import("../../../utils.zig").read;
const t = @import("../../../types.zig");

pub fn str(value: []const u8, query: []const u8) bool {
    const x = strSearch(@constCast(value), @constCast(query[0 .. query.len - 1]));
    return x <= query[query.len - 1];
}

pub fn vector(value: []const f32, query: []u8) bool {
    const qFloat = read([]f32, query[0 .. query.len - 5], 0);
    const func: t.FilterVectorFn = @enumFromInt(query[query.len - 5]);
    const score = read(f32, query, query.len - 4);
    return vec(func, value, qFloat) < score;
}
