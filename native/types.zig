pub const TypeId = u16;

pub const BridgeResponse = enum(u32) {
    query = 1,
    modify = 2,
    flushQuery = 3,
    flushModify = 4,
};

pub const OpType = enum(u8) {
    // Query
    id = 0,
    ids = 1,
    default = 2,
    alias = 3,
    aggregates = 4,
    aggregatesCountType = 5,

    blockHash = 42,
    saveBlock = 67,
    saveCommon = 69,
    getSchemaIds = 70,
    // Modify
    modify = 127,
    loadBlock = 128,
    unloadBlock = 129,
    loadCommon = 130,
    createType = 131,
    setSchemaIds = 132,

    // --------------------
    noOp = 255,

    pub fn isModifyOp(self: OpType) bool {
        return @intFromEnum(self) > 126;
    }
};

pub const ModOp = enum(u8) {
    switchProp = 0,
    switchIdUpdate = 1,
    switchType = 2,
    createProp = 3,
    deleteSortIndex = 4,
    updatePartial = 5,
    updateProp = 6,
    addEmptySort = 7,
    switchIdCreateUnsafe = 8,
    switchIdCreate = 9,
    switchIdCreateRing = 19,
    switchEdgeId = 20,
    deleteNode = 10,
    delete = 11,
    increment = 12,
    decrement = 13,
    expire = 14,
    addEmptySortText = 15,
    deleteTextField = 16,
    upsert = 17,
    insert = 18,
    // TODO remove when modify is not used for response
    padding = 255,
};

pub const PropType = enum(u8) {
    null = 0,
    timestamp = 1,
    created = 2,
    updated = 3,
    number = 4,
    cardinality = 5,
    uint8 = 6,
    uint32 = 7,
    boolean = 9,
    @"enum" = 10,
    string = 11,
    text = 12,
    reference = 13,
    references = 14,
    microBuffer = 17,
    alias = 18,
    aliases = 19,
    int8 = 20,
    int16 = 21,
    uint16 = 22,
    int32 = 23,
    binary = 25,
    vector = 27,
    json = 28,
    colVec = 30,
    object = 29,
    id = 255,

    pub fn isBuffer(self: PropType) bool {
        return switch (self) {
            .binary,
            .alias,
            .string,
            => true,
            else => false,
        };
    }

    pub fn isSigned(self: PropType) bool {
        return switch (self) {
            .int16,
            .int32,
            .timestamp,
            .created,
            .updated,
            => true,
            else => false,
        };
    }

    pub fn isNumber(self: PropType) bool {
        return switch (self) {
            .number,
            .int8,
            .uint8,
            .uint16,
            .int16,
            .uint32,
            .int32,
            .cardinality,
            => true,
            else => false,
        };
    }

    pub fn crcLen(self: PropType) usize {
        return switch (self) {
            .string => 4,
            else => 0,
        };
    }

    pub fn size(self: PropType) u8 {
        switch (self) {
            .timestamp,
            .created,
            .updated,
            .number,
            => return 8,
            .int8,
            .uint8,
            .boolean,
            .@"enum",
            => return 1,
            .id,
            .uint32,
            .int32,
            => return 4,
            .int16,
            .uint16,
            => return 2,
            else => return 0,
        }
    }
};

pub const RefOp = enum(u8) {
    overwrite = 0,
    add = 1,
    delete = 2,
    putOverwrite = 3,
    putAdd = 4,
    _,
};

pub const ReadOp = enum(u8) {
    none = 0,
    id = 255,
    edge = 252,
    references = 253,
    reference = 254,
    aggregation = 250,
    meta = 249,
};

pub const ReferencesSelect = enum(u8) {
    index = 1,
    any = 2,
    all = 3,
};

