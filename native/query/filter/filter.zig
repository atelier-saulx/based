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

// fn alignSingle(T: type, q: []u8, i: *usize) void {
//     const size = utils.sizeOf(T) + 9 + utils.sizeOf(t.FilterCondition);
//     const alignOffset = q[0];
//     if (alignOffset == 255) {
//         // std.debug.print("hello")
//         q[i.*] = 8 - utils.alignLeft(T, q[i.* + 1 .. i.* + size]);
//     }
//     i.* += size;
// }

// fn alignBatch(T: type, q: []u8, i: *usize) void {
//     const condition = utils.readNext(t.FilterCondition, q, i);
//     // make this u32
//     const len = utils.readNext(u32, q, i);
//     if (condition.alignOffset == 255) {
//         q[i.* - 7] = utils.alignLeft(T, q[i.* .. i.* + len * utils.sizeOf(T) + @alignOf(T) + 16]);
//     }
//     // Always 16 bytes padding (can become slightly more efficient)
//     i.* += len * utils.sizeOf(T) + @alignOf(T) + 16;
// }

// fn alignSmallBatch(T: type, q: []u8, i: *usize) void {
//     const condition = utils.readNext(t.FilterCondition, q, i);
//     if (condition.alignOffset == 255) {
//         q[i.* - 3] = utils.alignLeft(T, q[i.* .. i.* + @alignOf(T) + 16]);
//     }
//     // Always 16 bytes padding (can become slightly more efficient)
//     i.* += @alignOf(T) + 16;
// }

// prepare will return the next NOW
// it will also just fill in the current now
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

            // std.debug.print("COND SIZE {any} {any} \n", .{ i + 1 + COND_ALIGN_BYTES, condSize });
            const totalSize = headerSize + condSize;

            q[i] = COND_ALIGN_BYTES - utils.alignLeft(t.FilterCondition, q[i + 1 .. i + totalSize]) + 1;

            // std.debug.print("yo COND align {any}? {any} {any} \n", .{ COND_ALIGN_BYTES, q[i], q });

            condition = utils.readPtr(t.FilterCondition, q, q[i] + i);

            // if (select ref this is different - use type read next)
            // add select edge - finish api
            // add a FIND filter that allows chaining (its a fn)
            // filter((select) => select('contributors').find(jim).filter('$role', 'writer'))
            // filter((select) => select('currentTodo').filter('$status', 'inProgress'))
            // filter('currentTodo.$status', 'inProgress') // make this first
            condition.fieldSchema = try Schema.getFieldSchema(typeEntry, condition.prop);

            const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);

            // end is ofc size + i

            condition.alignOffset = utils.alignLeftLen(condition.len, q[nextI .. totalSize + i]);

            const end = totalSize + i;

            // std.debug.print("yo COND correct {any} {any} - {any} - END {any} \n", .{
            //     condition,
            //     q[nextI..end],
            //     utils.readPtr(u32, q, nextI + condition.len - condition.alignOffset).*,
            //     end,
            // });
            i = end;
        } else {
            condition = utils.readPtr(t.FilterCondition, q, q[i] + i + 1);
        }
        i += headerSize + condition.size;

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

        // const nextI = q[i] + i + utils.sizeOf(t.FilterCondition);

        // std.debug.print("HAVE READ COND!\n", .{});

        if (prop != c.prop) {
            prop = c.prop;
            v = Fields.get(
                typeEntry,
                node,
                c.fieldSchema,
                // try Schema.getFieldSchema(typeEntry, condition.prop),
                .null,
            );
        }

        pass = switch (c.op) {
            .nextOrIndex => blk: {
                nextOrIndex = utils.readPtr(u32, q, valueIndex + c.len - c.alignOffset).*;
                break :blk true;
            },

            // .selectLargeRef => {
            //     pass = recursionErrorBoundary(Select.largeRef, ctx, q, v, &i);
            // },

            .eqU32 => blk: {
                break :blk utils.readPtr(u32, q, valueIndex + c.len - c.alignOffset).* ==
                    utils.readPtr(u32, v, c.start).*;
            },

            .eq => blk: {
                // Generic len
                const targetOffset = valueIndex + c.len - c.alignOffset;
                break :blk std.mem.eql(
                    u8,
                    q[targetOffset .. targetOffset + c.len],
                    v[c.start .. c.start + c.len],
                );
            },

            // .neqU32 => blk: {
            //     // make fn for this
            //     const target = utils.readPtr(u32, q, next + q[0] - COND_ALIGN_BYTES);
            //     const val = utils.readPtr(u32, v, condition.start);
            //     i = next + 4;
            //     break :blk (val.* != target.*);
            // },

            // .neqU32 => !try Fixed.eq(u32, q, &i, &condition, v),
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
