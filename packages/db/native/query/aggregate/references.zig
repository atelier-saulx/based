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
const incTypes = @import("../include/types.zig");

const aggregate = @import("../aggregate/aggregate.zig").aggregate;
const filter = @import("../filter/filter.zig").filter;

pub fn aggregateRefsFields(
    ctx: *QueryCtx,
    include: []u8,
    node: db.Node,
    originalType: db.Type,
    comptime isEdge: bool,
) usize {
    const filterSize: u16 = read(u16, include, 0);
    const offset: u32 = read(u32, include, 2);
    const limit: u32 = read(u32, include, 6);
    const start: comptime_int = 10;
    const filterArr: ?[]u8 = if (filterSize > 0) include[start .. start + filterSize] else null;
    const hasFilter: bool = filterArr != null;
    const typeId: db.TypeId = read(u16, include, start + filterSize);
    const refField = include[start + 2 + filterSize];
    const typeEntry = db.getType(ctx.db, typeId) catch null;
    // const aggSize = read(u16, include, (start + 3 + filterSize));
    const agg = include[(start + 3 + 3 + filterSize)..include.len]; // skip 3 bytes: bug
    utils.debugPrint("agg: {any}\n", .{agg});

    var edgeConstrain: ?*const selva.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs(isEdge) = undefined;

    var i: usize = offset;

    var resultsField = ctx.allocator.alloc(u8, ctx.size + 4) catch |err| {
        utils.debugPrint("Allocation failed: {any}\n", .{err});
        return 0;
    };
    @memset(resultsField, 0);

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

    checkItem: while (i < refsCnt and i < limit) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |refNode| {
            const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
            if (hasFilter and !filter(
                ctx.db,
                refNode,
                typeEntry.?,
                filterArr.?,
                refStruct,
                null,
                0,
                false,
            )) {
                continue :checkItem;
            }
            aggregate(agg, typeEntry.?, refNode, resultsField);
            utils.debugPrint("resultsField: {d}\n", .{read(u32, resultsField, 0)});
        }
    }

    // to be reviewed
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
        .aggregateResult = read(u32, resultsField, 0),
    };
    ctx.results.append(r) catch return 0;
    ctx.totalResults += 1;
    ctx.size = 9;

    return 9; // @sizeOf(@TypeOf(r));
}
