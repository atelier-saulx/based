const ReferencesSelect = @import("../../types.zig").ReferencesSelect;
const types = @import("../include/types.zig");
const db = @import("../../db/db.zig");
const filter = @import("./filter.zig").filter;
const std = @import("std");

pub fn filteReferencesMode(
    comptime refsSelectType: ReferencesSelect,
    ctx: *db.DbCtx,
    threadCtx: *db.DbThread,
    conditions: []u8,
    edgeConstraint: db.EdgeFieldConstraint,
    refs: types.Refs,
    refTypeEntry: db.Type,
    index: i32,
) bool {
    var j: usize = 0;
    const refsCnt = refs.refs.nr_refs;

    if (refsSelectType == ReferencesSelect.any) {
        while (j < refsCnt) : (j += 1) {
            if (types.resolveRefsNode(ctx, refs, j)) |refNode| {
                const refStruct = types.RefResult(refs, edgeConstraint, j);
                if (filter(
                    ctx,
                    refNode,
                    threadCtx,
                    refTypeEntry,
                    conditions,
                    refStruct,
                    null,
                    0,
                    false,
                )) {
                    return true;
                }
            }
        }
        return false;
    }

    if (refsSelectType == ReferencesSelect.all) {
        while (j < refsCnt) : (j += 1) {
            if (types.resolveRefsNode(ctx, refs, j)) |refNode| {
                const refStruct = types.RefResult(refs, edgeConstraint, j);
                if (!filter(
                    ctx,
                    refNode,
                    threadCtx,
                    refTypeEntry,
                    conditions,
                    refStruct,
                    null,
                    0,
                    false,
                )) {
                    return false;
                }
            }
        }
        return true;
    }

    if (refsSelectType == ReferencesSelect.index) {
        if (index < 0) {
            if (index < -@as(isize, refsCnt)) {
                return false;
            }
            j = refsCnt - @abs(index);
        } else {
            j = @intCast(index);
        }
        if (types.resolveRefsNode(ctx, refs, j)) |refNode| {
            const refStruct = types.RefResult(refs, edgeConstraint, j);
            if (filter(
                ctx,
                refNode,
                threadCtx,
                refTypeEntry,
                conditions,
                refStruct,
                null,
                0,
                false,
            )) {
                return true;
            }
        }
        return false;
    }

    return false;
}

pub inline fn filterReferences(
    refsSelectType: ReferencesSelect,
    ctx: *db.DbCtx,
    threadCtx: *db.DbThread,
    conditions: []u8,
    edgeConstraint: db.EdgeFieldConstraint,
    refs: types.Refs,
    refTypeEntry: db.Type,
    index: i32,
) bool {
    return switch (refsSelectType) {
        ReferencesSelect.all => filteReferencesMode(
            ReferencesSelect.all,
            ctx,
            threadCtx,
            conditions,
            edgeConstraint,
            refs,
            refTypeEntry,
            index,
        ),
        ReferencesSelect.any => filteReferencesMode(
            ReferencesSelect.any,
            ctx,
            threadCtx,
            conditions,
            edgeConstraint,
            refs,
            refTypeEntry,
            index,
        ),
        ReferencesSelect.index => filteReferencesMode(
            ReferencesSelect.index,
            ctx,
            threadCtx,
            conditions,
            edgeConstraint,
            refs,
            refTypeEntry,
            index,
        ),
    };
}
