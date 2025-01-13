const selva = @import("../../selva.zig");
const db = @import("../../db/db.zig");

pub const IncludeError = error{
    Recursion,
};

pub fn Refs(comptime isEdge: bool) type {
    if (isEdge) {
        return selva.SelvaNodeWeakReferences;
    }
    return *selva.SelvaNodeReferences;
}

// Tmake this optional isEdge
pub const RefStruct = struct {
    reference: ?*selva.SelvaNodeReference,
    edgeReference: ?selva.SelvaNodeWeakReference,
    edgeConstaint: db.EdgeFieldConstraint,
};

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
        .edgeConstaint = @ptrCast(&refs.?.refs[i]),
        .edgeReference = null,
    };
}

pub const IncludeOp = enum(u8) {
    edge = 252,
    references = 254,
    reference = 255,
    _,
};
