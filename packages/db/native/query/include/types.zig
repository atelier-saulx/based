const selva = @import("../../selva.zig").c;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const std = @import("std");

pub const Refs = struct { refs: db.References, fs: db.FieldSchema };

pub const RefStruct = struct {
    smallReference: ?db.ReferenceSmall,
    largeReference: ?db.ReferenceLarge,
    edgeConstraint: db.EdgeFieldConstraint,
};

pub inline fn resolveRefsNode(
    ctx: *db.DbCtx,
    refs: Refs,
    i: usize,
) ?db.Node {
    const dstType = db.getRefDstType(ctx, refs.fs) catch {
        return null;
    };

    if (refs.refs.*.size == selva.SELVA_NODE_REFERENCE_SMALL) {
        return db.getNodeFromReference(dstType, &refs.refs.unnamed_0.small[i]);
    } else if (refs.refs.size == selva.SELVA_NODE_REFERENCE_LARGE) {
        return db.getNodeFromReference(dstType, &refs.refs.unnamed_0.large[i]);
    }

    return null;
}

pub const RefsResult = struct {
    size: usize,
    cnt: u32,
};

pub inline fn RefResult(
    refs: ?Refs,
    edgeConstraint: ?db.EdgeFieldConstraint,
    i: usize,
) ?RefStruct {
    if (refs.?.refs.size == selva.SELVA_NODE_REFERENCE_SMALL) {
        return .{
            .smallReference = @ptrCast(&refs.?.refs.unnamed_0.small[i]),
            .largeReference = null,
            .edgeConstraint = edgeConstraint.?,
        };
    } else if (refs.?.refs.size == selva.SELVA_NODE_REFERENCE_LARGE) {
        return .{
            .smallReference = null,
            .largeReference = @ptrCast(&refs.?.refs.unnamed_0.large[i]),
            .edgeConstraint = edgeConstraint.?,
        };
    } else {
        return std.mem.zeroInit(RefStruct, .{
            .edgeConstraint = edgeConstraint.?,
        });
    }
}
