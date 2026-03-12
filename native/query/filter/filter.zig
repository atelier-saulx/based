const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const Selva = @import("../../selva/selva.zig");
const t = @import("../../types.zig");
const Fixed = @import("fixed.zig");
const Variable = @import("./variable/variable.zig");
const Thread = @import("../../thread/thread.zig");

const COND_ALIGN_BYTES = @alignOf(t.FilterCondition);

fn recursionErrorBoundary(
    cb: anytype,
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
) bool {
    return cb(node, ctx, q) catch |err| {
        std.debug.print("Filter: recursionErrorBoundary: Error {any} \n", .{err});
        return false;
    };
}

fn prepare(
    q: []u8,
    ctx: *Query.QueryCtx,
    typeEntry: Node.Type,
) !void {
    // add a number on query ctx dont run this if filter is set
    var i: usize = 0;
    while (i < q.len) {
        const headerSize = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition);
        var c: *t.FilterCondition = undefined;
        // 255 means its unprepared - the condition new index will be set when aligned
        if (q[i] == 255) {
            const condSize = utils.read(u32, q, i + 3 + COND_ALIGN_BYTES);
            const totalSize = headerSize + condSize;

            q[i] = COND_ALIGN_BYTES - utils.alignLeft(t.FilterCondition, q[i + 1 .. i + totalSize]) + 1;
            c = utils.readPtr(t.FilterCondition, q, q[i] + i);

            if (c.op.compare != t.FilterOpCompare.nextOrIndex and
                c.op.prop != t.PropType.id)
            {
                c.fieldSchema = try Schema.getFieldSchema(typeEntry, c.prop);
            }

            const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);

            c.offset = utils.alignLeftLen(c.len, q[nextI .. totalSize + i]);

            const end = totalSize + i;

            switch (c.op.compare) {
                .selectLargeRefEdge => {
                    // const select = utils.readPtr(t.FilterSelect, q, i + q[i] + utils.sizeOf(t.FilterCondition) + @alignOf(t.FilterSelect) - c.offset);
                    // const edgeSelect = utils.readPtr(t.FilterSelect, q, i + q[i] + utils.sizeOf(t.FilterCondition) + @alignOf(t.FilterSelect) - condition.offset);
                    // select.typeEntry = try Node.getType(ctx.db, select.typeId);
                    // try prepare(q[end .. end + select.size], ctx, select.typeEntry);
                    // i = end + select.size;
                    // i = end;
                },
                .selectRef => {
                    const select = utils.readPtr(t.FilterSelect, q, nextI + @alignOf(t.FilterSelect) - c.offset);
                    select.typeEntry = try Node.getType(ctx.db, select.typeId);
                    try prepare(q[end .. end + select.size], ctx, select.typeEntry);
                    i = end + select.size;
                },
                // .nincLcase => {}
                // can check it here...
                else => {
                    i = end;
                },
            }
        } else {
            c = utils.readPtr(t.FilterCondition, q, q[i] + i); // + 1
            const totalSize = headerSize + c.size;
            const end = totalSize + i;
            i = end;
        }
        // if condition has type NOW we need to handle it
    }
}

pub fn readFilter(
    ctx: *Query.QueryCtx,
    i: *usize,
    filterSize: u16, // Might need to make this u32
    q: []u8,
    typeEntry: Node.Type,
) ![]u8 {
    const offset = i.*;
    const needPrep = utils.read(u32, q, offset) != ctx.thread.runId;
    i.* += 4;
    const filterBuf = utils.sliceNext(filterSize - 4, q, i);
    if (needPrep) {
        utils.write(q, ctx.thread.runId, offset);
        try prepare(filterBuf, ctx, typeEntry);
    }
    return filterBuf;
}

pub inline fn filter(
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
    // comptime hasEdges
    // edge

    // then we can make a mixed checker in the filter creator
    // if edge it just add it in the bool
) !bool {
    var i: usize = 0;

    var pass: bool = true;
    var v: []const u8 = undefined;
    var prop: u8 = 255;
    var end: usize = q.len;

    while (i < end) {
        const c = utils.readPtr(t.FilterCondition, q, i + q[i]);
        const index = i + q[i] + utils.sizeOf(t.FilterCondition);
        var nextIndex = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition) + c.size + i;

        if (prop != c.prop) {
            // if has edge we can just get it here and it works
            prop = c.prop;
            v = Fields.getRaw(node, c.fieldSchema);
        }

        pass = switch (c.op.compare) {
            .selectAlias => blk: {
                const typeEntry = Node.getType(ctx.db, node) catch {
                    break :blk false;
                };
                v = Fields.getAliasByNode(typeEntry, node, c.fieldSchema.field) catch {
                    break :blk false;
                };
                break :blk true;
            },
            .selectId => blk: {
                v = Node.getNodeIdAsSlice(node);
                break :blk true;
            },
            .nextOrIndex => blk: {
                end = utils.readPtr(u64, q, index + @alignOf(u64) - c.offset).*;
                break :blk true;
            },
            .selectRef => blk: {
                const select = utils.readPtr(t.FilterSelect, q, index + @alignOf(t.FilterSelect) - c.offset);
                nextIndex += select.size;
                if (Node.getNode(select.typeEntry, utils.readPtr(u32, v, 0).*)) |refNode| {
                    break :blk recursionErrorBoundary(filter, refNode, ctx, q[nextIndex - select.size .. nextIndex]);
                } else {
                    break :blk false;
                }
            },
            .selectSmallRefs, .selectLargeRefsEdge, .selectLargeRefEdge, .selectLargeRefs => blk: {
                break :blk true;
            },
            inline .eq,
            .neq,
            .eqBatch,
            .neqBatch,
            .eqBatchSmall,
            .neqBatchSmall,
            .range,
            .nrange,
            .le,
            .lt,
            .ge,
            .gt,
            => |op| blk: {
                break :blk switch (c.op.prop) {
                    .id, .uint32, .int32 => Fixed.compare(u32, op, q, v, index, c),
                    .uint16, .int16 => Fixed.compare(u16, op, q, v, index, c),
                    .number => Fixed.compare(f64, op, q, v, index, c),
                    .timestamp => Fixed.compare(u64, op, q, v, index, c),
                    else => Fixed.compare(u8, op, q, v, index, c),
                };
            },
            inline .eqCrc32,
            .neqCrc32,
            .eqCrc32Batch,
            .neqCrc32Batch,
            .eqVar,
            .neqVar,
            .eqVarBatch,
            .neqVarBatch,
            .inc,
            .ninc,
            .incLcase,
            .nincLcase,
            .incLcaseFast,
            .nincLcaseFast,
            .incBatch,
            .nincBatch,
            .incBatchLcase,
            .nincBatchLcase,
            .incBatchLcaseFast,
            .nincBatchLcaseFast,
            .like,
            .nlike,
            .likeBatch,
            .nlikeBatch,
            => |op| blk: {
                @setEvalBranchQuota(2000);
                break :blk switch (c.op.prop) {
                    // optionaly make this into a var len
                    .alias => Variable.compare(.raw, op, q, v, index, c, ctx.thread),
                    .string, .json, .binary => Variable.compare(.default, op, q, v, index, c, ctx.thread),
                    .stringFixed, .jsonFixed, .binaryFixed => Variable.compare(.fixed, op, q, v, index, c, ctx.thread),
                    .stringLocalized, .jsonLocalized => Variable.compare(.localized, op, q, v, index, c, ctx.thread),
                    else => false,
                };
            },
            // else => false,
        };
        if (!pass) {
            i = end;
            end = q.len;
        } else {
            i = nextIndex;
        }
    }
    return pass;
}
