const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");

pub fn default(value: []u8, query: []u8) bool {
    const x = selva.strsearch_has_u8(@ptrCast(value.ptr), @ptrCast(query.ptr), query.len, 2);
    // int strsearch_has(locale_t loc, wctrans_t trans, const char *text, const char *needle, size_t needle_len, int good);

    // std.debug.print("SEARCH {any} {any} x: {any} \n", .{ value.len, query, x });

    if (x < 3) {
        return true;
    }

    // ADD SCORE
    return false;
}
