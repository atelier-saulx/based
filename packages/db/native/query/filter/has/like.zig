const std = @import("std");
const simd = std.simd;
const readInt = @import("../../../utils.zig").readInt;
const strSearch = @import("../search.zig").strSearch;

// extra value
const dist = 2;
// dist has to be in query....
pub fn like(value: []const u8, query: []const u8) bool {
    const x = strSearch(@constCast(value), @constCast(query));
    return x <= dist;
}
