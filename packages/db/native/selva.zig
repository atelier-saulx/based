// TODO advanced zig ⚡️
pub usingnamespace @cImport({
    @cDefine("__zig", "1");

    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");
    @cInclude("stdbool.h");
    @cUndef("true");
    @cUndef("false");
    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");

    @cInclude("cdefs.h");

    @cInclude("selva/db.h");
    @cInclude("selva/types.h");
    @cInclude("selva/fields.h");

    @cInclude("selva_error.h");

    @cInclude("util/selva_string.h");
    @cInclude("util/crc32c.h");

    @cInclude("selva/sort.h");

    @cInclude("selva/fast_linear_search.h");
});

const selvaError = @cImport({
    @cDefine("__zig", "1");

    @cInclude("cdefs.h");
    @cInclude("selva_error.h");
});
const std = @import("std");

pub const SelvaHash128 = u128;

pub fn strerror(err: i32) [:0]const u8 {
    const s = selvaError.selva_strerror(err);
    return s[0..std.mem.len(s) :0];
}
