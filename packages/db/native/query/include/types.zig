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
    reference: ?*selva.SelvaNodeReference,
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
        return refs.refs[i].dst;
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
        return .{
            .reference = @ptrCast(&refs.?.refs[i]),
            .edgeConstaint = edgeConstrain.?,
            .edgeReference = null,
        };
    }
    return .{
        .reference = null,
        .edgeConstaint = null,
        .edgeReference = refs.?.weakRefs.refs[i],
    };
}
