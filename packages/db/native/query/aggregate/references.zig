const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");

const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;

const types = @import("../../types.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;
const writeInt = utils.writeIntExact;

const aggregateTypes = @import("../aggregate/types.zig");
const AggDefault = @import("../types//aggregate.zig");
const aggregate = @import("../aggregate/aggregate.zig").aggregate;
const createGroupCtx = @import("../aggregate/group.zig").createGroupCtx;
const GroupProtocolLen = @import("../aggregate/group.zig").ProtocolLen;

const incTypes = @import("../include/types.zig");
const filter = @import("../filter/filter.zig").filter;

pub fn aggregateGroup() !usize {
    //   checkItem: while (i < refsCnt) : (i += 1) {
    //         if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |refNode| {
    //             const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
    //             if (hasFilter and !filter(ctx.db, refNode, typeEntry, filterArr.?, refStruct, null, 0, false)) {
    //                 continue :checkItem;
    //             }
    //             var agg: []u8 = undefined;
    //             if (hasGroupBy) {
    //                 const groupCtx = try createGroupCtx(
    //                     aggRefInput[index .. index + GroupProtocolLen],
    //                     typeEntry,
    //                     ctx,
    //                 );
    //                 index += GroupProtocolLen;
    //                 agg = aggRefInput[index..aggRefInput.len];
    //                 // MV: here to check
    //                 const groupValue = db.getField(typeEntry, db.getNodeId(refNode), refNode, groupCtx.fieldSchema, groupCtx.propType);
    //                 const key: [2]u8 = if (groupValue.len > 0) groupValue[groupCtx.start + 1 .. groupCtx.start + 1 + groupCtx.len][0..2].* else groupCtx.empty;
    //                 if (!groupCtx.hashMap.contains(key)) {
    //                     if (!ctx.allocator.resize(resultsField, groupCtx.resultsSize)) {
    //                         utils.debugPrint("GroupBy memory allocation failed.\n", .{});
    //                         return 10;
    //                     }
    //                     @memset(resultsField, 0);
    //                     try groupCtx.hashMap.put(key, resultsField);
    //                     ctx.size += 2 + groupCtx.resultsSize;
    //                 } else {
    //                     resultsField = groupCtx.hashMap.get(key).?;
    //                 }
    //             } else {
    //                 // skip 3 bytes for groupby.none and totalResultsPos
    //                 agg = aggRefInput[3..aggRefInput.len];
    //             }
    //             aggregate(agg, typeEntry, refNode, resultsField);
    //             std.debug.print("resultsField: {d}\n", .{read(u32, resultsField, 0)});
    //         }
}

pub inline fn aggregateDefault(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    originalType: db.Type,
    node: db.Node,
    refField: u8,
    agg: []u8,
    offset: u32,
    filterArr: ?[]u8,
    resultsSize: u16,
) !usize {
    const resultsField = ctx.allocator.alloc(u8, resultsSize) catch |err| {
        utils.debugPrint("Allocation failed: {any}\n", .{err});
        return 0;
    };
    @memset(resultsField, 0);
    std.debug.print("hello {any} \n", .{resultsSize});

    const typeEntry = try db.getType(ctx.db, typeId);
    var edgeConstrain: ?*const selva.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs(isEdge) = undefined;
    const hasFilter: bool = filterArr != null;

    if (isEdge) {
        //later
    } else {
        const fieldSchema = db.getFieldSchema(refField, originalType) catch {
            // default empty size - means a bug!
            return 10;
        };
        edgeConstrain = selva.selva_get_edge_field_constraint(fieldSchema);
        refs = db.getReferences(ctx.db, node, fieldSchema);
        if (refs == null) { // default empty size - this should never happen
            return 10;
        }
    }

    const refsCnt = incTypes.getRefsCnt(isEdge, refs.?);

    // .totalRefs = refsCnt,
    // if only 1 agg and field 255 and COUNT just return refsCnt
    var i: usize = offset;
    checkItem: while (i < refsCnt) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |refNode| {
            const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
            if (hasFilter and !filter(ctx.db, refNode, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                continue :checkItem;
            }
            aggregate(agg, typeEntry, refNode, resultsField);
            // std.debug.print("resultsField: {d}\n", .{read(u32, resultsField, 0)});
        }
    }
    ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = resultsField,
        .score = null,
        .type = types.ResultType.aggregate,
    }) catch return 0;

    return resultsSize + 2 + 4;
}

// this will be the prepper
pub fn aggregateRefsFields(
    ctx: *QueryCtx,
    include: []u8,
    node: db.Node,
    originalType: db.Type,
    comptime isEdge: bool,
) !usize {
    var index: usize = 0;
    const filterSize: u16 = read(u16, include, index);
    index += 2;
    const offset: u32 = read(u32, include, index);
    index += 4;
    const filterArr: ?[]u8 = if (filterSize > 0) include[index .. index + filterSize] else null;
    index += filterSize;
    const typeId: db.TypeId = read(u16, include, index);
    index += 2;
    const refField = include[index];
    index += 1;
    const groupBy: aggregateTypes.GroupedBy = @enumFromInt(include[index]);
    index += 1;
    // other group stuff
    // here we call our group stuff
    // countOnly
    if (groupBy == aggregateTypes.GroupedBy.hasGroup) {
        // in a bit
    } else {
        // non group
        const resultsSize = read(u16, include, index);
        index += 2;
        const agg = include[index..include.len];
        return try aggregateDefault(isEdge, ctx, typeId, originalType, node, refField, agg, offset, filterArr, resultsSize);
    }

    return 0;
}
