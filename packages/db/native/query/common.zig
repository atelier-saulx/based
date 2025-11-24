const std = @import("std");
const results = @import("./results.zig");
const db = @import("../db/db.zig");
const selva = @import("../selva.zig").c;
const Node = @import("../db/node.zig");

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
) ?Node.Node {
    const dstType = db.getRefDstType(ctx, refs.fs) catch {
        return null;
    };

    if (refs.refs.*.size == selva.SELVA_NODE_REFERENCE_SMALL) {
        return Node.getNodeFromReference(dstType, &refs.refs.unnamed_0.small[i]);
    } else if (refs.refs.size == selva.SELVA_NODE_REFERENCE_LARGE) {
        return Node.getNodeFromReference(dstType, &refs.refs.unnamed_0.large[i]);
    }

    return null;
}

pub const RefsResult = struct {
    size: usize,
    cnt: u32,
};

pub inline fn RefResult(
    refs: ?Refs,
    edgeConstraint: db.EdgeFieldConstraint,
    i: usize,
) ?RefStruct {
    if (refs.?.refs.size == selva.SELVA_NODE_REFERENCE_SMALL) {
        return .{
            .smallReference = @ptrCast(&refs.?.refs.unnamed_0.small[i]),
            .largeReference = null,
            .edgeConstraint = edgeConstraint,
        };
    } else if (refs.?.refs.size == selva.SELVA_NODE_REFERENCE_LARGE) {
        return .{
            .smallReference = null,
            .largeReference = @ptrCast(&refs.?.refs.unnamed_0.large[i]),
            .edgeConstraint = edgeConstraint,
        };
    } else {
        return std.mem.zeroInit(RefStruct, .{
            .edgeConstraint = edgeConstraint,
        });
    }
}

pub const QueryCtx = struct {
    results: std.array_list.Managed(results.Result),
    size: usize,
    totalResults: usize,
    aggResult: ?u32, // adds 8 bytes for no reason
    allocator: std.mem.Allocator,
    db: *db.DbCtx,
    threadCtx: *db.DbThread,
    id: u32,
};

pub const FilterConditionsResult = std.meta.Tuple(&.{ usize, bool });
