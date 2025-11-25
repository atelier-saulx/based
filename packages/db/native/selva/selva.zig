pub const c = @cImport({
    @cDefine("__zig", "1");

    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");
    @cInclude("stdbool.h");
    @cUndef("true");
    @cUndef("false");
    @cDefine("true", "(_Bool)1");
    @cDefine("false", "(_Bool)0");

    @cInclude("cdefs.h");
    @cInclude("string.h");
    @cInclude("selva/db.h");
    @cInclude("selva/fields.h");
    @cInclude("selva/node_id_set.h");
    @cInclude("selva/sort.h");
    @cInclude("selva/types.h");
    @cInclude("selva_error.h");
    @cInclude("selva/selva_string.h");
    @cInclude("selva/hll.h");
    @cInclude("selva/colvec.h");
    @cInclude("selva/gmtime.h");
    @cInclude("selva_lang_code.h");
    @cInclude("selva/selva_lang.h");
    @cInclude("selva/strsearch.h");
    @cInclude("selva/vector.h");

    @cInclude("selva/thread.h");
    @cInclude("selva/membar.h");
    @cInclude("selva/mblen.h");
});

const std = @import("std");
const Modify = @import("../modify/common.zig");

pub const Node = *c.SelvaNode;
pub const Aliases = *c.SelvaAliases;
pub const Type = *c.SelvaTypeEntry;
pub const FieldSchema = *const c.SelvaFieldSchema;
pub const EdgeFieldConstraint = *const c.EdgeFieldConstraint;
pub const ReferenceSmall = *c.SelvaNodeSmallReference;
pub const ReferenceLarge = *c.SelvaNodeLargeReference;
pub const ReferenceAny = c.SelvaNodeReferenceAny;
pub const References = *const c.SelvaNodeReferences;

pub fn strerror(err: i32) [:0]const u8 {
    const s = c.selva_strerror(err);
    return s[0..std.mem.len(s) :0];
}

pub fn selvaStringDestroy(str: ?c.selva_string) void {
    try c.selva_string_free(str);
}

pub fn markDirtyCb(ctx: ?*anyopaque, typeId: u16, nodeId: u32) callconv(.c) void {
    const mctx: *Modify.ModifyCtx = @ptrCast(@alignCast(ctx));
    Modify.markDirtyRange(mctx, typeId, nodeId);
}
