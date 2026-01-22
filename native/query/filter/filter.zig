const std = @import("std");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const Node = @import("../../selva/node.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const t = @import("../../types.zig");
const Fixed = @import("./fixed.zig");
const Select = @import("./select.zig");

const COND_ALIGN_BYTES = @alignOf(t.FilterCondition);

pub fn prepare(
    q: []u8,
    _: *Query.QueryCtx,
    typeEntry: Node.Type,
) !void {
    var i: usize = 0;
    while (i < q.len) {
        // this has to expand the buffer
        // size can be done with either
        // add the size in the condition OR add proptype OR add op in equal and make it work
        // just add size in cond
        const headerSize = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition);
        var condition: *t.FilterCondition = undefined;

        // 255 means its unprepared - the condition new index will be set when aligned
        if (q[i] == 255) {
            const condSize = utils.read(u32, q, i + 1 + COND_ALIGN_BYTES);
            const totalSize = headerSize + condSize;
            q[i] = COND_ALIGN_BYTES - utils.alignLeft(t.FilterCondition, q[i + 1 .. i + totalSize]) + 1;
            condition = utils.readPtr(t.FilterCondition, q, q[i] + i);
            condition.fieldSchema = try Schema.getFieldSchema(typeEntry, condition.prop);
            const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);
            condition.alignOffset = utils.alignLeftLen(condition.len, q[nextI .. totalSize + i]);
            const end = totalSize + i;
            i = end;
        } else {
            condition = utils.readPtr(t.FilterCondition, q, q[i] + i + 1);
        }
        i += headerSize + condition.size;

        // ADD REFERENCES

        // switch (condition.op) {
        //     // .nextOrIndex => alignSingle(usize, q, &i),
        //     // .selectLargeRef, .selectSmallRef => {
        //     //     i += utils.sizeOf(t.FilterCondition);
        //     //     const selectReference = utils.readNext(t.FilterSelect, q, &i);
        //     //     prepare(q[i .. i + selectReference.size]);
        //     //     i += selectReference.size;
        //     // },
        //     .eqU32, .neqU32 => alignSingle(u32, q, &i),
        //     // .eqU32Batch, .neqU32Batch => alignBatch(u32, q, &i),
        //     // .eqU32BatchSmall, .neqU32BatchSmall => alignSmallBatch(u32, q, &i),
        //     else => {},
        // }
    }
}

pub fn recursionErrorBoundary(
    cb: anytype,
    ctx: *Query.QueryCtx,
    q: []u8,
    value: []u8,
    i: *usize,
) bool {
    return cb(ctx, q, value, i) catch |err| {
        std.debug.print("Filter: recursionErrorBoundary: Error {any} \n", .{err});
        return false;
    };
}

pub inline fn filter(
    node: Node.Node,
    _: *Query.QueryCtx,
    q: []u8,
    typeEntry: Node.Type,
) !bool {
    var i: usize = 0;
    var pass: bool = true;
    var v: []u8 = undefined;
    var prop: u8 = 255;
    var nextOrIndex: usize = q.len;
    while (i < nextOrIndex) {
        const c = utils.readPtr(t.FilterCondition, q, i + q[i]);
        const valueIndex = i + q[i] + utils.sizeOf(t.FilterCondition);
        const nextIndex = COND_ALIGN_BYTES + 1 + utils.sizeOf(t.FilterCondition) + c.size;

        if (prop != c.prop) {
            prop = c.prop;
            v = Fields.get(typeEntry, node, c.fieldSchema, .null);
        }

        pass = switch (c.op) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readPtr(u32, q, valueIndex + c.len - c.alignOffset).*;
                break :blk true;
            },

            // .selectLargeRef => {
            //     pass = recursionErrorBoundary(Select.largeRef, ctx, q, v, &i);
            // },

            .eqU32 => Fixed.eq(u32, q, v, valueIndex, c),
            .neqU32 => !Fixed.eq(u32, q, v, valueIndex, c),
            .eqU32BatchSmall => Fixed.eqBatchSmall(u32, q, v, valueIndex, c),
            .eqU32Batch => Fixed.eqBatch(u32, q, v, valueIndex, c),

            // not very nice
            .eq => blk: {
                // Generic len
                const targetOffset = valueIndex + c.len - c.alignOffset;
                break :blk std.mem.eql(
                    u8,
                    q[targetOffset .. targetOffset + c.len],
                    v[c.start .. c.start + c.len],
                );
            },

            // .eqU32Batch => try Fixed.eqBatch(u32, q, &i, &condition, v),
            // .neqU32Batch => !try Fixed.eqBatch(u32, q, &i, &condition, v),
            // .eqU32BatchSmall => try Fixed.eqBatchSmall(u32, q, &i, &condition, v),
            // .neqU32BatchSmall => !try Fixed.eqBatchSmall(u32, q, &i, &condition, v),

            else => blk: {
                i = valueIndex;
                break :blk false;
            },
        };

        if (!pass) {
            i = nextOrIndex;
            nextOrIndex = q.len;
        } else {
            i = nextIndex;
        }
    }
    return pass;
}
