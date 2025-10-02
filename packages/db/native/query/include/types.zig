const selva = @import("../../selva.zig");
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const std = @import("std");

pub fn Refs(comptime isEdge: bool) type {
    if (isEdge) {
        return struct { refs: selva.SelvaNodeWeakReferences, fs: db.FieldSchema };
    }
    return struct { refs: *selva.SelvaNodeReferences, fs: db.FieldSchema };
}

pub inline fn getRefsCnt(comptime isEdge: bool, refs: Refs(isEdge)) u32 {
    return refs.refs.nr_refs;
}

pub const RefStruct = struct {
    smallReference: ?*selva.SelvaNodeSmallReference,
    largeReference: ?*selva.SelvaNodeLargeReference,
    edgeReference: ?selva.SelvaNodeWeakReference,
    edgeConstraint: ?db.EdgeFieldConstraint, // TODO This should be mandatory
};

pub inline fn resolveRefsNode(
    ctx: *QueryCtx,
    comptime isEdge: bool,
    refs: Refs(isEdge),
    i: usize,
) ?db.Node {
    if (isEdge) {
        var ref = refs.refs.refs[i];
        return db.resolveEdgeReference(ctx.db, refs.fs, &ref);
    } else {
        const dstType = db.getRefDstType(ctx.db, refs.fs) catch {
            return null;
        };
        if (refs.refs.*.size == selva.SELVA_NODE_REFERENCE_SMALL) {
            return db.getNodeFromReference(dstType, &refs.refs.unnamed_0.small[i]);
        } else if (refs.refs.size == selva.SELVA_NODE_REFERENCE_LARGE) {
            return db.getNodeFromReference(dstType, &refs.refs.unnamed_0.large[i]);
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
    edgeConstraint: ?db.EdgeFieldConstraint,
    i: usize,
) ?RefStruct {
    if (!isEdge) {
        if (refs.?.refs.size == selva.SELVA_NODE_REFERENCE_SMALL) {
            return .{
                .smallReference = @ptrCast(&refs.?.refs.unnamed_0.small[i]),
                .largeReference = null,
                .edgeReference = null,
                .edgeConstraint = edgeConstraint.?,
            };
        } else if (refs.?.refs.size == selva.SELVA_NODE_REFERENCE_LARGE) {
            return .{
                .smallReference = null,
                .largeReference = @ptrCast(&refs.?.refs.unnamed_0.large[i]),
                .edgeReference = null,
                .edgeConstraint = edgeConstraint.?,
            };
        } else {
            return std.mem.zeroInit(RefStruct, .{});
        }
    }
    return .{
        .smallReference = null,
        .largeReference = null,
        .edgeReference = refs.?.refs.refs[i],
        .edgeConstraint = null,
    };
}
