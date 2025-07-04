// Only add node_api in NAPI

pub usingnamespace @cImport({
    @cDefine("NAPI_VERSION", "10");
    @cInclude("node_api.h");
    @cInclude("string.h");
});
