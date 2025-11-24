const std = @import("std");
const read = @import("../../../utils.zig").read;
const db = @import("../../../db/db.zig");
const Node = @import("../../../db/node.zig");
const selva = @import("../../../selva.zig").c;
const results = @import("../../results.zig");
const Query = @import("../../common.zig");
const getFields = @import("../include.zig");
const addIdOnly = @import("../addIdOnly.zig").addIdOnly;
const sortedReferences = @import("./sort.zig").sortedReferences;
const defaultReferences = @import("./default.zig").defaultReferences;
const utils = @import("../../../utils.zig");
const t = @import("../../../types.zig");

//  Multiple References Protocol Schema:

// | Offset  | Field     | Size (bytes)| Description                          |
// |---------|-----------|-------------|--------------------------------------|
// | 0       | op        | 1           | Operation identifier (253)           |
// | 1       | prop      | 1           | PropType identifier                      |
// | 2       | refSize   | 4           | Reference size (u32)                 |
// | 6       | totalRefs | 4           | Total number of references (u32)     |

pub fn getRefsFields(
    ctx: *Query.QueryCtx,
    include: []u8,
    node: Node.Node,
    originalType: Node.Type,
    ref: ?Query.RefStruct,
    comptime isEdge: bool,
) usize {
    const filterSize: u16 = read(u16, include, 0);
    const sortSize: u16 = read(u16, include, 2);
    const offset: u32 = read(u32, include, 4);
    const limit: u32 = read(u32, include, 8);
    const start: comptime_int = 12;
    const filterArr: ?[]u8 = if (filterSize > 0) include[start .. start + filterSize] else null;
    const hasFilter: bool = filterArr != null;
    const sortArr: ?[]u8 = if (sortSize > 0) include[start + filterSize .. start + filterSize + sortSize] else null;
    const typeId: t.TypeId = read(u16, include, start + filterSize + sortSize);
    const refField = include[start + 2 + filterSize + sortSize];
    const typeEntry = db.getType(ctx.db, typeId) catch null;
    const includeNested = include[(start + 3 + filterSize + sortSize)..include.len];

    ctx.results.append(.{
        .id = 0,
        .prop = refField,
        .value = &.{},
        .score = null,
        .type = if (isEdge) t.ResultType.referencesEdge else t.ResultType.references,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;
    var refs: ?Query.Refs = undefined;
    if (isEdge) {
        if (db.getEdgeReferences(ctx.db, ref.?.edgeConstraint, ref.?.largeReference.?, refField)) |r| {
            const edgeFs = db.getEdgeFieldSchema(ctx.db, ref.?.edgeConstraint, refField) catch {
                // 10 + 1 for edge marker
                return 11;
            };
            refs = .{ .refs = r, .fs = edgeFs };
        } else {
            // 10 + 1 for edge marker
            return 11;
        }
    } else {
        const fieldSchema = db.getFieldSchema(originalType, refField) catch {
            // default empty size - means a bug!
            return 10;
        };
        const references = db.getReferences(node, fieldSchema);
        if (references == null) {
            // default empty size - this should never happen
            return 10;
        }

        refs = .{ .refs = references.?, .fs = fieldSchema };
    }

    var result: Query.RefsResult = undefined;
    const edgeConstraint = if (isEdge) ref.?.edgeConstraint else db.getEdgeFieldConstraint(db.getFieldSchema(originalType, refField) catch {
        // default empty size - means a bug!
        return 10;
    });
    if (sortArr != null) {
        if (hasFilter) {
            result = sortedReferences(refs.?, ctx, includeNested, sortArr.?, typeEntry.?, edgeConstraint, true, filterArr.?, offset, limit);
        } else {
            result = sortedReferences(refs.?, ctx, includeNested, sortArr.?, typeEntry.?, edgeConstraint, false, null, offset, limit);
        }
    } else if (hasFilter) {
        result = defaultReferences(refs.?, ctx, includeNested, typeEntry.?, edgeConstraint, true, filterArr.?, offset, limit);
    } else {
        result = defaultReferences(refs.?, ctx, includeNested, typeEntry.?, edgeConstraint, false, null, offset, limit);
    }

    const r: *results.Result = &ctx.results.items[resultIndex];

    const val = ctx.allocator.alloc(u8, 8) catch {
        return 10;
    };

    utils.write(u32, val, @truncate(result.size), 0);
    utils.write(u32, val, result.cnt, 4);
    r.*.value = val;

    if (isEdge) {
        result.size += 1;
    }

    return result.size + 10;
}
