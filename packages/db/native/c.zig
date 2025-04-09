// Only add node_api in NAPI

pub usingnamespace @cImport({
    @cInclude("node_api.h");
    @cInclude("string.h");
});
