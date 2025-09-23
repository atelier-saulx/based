const std = @import("std");

pub const Fields = std.AutoHashMap(u8, void);

pub const Filters = std.AutoHashMap(u8, []u8);

pub const Ids = std.AutoHashMap(u32, void);

pub const SubType = enum(u8) {
    singleId = 1,
    simpleMulti = 2,
};

pub const Subscription = struct {
    subType: SubType,
    fields: Fields,
    hasFullRange: bool,
    filters: ?*Filters,
    ids: Ids,
    stagedIds: ?Ids,
};

pub const Subscriptions = std.AutoHashMap(u64, *Subscription);

pub const ActiveSubIds = std.AutoHashMap(u32, u32); // max 65k different subs per id - seems ok

pub const TypeSubscriptionCtx = struct {
    nonMarkedId: Subscriptions, // see difference in perf
    nonMarkedMulti: Subscriptions, // different for different things
    activeIdSubs: ActiveSubIds, // can add every id here (doubles mem usage but might be good to do)
    subs: Subscriptions, // if zero remove type
};

pub const TypeSubMap = std.AutoHashMap(u16, *TypeSubscriptionCtx);

pub const SubscriptionMarked = std.AutoHashMap(u64, u16);

pub const SubscriptionCtx = struct {
    types: TypeSubMap,
    subscriptionsMarked: SubscriptionMarked, // only has an IF HERE
    hasMarkedSubscriptions: bool,
};
