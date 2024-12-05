const std = @import("std");
const simd = std.simd;
const readInt = @import("../../utils.zig").readInt;
const selva = @import("../../selva.zig");

// extra value
const dist = 1;
pub fn default(value: []u8, query: []u8) bool {
    const x = selva.strsearch_has_u8(
        @ptrCast(value.ptr),
        value.len,
        @ptrCast(query.ptr),
        query.len,
        dist,
    );
    // int strsearch_has(locale_t loc, wctrans_t trans, const char *text, const char *needle, size_t needle_len, int good);

    // std.debug.print("SEARCH {any} {any} x: {any} \n", .{ value.len, query, x });

    if (x <= dist) {
        return true;
    }

    // ADD SCORE
    return false;
}