pub const RefEdgeOp = enum(u8) {
    noEdgeNoIndexRealId = 0,
    edgeNoIndexRealId = 1,
    edgeIndexRealId = 2,
    noEdgeIndexRealId = 3,
    noEdgeNoIndexTmpId = 4,
    edgeNoIndexTmpId = 5,
    edgeIndexTmpId = 6,
    noEdgeIndexTmpId = 7,
    _,
    pub fn hasEdges(self: RefEdgeOp) bool {
        return switch (self) {
            RefEdgeOp.edgeIndexRealId,
            RefEdgeOp.edgeNoIndexRealId,
            RefEdgeOp.edgeNoIndexTmpId,
            RefEdgeOp.edgeIndexTmpId,
            => true,
            else => false,
        };
    }
    pub fn isTmpId(self: RefEdgeOp) bool {
        return switch (self) {
            RefEdgeOp.noEdgeNoIndexTmpId,
            RefEdgeOp.edgeNoIndexTmpId,
            RefEdgeOp.edgeIndexTmpId,
            RefEdgeOp.noEdgeIndexTmpId,
            => true,
            else => false,
        };
    }
    pub fn hasIndex(self: RefEdgeOp) bool {
        return switch (self) {
            RefEdgeOp.edgeIndexRealId,
            RefEdgeOp.noEdgeIndexRealId,
            RefEdgeOp.edgeIndexTmpId,
            RefEdgeOp.noEdgeIndexTmpId,
            => true,
            else => false,
        };
    }
};

pub const LangCode = enum(u8) {
    none = 0,
    aa = 1,
    ab = 2,
    af = 3,
    ak = 4,
    sq = 5,
    am = 6,
    ar = 7,
    an = 8,
    hy = 9,
    as = 10,
    av = 11,
    ae = 12,
    ay = 13,
    az = 14,
    eu = 15,
    be = 16,
    bn = 17,
    bi = 18,
    bs = 19,
    br = 20,
    bg = 21,
    my = 22,
    ca = 23,
    km = 24,
    ce = 25,
    zh = 26,
    cv = 27,
    kw = 28,
    co = 29,
    hr = 30,
    cs = 31,
    da = 32,
    dv = 33,
    nl = 34,
    dz = 35,
    en = 36,
    et = 37,
    fo = 38,
    fi = 39,
    fr = 40,
    ff = 41,
    gd = 42,
    gl = 43,
    de = 44,
    gsw = 45,
    el = 46,
    kl = 47,
    gu = 48,
    ht = 49,
    ha = 50,
    he = 51,
    hi = 52,
    hu = 53,
    is = 54,
    ig = 55,
    id = 56,
    ia = 57,
    iu = 58,
    ik = 59,
    ga = 60,
    it = 61,
    ja = 62,
    kn = 63,
    ks = 64,
    kk = 65,
    rw = 66,
    ko = 67,
    ku = 68,
    ky = 69,
    lo = 70,
    la = 71,
    lv = 72,
    lb = 73,
    li = 74,
    ln = 75,
    lt = 76,
    mk = 77,
    mg = 78,
    ms = 79,
    ml = 80,
    mt = 81,
    gv = 82,
    mi = 83,
    ro = 84,
    mn = 85,
    ne = 86,
    se = 87,
    no = 88,
    nb = 89,
    nn = 90,
    oc = 91,
    @"or" = 92,
    om = 93,
    os = 94,
    pa = 95,
    ps = 96,
    fa = 97,
    pl = 98,
    pt = 99,
    qu = 100,
    rm = 101,
    ru = 102,
    sm = 103,
    sa = 104,
    sc = 105,
    sr = 106,
    sd = 107,
    si = 108,
    sk = 109,
    sl = 110,
    so = 111,
    st = 112,
    nr = 113,
    es = 114,
    sw = 115,
    ss = 116,
    sv = 117,
    tl = 118,
    tg = 119,
    ta = 120,
    tt = 121,
    te = 122,
    th = 123,
    bo = 124,
    ti = 125,
    to = 126,
    ts = 127,
    tn = 128,
    tr = 129,
    tk = 130,
    ug = 131,
    uk = 132,
    ur = 133,
    uz = 134,
    ve = 135,
    vi = 136,
    wa = 137,
    cy = 138,
    fy = 139,
    wo = 140,
    xh = 141,
    yi = 142,
    yo = 143,
    zu = 144,
    ka = 145,
    cnr = 146,
};

pub const MAIN_PROP: u8 = 0;
pub const ID_PROP: u8 = 255;

pub const ReadRefOp = enum(u8) {
    references = @intFromEnum(ReadOp.references),
    reference = @intFromEnum(ReadOp.reference),
    none = @intFromEnum(ReadOp.none),
};

