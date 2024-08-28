// TODO advanced zig ⚡️
pub usingnamespace @cImport({
    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");
    @cInclude("stdbool.h");
    @cUndef("true");
    @cUndef("false");
    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");

    @cInclude("selva/db.h");
    @cInclude("selva/types.h");
    @cInclude("selva/fields.h");
});
