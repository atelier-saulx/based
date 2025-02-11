// advanced zig ⚡️
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

    @cInclude("selva/worker_ctx.h");
    @cInclude("selva/db.h");
    @cInclude("selva/fields.h");
    @cInclude("selva/node_id_set.h");
    @cInclude("selva/sort.h");
    @cInclude("selva/types.h");
    @cInclude("selva_error.h");
    @cInclude("selva/crc32c.h");
    @cInclude("selva/selva_hash128.h");
    @cInclude("selva/selva_string.h");

    @cInclude("libdeflate.h");

    @cInclude("selva_lang_code.h");
    @cInclude("selva/selva_lang.h");

    @cInclude("selva/strsearch.h");
    @cInclude("selva/vector.h");
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
