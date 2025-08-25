const selva = @import("../../selva.zig");
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const std = @import("std");

pub fn Refs(comptime isEdge: bool) type {
    if (isEdge) {
        return struct { weakRefs: selva.SelvaNodeWeakReferences, fs: db.FieldSchema };
    }
    return *selva.SelvaNodeReferences;
}

pub inline fn getRefsCnt(comptime isEdge: bool, refs: Refs(isEdge)) u32 {
    if (isEdge) {
        return refs.weakRefs.nr_refs;
    }
    return refs.nr_refs;
}

pub const RefStruct = struct {
    smallReference: ?*selva.SelvaNodeSmallReference,
    largeReference: ?*selva.SelvaNodeLargeReference,
    edgeReference: ?selva.SelvaNodeWeakReference,
    edgeConstaint: ?db.EdgeFieldConstraint,
};

pub inline fn resolveRefsNode(
    ctx: *QueryCtx,
    comptime isEdge: bool,
    refs: Refs(isEdge),
    i: usize,
) ?db.Node {
    if (isEdge) {
        var ref = refs.weakRefs.refs[i];
        return db.resolveEdgeReference(ctx.db, refs.fs, &ref);
    } else {
        if (refs.*.size == selva.SELVA_NODE_REFERENCE_SMALL) {
            return refs.unnamed_0.small[i].dst;
        } else if (refs.size == selva.SELVA_NODE_REFERENCE_LARGE) {
            return refs.unnamed_0.large[i].dst;
        }
        return null;
    }
}

pub const RefsResult = struct {
    size: usize,
    cnt: u32,
};

pub inline fn RefResult(
    comptime isEdge: bool,
    refs: ?Refs(isEdge),
    edgeConstrain: ?db.EdgeFieldConstraint,
    i: usize,
) ?RefStruct {
    if (!isEdge) {
        if (refs.?.size == selva.SELVA_NODE_REFERENCE_SMALL) {
            return .{
                .smallReference = @ptrCast(&refs.?.unnamed_0.small[i]),
                .largeReference = null,
                .edgeReference = null,
                .edgeConstaint = edgeConstrain.?,
            };
        } else if (refs.?.size == selva.SELVA_NODE_REFERENCE_LARGE) {
            return .{
                .smallReference = null,
                .largeReference = @ptrCast(&refs.?.unnamed_0.large[i]),
                .edgeReference = null,
                .edgeConstaint = edgeConstrain.?,
            };
        } else {
            return std.mem.zeroInit(RefStruct, .{});
        }
    }
    return .{
        .smallReference = null,
        .largeReference = null,
        .edgeReference = refs.?.weakRefs.refs[i],
        .edgeConstaint = null,
    };
}

pub const IncludeOpts = struct {
    meta: u8,
    start: u8,
    end: u8,
};