pub const ResultType = enum(u8) {
    default = 0,
    references = 1,
    reference = 2,
    edge = 3,
    referencesEdge = 4,
    referenceEdge = 5,
    aggregate = 6,
    meta = 7,
    metaEdge = 8,
    fixed = 9,
    edgeFixed = 10,
};

pub const AggFn = enum(u8) {
    none = 0,
    avg = 1,
    cardinality = 2,
    concat = 3, // string aggregation, delimiter should be an argument
    count = 4,
    max = 5,
    min = 6,
    mode = 7, // ordered-set
    percentile = 8, // continuous or discrete should be optional parameters, default = discrete
    rank = 9, // hypothetical-set, dense should be optional parameter
    stddev = 10, // population or sample should be optional parameters, default = sample
    sum = 11,
    variance = 12,
    harmonicMean = 13,
};

pub const Compression = enum(u8) {
    none = 0,
    compressed = 1,
};

pub const Interval: type = enum(u8) {
    none = 0,
    epoch = 1,
    hour = 2,
    minute = 3,
    second = 4,
    microseconds = 5,
    day = 6, // The day of the month (1–31); for interval values, the number of days
    doy = 7, // The day of the year (0–365)
    dow = 8, // The day of the week as Sunday (0) to Saturday (6)
    isoDOW = 9, // The day of the week as Monday (1) to Sunday (7). This matches the ISO 8601 day of the week numbering.
    week = 10, // The number of the ISO 8601 week-numbering week of the year
    month = 11, // The number of the month within the year (0–11);
    isoMonth = 12, // The number of the month within the year (1–12);
    quarter = 13, // The quarter of the year (1–4) that the date is in
    year = 14,
};

pub const SortOrder = enum(u8) {
    asc = 0,
    desc = 1,
};

pub const SortHeader = packed struct {
    order: SortOrder,
    prop: u8, // use prop type for this
    propType: PropType,
    start: u16,
    len: u16,
    lang: LangCode,
};

// maybe just default, defaultSort, search, searchSort, vec, vecSort
// maybe just add desc or not desc this can then fit in range and offset
// sort is allready handled

pub const QUERY_ITERATOR_DEFAULT = 0;
pub const QUERY_ITERATOR_EDGE = 20;
pub const QUERY_ITERATOR_EDGE_INCLUDE = 30;
pub const QUERY_ITERATOR_SEARCH = 120;
pub const QUERY_ITERATOR_SEARCH_VEC = 130;

pub const QueryIteratorType = enum(u8) {
    default = 0,
    sort = 1,
    filter = 2,
    filterSort = 3,
    desc = 4,
    descSort = 5,
    descFilter = 6,
    descFilterSort = 7,
    // edge
    edge = 20,
    edgeSort = 21,
    edgeFilter = 22,
    edgeFilterSort = 23,
    edgeDesc = 24,
    edgeDescSort = 25,
    edgeDescFilter = 26,
    edgeDescFilterSort = 27,
    // edge include
    edgeInclude = 30,
    edgeIncludeSort = 31,
    edgeIncludeFilter = 32,
    edgeIncludeFilterSort = 33,
    edgeIncludeDesc = 34,
    edgeIncludeDescSort = 35,
    edgeIncludeDescFilter = 36,
    edgeIncludeDescFilterSort = 37,
    // default search
    search = 120,
    searchFilter = 121,
    // add edge include / edge later
    // vec search
    vec = 130,
    vecFilter = 131,
    // add edge include / edge later
};

// include op needs overlap with this
// here we add SORT
pub const QueryType = enum(u8) {
    id = 0,
    ids = 1,
    default = 2,
    alias = 3,
    aggregates = 4,
    aggregatesCount = 5,
    references = 6,
    reference = 7,
};

pub const IncludeOp = enum(u8) {
    aggregates = 4,
    aggregatesCount = 5,
    references = 6,
    reference = 7,
    // ---------------------
    default = 127,
    referencesAggregation = 128,
    meta = 129,
    partial = 130,
    // ---------------------
    defaultWithOpts = 131,
    metaWithOpts = 132,
    // ---------------------
};

