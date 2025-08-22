pub fn default() usize {
    var result: ?*results.Result = null;
    const field: u8 = include[i];
    const prop: t.Prop = @enumFromInt(include[i + 1]);
    i += 2;
    result = try f.get(ctx, id, node, field, prop, typeEntry, edgeRef, isEdge);
    if (result) |r| {
        switch (prop) {
            t.Prop.BINARY, t.Prop.STRING, t.Prop.JSON => {
                size += try f.selvaString(r);
                if (isEdge) size += 1;
                size += try f.add(ctx, id, score, idIsSet, r);
            },
            t.Prop.MICRO_BUFFER => {
                const includeSize = read(u16, include, i);
                i += 2 + includeSize;
                if (includeSize != 0) {
                    size += try f.microBuffer(ctx, r, include[i - includeSize .. i]);
                } else {
                    size += try f.default(r);
                }
                if (isEdge) size += 1;
                size += try f.add(ctx, id, score, idIsSet, r);
            },
            t.Prop.TEXT => {
                const code: t.LangCode = @enumFromInt(include[i]);
                const fallbackSize = include[i + 1];
                i += 2;
                if (fallbackSize > 0) {
                    size += try f.textFallback(
                        isEdge,
                        ctx,
                        id,
                        score,
                        r,
                        code,
                        idIsSet,
                        include[i .. i + fallbackSize],
                    );
                    i += fallbackSize;
                } else if (code == t.LangCode.NONE) {
                    size += try f.textAll(isEdge, ctx, id, score, r, idIsSet);
                } else {
                    size += try f.textSpecific(isEdge, ctx, id, score, r, code, idIsSet);
                }
            },
            else => {
                size += try f.default(r);
                if (isEdge) size += 1;
                size += try f.add(ctx, id, score, idIsSet, r);
            },
        }
        idIsSet = true;
    }
}
