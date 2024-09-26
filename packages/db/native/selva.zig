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

    @cInclude("selva/sort.h");
});