pub const IncludeHeader = packed struct {
    op: IncludeOp,
    prop: u8,
    propType: PropType,
};

pub const IncludeMetaHeader = packed struct {
    op: IncludeOp,
    prop: u8,
    propType: PropType,
};

pub const IncludePartialHeader = packed struct {
    op: IncludeOp,
    prop: u8,
    propType: PropType,
    amount: u16,
};

pub const IncludePartialProp = packed struct {
    start: u16,
    size: u16,
};

pub const IncludeOpts = packed struct {
    end: u32,
    isChars: bool,
    hasOpts: bool,
    _padding: u6,
    langFallbackSize: u8,
    lang: LangCode,
};

pub const IncludeResponse = packed struct {
    prop: u8,
    size: u32,
};

pub const IncludeResponseMeta = packed struct {
    op: ReadOp,
    prop: u8,
    lang: LangCode,
    compressed: bool,
    _padding: u7,
    crc32: u32,
    size: u32,
};

// pub const IncludeHeaderPartial = packed struct {
//     op: IncludeOp,
//     prop: u8,
//     propType: PropType,
// };

// pub const IncludeHeaderMeta = packed struct {
//     op: IncludeOp,
//     prop: u8,
//     propType: PropType,
// };

pub const QuerySingleHeader = packed struct {
    op: QueryType,
    size: u16, // cannot be more then 16kb? might be good enough
    typeId: TypeId,
    id: u32,
    filterSize: u16,
    aliasSize: u16,
    includeEdge: bool, // this just tells it in references that it needs to loop trhough edge + ref
    _padding: u7,
};

pub const QueryHeader = packed struct {
    op: QueryType,
    includeSize: u16, // cannot be more then 16kb? might be good enough
    prop: u8, // this is for ref
    typeId: TypeId,
    edgeTypeId: TypeId,
    offset: u32,
    limit: u32,
    filterSize: u16,
    searchSize: u16,
    edgeSize: u16,
    edgeFilterSize: u16,
    iteratorType: QueryIteratorType,
    sort: bool,
    _padding: u7,
};

pub const FilterOp = enum(u8) {
    equal = 1,
    has = 2,
    endsWith = 4,
    startsWith = 5,
    largerThen = 6,
    smallerThen = 7,
    largerThenInclusive = 8,
    smallerThenInclusive = 9,
    equalNormalize = 12,
    hasLowerCase = 13,
    startsWithNormalize = 14,
    endsWithNormalize = 15,
    equalCrc32 = 17,
    like = 18,
    pub fn isNumerical(self: FilterOp) bool {
        return switch (self) {
            FilterOp.smallerThen,
            FilterOp.largerThen,
            FilterOp.largerThenInclusive,
            FilterOp.smallerThenInclusive,
            => true,
            else => false,
        };
    }
};

pub const FilterType = enum(u8) {
    negate = 1,
    default = 2,
};

pub const FilterMode = enum(u8) {
    default = 0,
    orFixed = 1,
    orVar = 2,
    andFixed = 3,
    defaultVar = 4,
    reference = 5,
};

pub const FilterMeta = enum(u8) {
    references = 250,
    exists = 251,
    edge = 252,
    orBranch = 253,
    reference = 254,
    id = 255,
    _,
};

pub const FilterVectorFn = enum(u8) {
    dotProduct = 0,
    manhattanDistance = 1,
    cosineSimilarity = 2,
    euclideanDistance = 3,
};

pub const VectorBaseType = enum(u8) {
    int8 = 1,
    uint8 = 2,
    int16 = 3,
    uint16 = 4,
    int32 = 5,
    uint32 = 6,
    float32 = 7,
    float64 = 8,
};

pub const FilterMaxVectorScore: f32 = 9999999;

pub const FilterMaxStringScore: u8 = 255;

pub const FilterAlignment = enum(u8) { notSet = 255, _ };

pub const AggGroupedBy = enum(u8) {
    hasGroup = 255,
    none = 0,
};

pub const AggType = enum(u8) {
    sum = 1,
    count = 2,
    cardinality = 3,
    stddev = 4,
    average = 5,
    variance = 6,
    max = 7,
    min = 8,
    hmean = 9,
};
