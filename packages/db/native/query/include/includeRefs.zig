const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const incl = @import("./include.zig");
const getFields = incl.getFields;
const RefStruct = incl.RefStruct;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const selva = @import("../../selva.zig");
const std = @import("std");
const results = @import("../results.zig");
const filter = @import("../filter/filter.zig").filter;

const IncludeError = error{
    Recursion,
};

// make the filter as option as well

// pass id
pub fn getRefsFields(
    ctx: *QueryCtx,
    include: []u8,
    node: db.Node,
    originalType: db.Type,
    ref: ?RefStruct,
    comptime isEdge: bool,
) usize {
    const filterSize: db.TypeId = readInt(u16, include, 0);
    const filterArr: ?[]u8 = if (filterSize > 0) include[4 .. 4 + filterSize] else null;

    const sortSize: db.TypeId = readInt(u16, include, 2);
    const sortArr: ?[]u8 = if (sortSize > 0) include[4 + filterSize .. 4 + filterSize + sortSize] else null;

    const typeId: db.TypeId = readInt(u16, include, 4 + filterSize + sortSize);
    const refField = include[6 + filterSize + sortSize];

    // MULTIPLE REFS
    // op u8, field u8, bytes u32, len u32
    // [253, 2, 2124, 10]

    ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = &.{},
        .refType = 253,
        .totalRefs = 0,
        .isEdge = 0,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    const typeEntry = db.getType(typeId) catch null;

    var size: usize = 0;

    const includeNested = include[(7 + filterSize + sortSize)..include.len];

    var i: usize = 0;
    var resultsCnt: u32 = 0;

    var edgeConstrain: ?*selva.EdgeFieldConstraint = null;

    var refs: if (isEdge) ?*selva.SelvaNodeWeakReferences else ?*selva.SelvaNodeReferences = undefined;

    if (isEdge) {
        std.debug.print("refs {any} \n", .{ref});
        return 0;

        // const edgeFieldSchema = selva.get_fs_by_fields_schema_field(
        //     ref.?.edgeConstaint.*.fields_schema,
        //     refField - 1,
        // );

        // refs = db.getEdgeReferences(ref.?.reference, edgeFieldSchema);
        // return 0;
    } else {
        const fieldSchema = db.getFieldSchema(refField, originalType) catch null;
        edgeConstrain = selva.selva_get_edge_field_constraint(fieldSchema);
        refs = db.getReferences(node, refField);
    }

    if (refs == null) {
        return 10;
    }

    if (sortArr != null) {
        const sortBuffer: []u8 = sortArr.?;
        var start: u16 = undefined;
        var len: u16 = undefined;
        const sortField: u8 = sortBuffer[1];
        const sortFieldType: u8 = sortBuffer[2];
        if (sortBuffer.len == 7) {
            start = readInt(u16, sortBuffer, 3);
            len = readInt(u16, sortBuffer, 5);
        } else {
            start = 0;
            len = 0;
        }
        const sortFlag = db.getSortFlag(sortFieldType, sortBuffer[0] == 1) catch {
            return 0;
        };

        const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init(sortFlag, refs.?.nr_refs).?;

        checkItem: while (i < refs.?.nr_refs) : (i += 1) {
            const refNode = refs.?.refs[i].dst.?;
            if (filterArr != null and !filter(refNode, typeEntry.?, filterArr.?)) {
                continue :checkItem;
            }
            const fs = db.getFieldSchema(sortField, typeEntry.?) catch {
                return 0;
            };
            const value = db.getField(refNode, fs);
            db.insertSort(sortCtx, refNode, sortFieldType, value, start, len);
        }
        selva.selva_sort_foreach_begin(sortCtx);
        while (!selva.selva_sort_foreach_done(sortCtx)) {
            // if @limit stop
            const refNode: db.Node = @ptrCast(selva.selva_sort_foreach(sortCtx));
            resultsCnt += 1;

            var refNest: ?RefStruct = null;
            if (!isEdge) {
                refNest = .{
                    .reference = @ptrCast(&refs.?.refs[i]),
                    .edgeConstaint = edgeConstrain.?,
                    .getEdge = false,
                };
            }

            size += getFields(
                refNode,
                ctx,
                db.getNodeId(refNode),
                typeEntry.?,
                includeNested,
                refNest,
            ) catch 0;
        }
        selva.selva_sort_destroy(sortCtx);
    } else {
        checkItem: while (i < refs.?.nr_refs) : (i += 1) {
            const refNode = refs.?.refs[i].dst.?;
            if (filterArr != null and !filter(refNode, typeEntry.?, filterArr.?)) {
                continue :checkItem;
            }
            resultsCnt += 1;

            var refNest: ?RefStruct = null;
            if (!isEdge) {
                refNest = .{
                    .reference = @ptrCast(&refs.?.refs[i]),
                    .edgeConstaint = edgeConstrain.?,
                    .getEdge = false,
                };
            }

            size += getFields(
                refNode,
                ctx,
                db.getNodeId(refNode),
                typeEntry.?,
                includeNested,
                refNest,
            ) catch 0;
        }
    }

    const r: *results.Result = &ctx.results.items[resultIndex];

    r.*.refSize = size;
    r.*.totalRefs = resultsCnt;

    return size + 10;
}
