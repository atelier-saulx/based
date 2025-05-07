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

pub fn aggregateRefsFields(
    ctx: *QueryCtx,
    include: []u8,
    node: db.Node,
    originalType: db.Type,
    comptime isEdge: bool,
) !usize {
    utils.debugPrint("include: {any}\n", .{include});
    const filterSize: u16 = read(u16, include, 0);
    const offset: u32 = read(u32, include, 2);
    const start: comptime_int = 6;
    const filterArr: ?[]u8 = if (filterSize > 0) include[start .. start + filterSize] else null;
    const hasFilter: bool = filterArr != null;
    const typeId: db.TypeId = read(u16, include, start + filterSize);
    const refField = include[start + 2 + filterSize];
    const aggInput = include[(start + 4 + filterSize)..include.len]; // memo: +3 to skip

    var resultsField = ctx.allocator.alloc(u8, ctx.size + 4) catch |err| {
        utils.debugPrint("Allocation failed: {any}\n", .{err});
        return 0;
    };
    @memset(resultsField, 0);

    const typeEntry = try db.getType(ctx.db, typeId);
    var edgeConstrain: ?*const selva.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs(isEdge) = undefined;
    var index: usize = 1;
    const groupCtx = try createGroupCtx(
        aggInput[index .. index + GroupProtocolLen],
        typeEntry,
        ctx,
    );
    index += GroupProtocolLen;
    const agg = aggInput[index..aggInput.len];

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

    var i: usize = offset;
    checkItem: while (i < refsCnt) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |refNode| {
            const groupBy: aggregateTypes.GroupedBy = @enumFromInt(agg[0]);

            const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
            if (hasFilter and !filter(ctx.db, refNode, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                continue :checkItem;
            }

            if (groupBy == aggregateTypes.GroupedBy.hasGroup) {
                const groupValue = db.getField(typeEntry, db.getNodeId(refNode), refNode, groupCtx.fieldSchema, groupCtx.propType);
                const key: [2]u8 = if (groupValue.len > 0) groupValue[groupCtx.start + 1 .. groupCtx.start + 1 + groupCtx.len][0..2].* else groupCtx.empty;
                if (!groupCtx.hashMap.contains(key)) {
                    resultsField = try ctx.allocator.alloc(u8, groupCtx.resultsSize);
                    @memset(resultsField, 0);
                    try groupCtx.hashMap.put(key, resultsField);
                    ctx.size += 2 + groupCtx.resultsSize;
                } else {
                    resultsField = groupCtx.hashMap.get(key).?;
                }
            }
            aggregate(agg, typeEntry, refNode, resultsField);
            utils.debugPrint("resultsField: {d}\n", .{read(u32, resultsField, 0)});
        }
    }

    const r: results.Result = .{
        .id = null,
        .field = refField,
        .val = resultsField[0..4],
        .refSize = 0,
        .includeMain = &.{},
        .refType = null,
        .totalRefs = refsCnt,
        .score = null,
        .isEdge = types.Prop.NULL,
        .isAggregate = true,
    };
    ctx.results.append(r) catch return 0;
    ctx.totalResults += 1;

    return 10;
}
