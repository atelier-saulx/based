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
const Referencess = @import("../../selva/references.zig");

const COND_ALIGN_BYTES = @alignOf(t.FilterCondition);

fn recursionErrorBoundary(
    cb: anytype,
    node: Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
) bool {
    return cb(.noEdge, node, ctx, q) catch |err| {
        std.debug.print("Filter: recursionErrorBoundary: Error {any} \n", .{err});
        return false;
    };
}

fn prepare(
    comptime edge: t.Edge,
    q: []u8,
    ctx: *Query.QueryCtx,
    typeEntry: Node.Type,
    edgeType: if (edge == .edge) Node.Type else void,
) !void {
    // add a number on query ctx dont run this if filter is set
    var i: usize = 0;
    var prevProp: u8 = 255;
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
                if (edge == .edge and c.useEdge) {
                    c.fieldSchema = try Schema.getFieldSchema(edgeType, c.prop);
                } else {
                    c.fieldSchema = try Schema.getFieldSchema(typeEntry, c.prop);
                }
            }

            const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);

            c.offset = utils.alignLeftLen(c.len, q[nextI .. totalSize + i]);

            const end = totalSize + i;

            if (c.op.prop == t.PropType.alias or
                c.op.prop == t.PropType.cardinality or
                c.op.prop == t.PropType.id)
            {
                c.prop = prevProp;
            }

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
                    try prepare(.noEdge, q[end .. end + select.size], ctx, select.typeEntry, undefined);
                    i = end + select.size;
                },
                else => {
                    i = end;
                },
            }
            prevProp = c.prop;
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
    comptime edge: t.Edge,
    ctx: *Query.QueryCtx,
    i: *usize,
    filterSize: u16, // Might need to make this u32
    q: []u8,
    typeEntry: Node.Type,
    edgeType: if (edge == .edge) Node.Type else void,
) ![]u8 {
    const offset = i.*;
    const needPrep = utils.read(u32, q, offset) != ctx.thread.runId;
    i.* += 4;
    const filterBuf = utils.sliceNext(filterSize - 4, q, i);
    if (needPrep) {
        utils.write(q, ctx.thread.runId, offset);
        try prepare(edge, filterBuf, ctx, typeEntry, edgeType);
    }
    return filterBuf;
}

inline fn getTarget(
    comptime edge: t.Edge,
    target: if (edge == .edge) Referencess.ReferencesIteratorEdgesResult else Node.Node,
    c: *t.FilterCondition,
) Node.Node {
    if (edge == .edge) {
        if (c.useEdge) {
            return target.edge;
        }
        return target.node;
    }
    return target;
}

pub fn filter(
    comptime edge: t.Edge,
    target: if (edge == .edge) Referencess.ReferencesIteratorEdgesResult else Node.Node,
    ctx: *Query.QueryCtx,
    q: []u8,
) !bool {
    var i: usize = 0;

    var pass: bool = true;
    var v: []const u8 = undefined;
    var prop: if (edge == .edge) u8 else u16 = 255;
    var end: usize = q.len;

    while (i < end) {
        const c = utils.readPtr(t.FilterCondition, q, i + q[i]);
        const index = i + q[i] + utils.sizeOf(t.FilterCondition);
        var nextIndex = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition) + c.size + i;

        if (prop != c.prop) {
            // std.debug.print("SELECT PROP GET RAW isEdge {any} {any} {any} {any} {any} \n", .{
            //     c.useEdge,
            //     edge,
            //     prop,
            //     c.prop,
            //     c.op,
            // });
            if (edge == .edge) {
                if (c.useEdge) {
                    v = Fields.getRaw(target.edge, c.fieldSchema);
                    prop = (c.prop << 1) | 1;
                } else {
                    v = Fields.getRaw(target.node, c.fieldSchema);
                    prop = (c.prop << 1);
                }
            } else {
                v = Fields.getRaw(target, c.fieldSchema);
                prop = c.prop;
            }
        }

        pass = switch (c.op.compare) {
            inline .eq,
            .le,
            .lt,
            .ge,
            .gt,
            .neq,
            .range,
            .eqBatch,
            .neqBatch,
            .eqBatchSmall,
            .neqBatchSmall,
            .nrange,
            => |op| blk: {
                break :blk switch (c.op.prop) {
                    .id, .uint32, .int32, .cardinality => Fixed.compare(u32, op, q, v, index, c),
                    .uint16, .int16 => Fixed.compare(u16, op, q, v, index, c),
                    .number => Fixed.compare(f64, op, q, v, index, c),
                    .timestamp => Fixed.compare(u64, op, q, v, index, c),
                    else => Fixed.compare(u8, op, q, v, index, c),
                };
            },
            inline .eqCrc32,
            .incLcase,
            .inc,
            .eqVar,
            .neqVar,
            .eqCrc32Batch,
            .eqVarBatch,
            .neqVarBatch,
            .ninc,
            .neqCrc32,
            .neqCrc32Batch,
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
            // make .selectCardinality
            .selectAlias => blk: {
                const node = getTarget(edge, target, c);
                const typeEntry = Node.getType(ctx.db, node) catch {
                    break :blk false;
                };
                v = Fields.getAliasByNode(typeEntry, node, c.fieldSchema.field) catch {
                    break :blk false;
                };
                // std.debug.print("GET SEL ALIAS {s} \n", .{v});
                break :blk true;
            },
            .selectId => blk: {
                const node = getTarget(edge, target, c);
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
            .selectCardinality => blk: {
                const node = getTarget(edge, target, c);
                v = Fields.getCardinality(node, c.fieldSchema) orelse &.{ 0, 0, 0, 0 };
                break :blk true;
            },
            .selectSmallRefs, .selectLargeRefsEdge, .selectLargeRefEdge, .selectLargeRefs => blk: {
                break :blk true;
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
