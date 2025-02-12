const std = @import("std");
const simd = std.simd;
const strSearch = @import("../search.zig").strSearch;
const vec = @import("./vector.zig").vec;
const types = @import("../types.zig");
const read = @import("../../../utils.zig").read;

// extra value
const dist = 2;
// dist has to be in query....
pub fn str(value: []const u8, query: []const u8) bool {
    const x = strSearch(@constCast(value), @constCast(query));
    return x <= dist;
}

pub fn vector(value: []const f32, query: []u8) bool {
    const qFloat = read([]f32, query[0 .. query.len - 5], 0);
    const func: types.VectorFn = @enumFromInt(query[query.len - 5]);
    const score = read(f32, query, query.len - 4);
    return @abs(vec(func, qFloat, value)) < score;
}
