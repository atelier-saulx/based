//  @ts-nocheck
export default () => {
  !(function (t) {
    if ('object' == typeof exports && 'undefined' != typeof module)
      module.exports = t()
    else if ('function' == typeof define && define.amd) define([], t)
    else {
      var e
      'undefined' != typeof window
        ? (e = window)
        : 'undefined' != typeof global
          ? (e = global)
          : 'undefined' != typeof self && (e = self),
        (e.PF = t())
    }
  })(function () {
    return (function t(e, r, i) {
      function n(s, a) {
        if (!r[s]) {
          if (!e[s]) {
            var u = 'function' == typeof require && require
            if (!a && u) return u(s, !0)
            if (o) return o(s, !0)
            var h = new Error("Cannot find module '" + s + "'")
            throw ((h.code = 'MODULE_NOT_FOUND'), h)
          }
          var l = (r[s] = { exports: {} })
          e[s][0].call(
            l.exports,
            function (t) {
              var r = e[s][1][t]
              return n(r ? r : t)
            },
            l,
            l.exports,
            t,
            e,
            r,
            i,
          )
        }
        return r[s].exports
      }
      for (
        var o = 'function' == typeof require && require, s = 0;
        s < i.length;
        s++
      )
        n(i[s])
      return n
    })(
      {
        1: [
          function (t, e) {
            e.exports = t('./lib/heap')
          },
          { './lib/heap': 2 },
        ],
        2: [
          function (t, e) {
            !function () {
              var t, r, i, n, o, s, a, u, h, l, p, c, f, d, g
              ;(i = Math.floor),
                (l = Math.min),
                (r = function (t, e) {
                  return e > t ? -1 : t > e ? 1 : 0
                }),
                (h = function (t, e, n, o, s) {
                  var a
                  if ((null == n && (n = 0), null == s && (s = r), 0 > n))
                    throw new Error('lo must be non-negative')
                  for (null == o && (o = t.length); o > n; )
                    (a = i((n + o) / 2)), s(e, t[a]) < 0 ? (o = a) : (n = a + 1)
                  return [].splice.apply(t, [n, n - n].concat(e)), e
                }),
                (s = function (t, e, i) {
                  return (
                    null == i && (i = r), t.push(e), d(t, 0, t.length - 1, i)
                  )
                }),
                (o = function (t, e) {
                  var i, n
                  return (
                    null == e && (e = r),
                    (i = t.pop()),
                    t.length ? ((n = t[0]), (t[0] = i), g(t, 0, e)) : (n = i),
                    n
                  )
                }),
                (u = function (t, e, i) {
                  var n
                  return (
                    null == i && (i = r), (n = t[0]), (t[0] = e), g(t, 0, i), n
                  )
                }),
                (a = function (t, e, i) {
                  var n
                  return (
                    null == i && (i = r),
                    t.length &&
                      i(t[0], e) < 0 &&
                      ((n = [t[0], e]), (e = n[0]), (t[0] = n[1]), g(t, 0, i)),
                    e
                  )
                }),
                (n = function (t, e) {
                  var n, o, s, a, u, h
                  for (
                    null == e && (e = r),
                      a = function () {
                        h = []
                        for (
                          var e = 0, r = i(t.length / 2);
                          r >= 0 ? r > e : e > r;
                          r >= 0 ? e++ : e--
                        )
                          h.push(e)
                        return h
                      }
                        .apply(this)
                        .reverse(),
                      u = [],
                      o = 0,
                      s = a.length;
                    s > o;
                    o++
                  )
                    (n = a[o]), u.push(g(t, n, e))
                  return u
                }),
                (f = function (t, e, i) {
                  var n
                  return (
                    null == i && (i = r),
                    (n = t.indexOf(e)),
                    -1 !== n ? (d(t, 0, n, i), g(t, n, i)) : void 0
                  )
                }),
                (p = function (t, e, i) {
                  var o, s, u, h, l
                  if ((null == i && (i = r), (s = t.slice(0, e)), !s.length))
                    return s
                  for (n(s, i), l = t.slice(e), u = 0, h = l.length; h > u; u++)
                    (o = l[u]), a(s, o, i)
                  return s.sort(i).reverse()
                }),
                (c = function (t, e, i) {
                  var s, a, u, p, c, f, d, g, y, b
                  if ((null == i && (i = r), 10 * e <= t.length)) {
                    if (((p = t.slice(0, e).sort(i)), !p.length)) return p
                    for (
                      u = p[p.length - 1], g = t.slice(e), c = 0, d = g.length;
                      d > c;
                      c++
                    )
                      (s = g[c]),
                        i(s, u) < 0 &&
                          (h(p, s, 0, null, i), p.pop(), (u = p[p.length - 1]))
                    return p
                  }
                  for (
                    n(t, i), b = [], a = f = 0, y = l(e, t.length);
                    y >= 0 ? y > f : f > y;
                    a = y >= 0 ? ++f : --f
                  )
                    b.push(o(t, i))
                  return b
                }),
                (d = function (t, e, i, n) {
                  var o, s, a
                  for (
                    null == n && (n = r), o = t[i];
                    i > e && ((a = (i - 1) >> 1), (s = t[a]), n(o, s) < 0);

                  )
                    (t[i] = s), (i = a)
                  return (t[i] = o)
                }),
                (g = function (t, e, i) {
                  var n, o, s, a, u
                  for (
                    null == i && (i = r),
                      o = t.length,
                      u = e,
                      s = t[e],
                      n = 2 * e + 1;
                    o > n;

                  )
                    (a = n + 1),
                      o > a && !(i(t[n], t[a]) < 0) && (n = a),
                      (t[e] = t[n]),
                      (e = n),
                      (n = 2 * e + 1)
                  return (t[e] = s), d(t, u, e, i)
                }),
                (t = (function () {
                  function t(t) {
                    ;(this.cmp = null != t ? t : r), (this.nodes = [])
                  }
                  return (
                    (t.push = s),
                    (t.pop = o),
                    (t.replace = u),
                    (t.pushpop = a),
                    (t.heapify = n),
                    (t.nlargest = p),
                    (t.nsmallest = c),
                    (t.prototype.push = function (t) {
                      return s(this.nodes, t, this.cmp)
                    }),
                    (t.prototype.pop = function () {
                      return o(this.nodes, this.cmp)
                    }),
                    (t.prototype.peek = function () {
                      return this.nodes[0]
                    }),
                    (t.prototype.contains = function (t) {
                      return -1 !== this.nodes.indexOf(t)
                    }),
                    (t.prototype.replace = function (t) {
                      return u(this.nodes, t, this.cmp)
                    }),
                    (t.prototype.pushpop = function (t) {
                      return a(this.nodes, t, this.cmp)
                    }),
                    (t.prototype.heapify = function () {
                      return n(this.nodes, this.cmp)
                    }),
                    (t.prototype.updateItem = function (t) {
                      return f(this.nodes, t, this.cmp)
                    }),
                    (t.prototype.clear = function () {
                      return (this.nodes = [])
                    }),
                    (t.prototype.empty = function () {
                      return 0 === this.nodes.length
                    }),
                    (t.prototype.size = function () {
                      return this.nodes.length
                    }),
                    (t.prototype.clone = function () {
                      var e
                      return (e = new t()), (e.nodes = this.nodes.slice(0)), e
                    }),
                    (t.prototype.toArray = function () {
                      return this.nodes.slice(0)
                    }),
                    (t.prototype.insert = t.prototype.push),
                    (t.prototype.remove = t.prototype.pop),
                    (t.prototype.top = t.prototype.peek),
                    (t.prototype.front = t.prototype.peek),
                    (t.prototype.has = t.prototype.contains),
                    (t.prototype.copy = t.prototype.clone),
                    t
                  )
                })()),
                ('undefined' != typeof e && null !== e ? e.exports : void 0)
                  ? (e.exports = t)
                  : (window.Heap = t)
            }.call(this)
          },
          {},
        ],
        3: [
          function (t, e) {
            function r(t, e, r) {
              ;(this.width = t),
                (this.height = e),
                (this.nodes = this._buildNodes(t, e, r))
            }
            var i = t('./Node')
            ;(r.prototype._buildNodes = function (t, e, r) {
              var n,
                o,
                s = new Array(e)
              for (n = 0; e > n; ++n)
                for (s[n] = new Array(t), o = 0; t > o; ++o)
                  s[n][o] = new i(o, n)
              if (void 0 === r) return s
              if (r.length !== e || r[0].length !== t)
                throw new Error('Matrix size does not fit')
              for (n = 0; e > n; ++n)
                for (o = 0; t > o; ++o) r[n][o] && (s[n][o].walkable = !1)
              return s
            }),
              (r.prototype.getNodeAt = function (t, e) {
                return this.nodes[e][t]
              }),
              (r.prototype.isWalkableAt = function (t, e) {
                return this.isInside(t, e) && this.nodes[e][t].walkable
              }),
              (r.prototype.isInside = function (t, e) {
                return t >= 0 && t < this.width && e >= 0 && e < this.height
              }),
              (r.prototype.setWalkableAt = function (t, e, r) {
                this.nodes[e][t].walkable = r
              }),
              (r.prototype.getNeighbors = function (t, e, r) {
                var i = t.x,
                  n = t.y,
                  o = [],
                  s = !1,
                  a = !1,
                  u = !1,
                  h = !1,
                  l = !1,
                  p = !1,
                  c = !1,
                  f = !1,
                  d = this.nodes
                return (
                  this.isWalkableAt(i, n - 1) &&
                    (o.push(d[n - 1][i]), (s = !0)),
                  this.isWalkableAt(i + 1, n) &&
                    (o.push(d[n][i + 1]), (u = !0)),
                  this.isWalkableAt(i, n + 1) &&
                    (o.push(d[n + 1][i]), (l = !0)),
                  this.isWalkableAt(i - 1, n) &&
                    (o.push(d[n][i - 1]), (c = !0)),
                  e
                    ? (r
                        ? ((a = c && s),
                          (h = s && u),
                          (p = u && l),
                          (f = l && c))
                        : ((a = c || s),
                          (h = s || u),
                          (p = u || l),
                          (f = l || c)),
                      a &&
                        this.isWalkableAt(i - 1, n - 1) &&
                        o.push(d[n - 1][i - 1]),
                      h &&
                        this.isWalkableAt(i + 1, n - 1) &&
                        o.push(d[n - 1][i + 1]),
                      p &&
                        this.isWalkableAt(i + 1, n + 1) &&
                        o.push(d[n + 1][i + 1]),
                      f &&
                        this.isWalkableAt(i - 1, n + 1) &&
                        o.push(d[n + 1][i - 1]),
                      o)
                    : o
                )
              }),
              (r.prototype.clone = function () {
                var t,
                  e,
                  n = this.width,
                  o = this.height,
                  s = this.nodes,
                  a = new r(n, o),
                  u = new Array(o)
                for (t = 0; o > t; ++t)
                  for (u[t] = new Array(n), e = 0; n > e; ++e)
                    u[t][e] = new i(e, t, s[t][e].walkable)
                return (a.nodes = u), a
              }),
              (e.exports = r)
          },
          { './Node': 5 },
        ],
        4: [
          function (t, e) {
            e.exports = {
              manhattan: function (t, e) {
                return t + e
              },
              euclidean: function (t, e) {
                return Math.sqrt(t * t + e * e)
              },
              octile: function (t, e) {
                var r = Math.SQRT2 - 1
                return e > t ? r * t + e : r * e + t
              },
              chebyshev: function (t, e) {
                return Math.max(t, e)
              },
            }
          },
          {},
        ],
        5: [
          function (t, e) {
            function r(t, e, r) {
              ;(this.x = t),
                (this.y = e),
                (this.walkable = void 0 === r ? !0 : r)
            }
            e.exports = r
          },
          {},
        ],
        6: [
          function (t, e, r) {
            function i(t) {
              for (var e = [[t.x, t.y]]; t.parent; )
                (t = t.parent), e.push([t.x, t.y])
              return e.reverse()
            }
            function n(t, e) {
              var r = i(t),
                n = i(e)
              return r.concat(n.reverse())
            }
            function o(t) {
              var e,
                r,
                i,
                n,
                o,
                s = 0
              for (e = 1; e < t.length; ++e)
                (r = t[e - 1]),
                  (i = t[e]),
                  (n = r[0] - i[0]),
                  (o = r[1] - i[1]),
                  (s += Math.sqrt(n * n + o * o))
              return s
            }
            function s(t, e, r, i) {
              var n,
                o,
                s,
                a,
                u,
                h,
                l = Math.abs,
                p = []
              for (
                s = l(r - t),
                  a = l(i - e),
                  n = r > t ? 1 : -1,
                  o = i > e ? 1 : -1,
                  u = s - a;
                ;

              ) {
                if ((p.push([t, e]), t === r && e === i)) break
                ;(h = 2 * u),
                  h > -a && ((u -= a), (t += n)),
                  s > h && ((u += s), (e += o))
              }
              return p
            }
            function a(t) {
              var e,
                r,
                i,
                n,
                o,
                a,
                u = [],
                h = t.length
              if (2 > h) return u
              for (o = 0; h - 1 > o; ++o)
                for (
                  e = t[o],
                    r = t[o + 1],
                    i = s(e[0], e[1], r[0], r[1]),
                    n = i.length,
                    a = 0;
                  n - 1 > a;
                  ++a
                )
                  u.push(i[a])
              return u.push(t[h - 1]), u
            }
            function u(t, e) {
              var r,
                i,
                n,
                o,
                a,
                u,
                h,
                l,
                p,
                c,
                f,
                d,
                g,
                y = e.length,
                b = e[0][0],
                A = e[0][1],
                k = e[y - 1][0],
                m = e[y - 1][1]
              for (
                r = b, i = A, a = e[1][0], u = e[1][1], h = [[r, i]], l = 2;
                y > l;
                ++l
              ) {
                for (
                  c = e[l],
                    n = c[0],
                    o = c[1],
                    f = s(r, i, n, o),
                    g = !1,
                    p = 1;
                  p < f.length;
                  ++p
                )
                  if (((d = f[p]), !t.isWalkableAt(d[0], d[1]))) {
                    ;(g = !0), h.push([a, u]), (r = a), (i = u)
                    break
                  }
                g || ((a = n), (u = o))
              }
              return h.push([k, m]), h
            }
            function h(t) {
              if (t.length < 3) return t
              var e,
                r,
                i,
                n,
                o,
                s,
                a = [],
                u = t[0][0],
                h = t[0][1],
                l = t[1][0],
                p = t[1][1],
                c = l - u,
                f = p - h
              for (
                o = Math.sqrt(c * c + f * f),
                  c /= o,
                  f /= o,
                  a.push([u, h]),
                  s = 2;
                s < t.length;
                s++
              )
                (e = l),
                  (r = p),
                  (i = c),
                  (n = f),
                  (l = t[s][0]),
                  (p = t[s][1]),
                  (c = l - e),
                  (f = p - r),
                  (o = Math.sqrt(c * c + f * f)),
                  (c /= o),
                  (f /= o),
                  (c !== i || f !== n) && a.push([e, r])
              return a.push([l, p]), a
            }
            ;(r.backtrace = i),
              (r.biBacktrace = n),
              (r.pathLength = o),
              (r.interpolate = s),
              (r.expandPath = a),
              (r.smoothenPath = u),
              (r.compressPath = h)
          },
          {},
        ],
        7: [
          function (t, e) {
            function r(t) {
              ;(t = t || {}),
                (this.allowDiagonal = t.allowDiagonal),
                (this.dontCrossCorners = t.dontCrossCorners),
                (this.heuristic = t.heuristic || o.manhattan),
                (this.weight = t.weight || 1)
            }
            var i = t('heap'),
              n = t('../core/Util'),
              o = t('../core/Heuristic')
            ;(r.prototype.findPath = function (t, e, r, o, s) {
              var a,
                u,
                h,
                l,
                p,
                c,
                f,
                d,
                g = new i(function (t, e) {
                  return t.f - e.f
                }),
                y = s.getNodeAt(t, e),
                b = s.getNodeAt(r, o),
                A = this.heuristic,
                k = this.allowDiagonal,
                m = this.dontCrossCorners,
                v = this.weight,
                w = Math.abs,
                x = Math.SQRT2
              for (y.g = 0, y.f = 0, g.push(y), y.opened = !0; !g.empty(); ) {
                if (((a = g.pop()), (a.closed = !0), a === b))
                  return n.backtrace(b)
                for (
                  u = s.getNeighbors(a, k, m), l = 0, p = u.length;
                  p > l;
                  ++l
                )
                  (h = u[l]),
                    h.closed ||
                      ((c = h.x),
                      (f = h.y),
                      (d = a.g + (0 === c - a.x || 0 === f - a.y ? 1 : x)),
                      (!h.opened || d < h.g) &&
                        ((h.g = d),
                        (h.h = h.h || v * A(w(c - r), w(f - o))),
                        (h.f = h.g + h.h),
                        (h.parent = a),
                        h.opened
                          ? g.updateItem(h)
                          : (g.push(h), (h.opened = !0))))
              }
              return []
            }),
              (e.exports = r)
          },
          { '../core/Heuristic': 4, '../core/Util': 6, heap: 1 },
        ],
        8: [
          function (t, e) {
            function r(t) {
              i.call(this, t)
              var e = this.heuristic
              this.heuristic = function (t, r) {
                return 1e6 * e(t, r)
              }
            }
            var i = t('./AStarFinder')
            ;(r.prototype = new i()),
              (r.prototype.constructor = r),
              (e.exports = r)
          },
          { './AStarFinder': 7 },
        ],
        9: [
          function (t, e) {
            function r(t) {
              ;(t = t || {}),
                (this.allowDiagonal = t.allowDiagonal),
                (this.dontCrossCorners = t.dontCrossCorners),
                (this.heuristic = t.heuristic || o.manhattan),
                (this.weight = t.weight || 1)
            }
            var i = t('heap'),
              n = t('../core/Util'),
              o = t('../core/Heuristic')
            ;(r.prototype.findPath = function (t, e, r, o, s) {
              var a,
                u,
                h,
                l,
                p,
                c,
                f,
                d,
                g = function (t, e) {
                  return t.f - e.f
                },
                y = new i(g),
                b = new i(g),
                A = s.getNodeAt(t, e),
                k = s.getNodeAt(r, o),
                m = this.heuristic,
                v = this.allowDiagonal,
                w = this.dontCrossCorners,
                x = this.weight,
                F = Math.abs,
                W = Math.SQRT2,
                N = 1,
                C = 2
              for (
                A.g = 0,
                  A.f = 0,
                  y.push(A),
                  A.opened = N,
                  k.g = 0,
                  k.f = 0,
                  b.push(k),
                  k.opened = C;
                !y.empty() && !b.empty();

              ) {
                for (
                  a = y.pop(),
                    a.closed = !0,
                    u = s.getNeighbors(a, v, w),
                    l = 0,
                    p = u.length;
                  p > l;
                  ++l
                )
                  if (((h = u[l]), !h.closed)) {
                    if (h.opened === C) return n.biBacktrace(a, h)
                    ;(c = h.x),
                      (f = h.y),
                      (d = a.g + (0 === c - a.x || 0 === f - a.y ? 1 : W)),
                      (!h.opened || d < h.g) &&
                        ((h.g = d),
                        (h.h = h.h || x * m(F(c - r), F(f - o))),
                        (h.f = h.g + h.h),
                        (h.parent = a),
                        h.opened
                          ? y.updateItem(h)
                          : (y.push(h), (h.opened = N)))
                  }
                for (
                  a = b.pop(),
                    a.closed = !0,
                    u = s.getNeighbors(a, v, w),
                    l = 0,
                    p = u.length;
                  p > l;
                  ++l
                )
                  if (((h = u[l]), !h.closed)) {
                    if (h.opened === N) return n.biBacktrace(h, a)
                    ;(c = h.x),
                      (f = h.y),
                      (d = a.g + (0 === c - a.x || 0 === f - a.y ? 1 : W)),
                      (!h.opened || d < h.g) &&
                        ((h.g = d),
                        (h.h = h.h || x * m(F(c - t), F(f - e))),
                        (h.f = h.g + h.h),
                        (h.parent = a),
                        h.opened
                          ? b.updateItem(h)
                          : (b.push(h), (h.opened = C)))
                  }
              }
              return []
            }),
              (e.exports = r)
          },
          { '../core/Heuristic': 4, '../core/Util': 6, heap: 1 },
        ],
        10: [
          function (t, e) {
            function r(t) {
              i.call(this, t)
              var e = this.heuristic
              this.heuristic = function (t, r) {
                return 1e6 * e(t, r)
              }
            }
            var i = t('./BiAStarFinder')
            ;(r.prototype = new i()),
              (r.prototype.constructor = r),
              (e.exports = r)
          },
          { './BiAStarFinder': 9 },
        ],
        11: [
          function (t, e) {
            function r(t) {
              ;(t = t || {}),
                (this.allowDiagonal = t.allowDiagonal),
                (this.dontCrossCorners = t.dontCrossCorners)
            }
            var i = t('../core/Util')
            ;(r.prototype.findPath = function (t, e, r, n, o) {
              var s,
                a,
                u,
                h,
                l,
                p = o.getNodeAt(t, e),
                c = o.getNodeAt(r, n),
                f = [],
                d = [],
                g = this.allowDiagonal,
                y = this.dontCrossCorners,
                b = 0,
                A = 1
              for (
                f.push(p),
                  p.opened = !0,
                  p.by = b,
                  d.push(c),
                  c.opened = !0,
                  c.by = A;
                f.length && d.length;

              ) {
                for (
                  u = f.shift(),
                    u.closed = !0,
                    s = o.getNeighbors(u, g, y),
                    h = 0,
                    l = s.length;
                  l > h;
                  ++h
                )
                  if (((a = s[h]), !a.closed))
                    if (a.opened) {
                      if (a.by === A) return i.biBacktrace(u, a)
                    } else
                      f.push(a), (a.parent = u), (a.opened = !0), (a.by = b)
                for (
                  u = d.shift(),
                    u.closed = !0,
                    s = o.getNeighbors(u, g, y),
                    h = 0,
                    l = s.length;
                  l > h;
                  ++h
                )
                  if (((a = s[h]), !a.closed))
                    if (a.opened) {
                      if (a.by === b) return i.biBacktrace(a, u)
                    } else
                      d.push(a), (a.parent = u), (a.opened = !0), (a.by = A)
              }
              return []
            }),
              (e.exports = r)
          },
          { '../core/Util': 6 },
        ],
        12: [
          function (t, e) {
            function r(t) {
              i.call(this, t),
                (this.heuristic = function () {
                  return 0
                })
            }
            var i = t('./BiAStarFinder')
            ;(r.prototype = new i()),
              (r.prototype.constructor = r),
              (e.exports = r)
          },
          { './BiAStarFinder': 9 },
        ],
        13: [
          function (t, e) {
            function r(t) {
              ;(t = t || {}),
                (this.allowDiagonal = t.allowDiagonal),
                (this.dontCrossCorners = t.dontCrossCorners)
            }
            var i = t('../core/Util')
            ;(r.prototype.findPath = function (t, e, r, n, o) {
              var s,
                a,
                u,
                h,
                l,
                p = [],
                c = this.allowDiagonal,
                f = this.dontCrossCorners,
                d = o.getNodeAt(t, e),
                g = o.getNodeAt(r, n)
              for (p.push(d), d.opened = !0; p.length; ) {
                if (((u = p.shift()), (u.closed = !0), u === g))
                  return i.backtrace(g)
                for (
                  s = o.getNeighbors(u, c, f), h = 0, l = s.length;
                  l > h;
                  ++h
                )
                  (a = s[h]),
                    a.closed ||
                      a.opened ||
                      (p.push(a), (a.opened = !0), (a.parent = u))
              }
              return []
            }),
              (e.exports = r)
          },
          { '../core/Util': 6 },
        ],
        14: [
          function (t, e) {
            function r(t) {
              i.call(this, t),
                (this.heuristic = function () {
                  return 0
                })
            }
            var i = t('./AStarFinder')
            ;(r.prototype = new i()),
              (r.prototype.constructor = r),
              (e.exports = r)
          },
          { './AStarFinder': 7 },
        ],
        15: [
          function (t, e) {
            function r(t) {
              ;(t = t || {}),
                (this.allowDiagonal = t.allowDiagonal),
                (this.dontCrossCorners = t.dontCrossCorners),
                (this.heuristic = t.heuristic || i.manhattan),
                (this.weight = t.weight || 1),
                (this.trackRecursion = t.trackRecursion || !1),
                (this.timeLimit = t.timeLimit || 1 / 0)
            }
            t('../core/Util')
            var i = t('../core/Heuristic'),
              n = t('../core/Node')
            ;(r.prototype.findPath = function (t, e, r, i, o) {
              var s,
                a,
                u,
                h = 0,
                l = new Date().getTime(),
                p = function (t, e) {
                  return this.heuristic(
                    Math.abs(e.x - t.x),
                    Math.abs(e.y - t.y),
                  )
                }.bind(this),
                c = function (t, e) {
                  return t.x === e.x || t.y === e.y ? 1 : Math.SQRT2
                },
                f = function (t, e, r, i, s) {
                  if (
                    (h++,
                    this.timeLimit > 0 &&
                      new Date().getTime() - l > 1e3 * this.timeLimit)
                  )
                    return 1 / 0
                  var a = e + p(t, g) * this.weight
                  if (a > r) return a
                  if (t == g) return (i[s] = [t.x, t.y]), t
                  var u,
                    d,
                    y,
                    b,
                    A = o.getNeighbors(
                      t,
                      this.allowDiagonal,
                      this.dontCrossCorners,
                    )
                  for (y = 0, u = 1 / 0; (b = A[y]); ++y) {
                    if (
                      (this.trackRecursion &&
                        ((b.retainCount = b.retainCount + 1 || 1),
                        b.tested !== !0 && (b.tested = !0)),
                      (d = f(b, e + c(t, b), r, i, s + 1)),
                      d instanceof n)
                    )
                      return (i[s] = [t.x, t.y]), d
                    this.trackRecursion &&
                      0 === --b.retainCount &&
                      (b.tested = !1),
                      u > d && (u = d)
                  }
                  return u
                }.bind(this),
                d = o.getNodeAt(t, e),
                g = o.getNodeAt(r, i),
                y = p(d, g)
              for (s = 0; !0; ++s) {
                if (((a = []), (u = f(d, 0, y, a, 0)), 1 / 0 === u)) return []
                if (u instanceof n) return a
                y = u
              }
              return []
            }),
              (e.exports = r)
          },
          { '../core/Heuristic': 4, '../core/Node': 5, '../core/Util': 6 },
        ],
        16: [
          function (t, e) {
            function r(t) {
              ;(t = t || {}),
                (this.heuristic = t.heuristic || o.manhattan),
                (this.trackJumpRecursion = t.trackJumpRecursion || !1)
            }
            var i = t('heap'),
              n = t('../core/Util'),
              o = t('../core/Heuristic')
            ;(r.prototype.findPath = function (t, e, r, o, s) {
              var a,
                u = (this.openList = new i(function (t, e) {
                  return t.f - e.f
                })),
                h = (this.startNode = s.getNodeAt(t, e)),
                l = (this.endNode = s.getNodeAt(r, o))
              for (
                this.grid = s, h.g = 0, h.f = 0, u.push(h), h.opened = !0;
                !u.empty();

              ) {
                if (((a = u.pop()), (a.closed = !0), a === l))
                  return n.expandPath(n.backtrace(l))
                this._identifySuccessors(a)
              }
              return []
            }),
              (r.prototype._identifySuccessors = function (t) {
                var e,
                  r,
                  i,
                  n,
                  s,
                  a,
                  u,
                  h,
                  l,
                  p,
                  c = this.grid,
                  f = this.heuristic,
                  d = this.openList,
                  g = this.endNode.x,
                  y = this.endNode.y,
                  b = t.x,
                  A = t.y,
                  k = Math.abs
                for (
                  Math.max, e = this._findNeighbors(t), n = 0, s = e.length;
                  s > n;
                  ++n
                )
                  if (((r = e[n]), (i = this._jump(r[0], r[1], b, A)))) {
                    if (
                      ((a = i[0]),
                      (u = i[1]),
                      (p = c.getNodeAt(a, u)),
                      p.closed)
                    )
                      continue
                    ;(h = o.octile(k(a - b), k(u - A))),
                      (l = t.g + h),
                      (!p.opened || l < p.g) &&
                        ((p.g = l),
                        (p.h = p.h || f(k(a - g), k(u - y))),
                        (p.f = p.g + p.h),
                        (p.parent = t),
                        p.opened
                          ? d.updateItem(p)
                          : (d.push(p), (p.opened = !0)))
                  }
              }),
              (r.prototype._jump = function (t, e, r, i) {
                var n = this.grid,
                  o = t - r,
                  s = e - i
                if (!n.isWalkableAt(t, e)) return null
                if (
                  (this.trackJumpRecursion === !0 &&
                    (n.getNodeAt(t, e).tested = !0),
                  n.getNodeAt(t, e) === this.endNode)
                )
                  return [t, e]
                if (0 !== o && 0 !== s) {
                  if (
                    (n.isWalkableAt(t - o, e + s) &&
                      !n.isWalkableAt(t - o, e)) ||
                    (n.isWalkableAt(t + o, e - s) && !n.isWalkableAt(t, e - s))
                  )
                    return [t, e]
                } else if (0 !== o) {
                  if (
                    (n.isWalkableAt(t + o, e + 1) &&
                      !n.isWalkableAt(t, e + 1)) ||
                    (n.isWalkableAt(t + o, e - 1) && !n.isWalkableAt(t, e - 1))
                  )
                    return [t, e]
                } else if (
                  (n.isWalkableAt(t + 1, e + s) && !n.isWalkableAt(t + 1, e)) ||
                  (n.isWalkableAt(t - 1, e + s) && !n.isWalkableAt(t - 1, e))
                )
                  return [t, e]
                return 0 !== o &&
                  0 !== s &&
                  (this._jump(t + o, e, t, e) || this._jump(t, e + s, t, e))
                  ? [t, e]
                  : n.isWalkableAt(t + o, e) || n.isWalkableAt(t, e + s)
                    ? this._jump(t + o, e + s, t, e)
                    : null
              }),
              (r.prototype._findNeighbors = function (t) {
                var e,
                  r,
                  i,
                  n,
                  o,
                  s,
                  a,
                  u,
                  h = t.parent,
                  l = t.x,
                  p = t.y,
                  c = this.grid,
                  f = []
                if (h)
                  (e = h.x),
                    (r = h.y),
                    (i = (l - e) / Math.max(Math.abs(l - e), 1)),
                    (n = (p - r) / Math.max(Math.abs(p - r), 1)),
                    0 !== i && 0 !== n
                      ? (c.isWalkableAt(l, p + n) && f.push([l, p + n]),
                        c.isWalkableAt(l + i, p) && f.push([l + i, p]),
                        (c.isWalkableAt(l, p + n) ||
                          c.isWalkableAt(l + i, p)) &&
                          f.push([l + i, p + n]),
                        !c.isWalkableAt(l - i, p) &&
                          c.isWalkableAt(l, p + n) &&
                          f.push([l - i, p + n]),
                        !c.isWalkableAt(l, p - n) &&
                          c.isWalkableAt(l + i, p) &&
                          f.push([l + i, p - n]))
                      : 0 === i
                        ? c.isWalkableAt(l, p + n) &&
                          (f.push([l, p + n]),
                          c.isWalkableAt(l + 1, p) || f.push([l + 1, p + n]),
                          c.isWalkableAt(l - 1, p) || f.push([l - 1, p + n]))
                        : c.isWalkableAt(l + i, p) &&
                          (f.push([l + i, p]),
                          c.isWalkableAt(l, p + 1) || f.push([l + i, p + 1]),
                          c.isWalkableAt(l, p - 1) || f.push([l + i, p - 1]))
                else
                  for (
                    o = c.getNeighbors(t, !0), a = 0, u = o.length;
                    u > a;
                    ++a
                  )
                    (s = o[a]), f.push([s.x, s.y])
                return f
              }),
              (e.exports = r)
          },
          { '../core/Heuristic': 4, '../core/Util': 6, heap: 1 },
        ],
        17: [
          function (t, e) {
            function r(t) {
              n.call(this, t),
                (t = t || {}),
                (this.heuristic = t.heuristic || i.manhattan)
            }
            var i = t('../core/Heuristic'),
              n = t('./JumpPointFinder')
            ;(r.prototype = new n()),
              (r.prototype.constructor = r),
              (r.prototype._jump = function (t, e, r, i) {
                var n = this.grid,
                  o = t - r,
                  s = e - i
                if (!n.isWalkableAt(t, e)) return null
                if (
                  (this.trackJumpRecursion === !0 &&
                    (n.getNodeAt(t, e).tested = !0),
                  n.getNodeAt(t, e) === this.endNode)
                )
                  return [t, e]
                if (0 !== o) {
                  if (
                    (n.isWalkableAt(t, e - 1) &&
                      !n.isWalkableAt(t - o, e - 1)) ||
                    (n.isWalkableAt(t, e + 1) && !n.isWalkableAt(t - o, e + 1))
                  )
                    return [t, e]
                } else {
                  if (0 === s)
                    throw new Error(
                      'Only horizontal and vertical movements are allowed',
                    )
                  if (
                    (n.isWalkableAt(t - 1, e) &&
                      !n.isWalkableAt(t - 1, e - s)) ||
                    (n.isWalkableAt(t + 1, e) && !n.isWalkableAt(t + 1, e - s))
                  )
                    return [t, e]
                  if (this._jump(t + 1, e, t, e) || this._jump(t - 1, e, t, e))
                    return [t, e]
                }
                return this._jump(t + o, e + s, t, e)
              }),
              (r.prototype._findNeighbors = function (t) {
                var e,
                  r,
                  i,
                  n,
                  o,
                  s,
                  a,
                  u,
                  h = t.parent,
                  l = t.x,
                  p = t.y,
                  c = this.grid,
                  f = []
                if (h)
                  (e = h.x),
                    (r = h.y),
                    (i = (l - e) / Math.max(Math.abs(l - e), 1)),
                    (n = (p - r) / Math.max(Math.abs(p - r), 1)),
                    0 !== i
                      ? (c.isWalkableAt(l, p - 1) && f.push([l, p - 1]),
                        c.isWalkableAt(l, p + 1) && f.push([l, p + 1]),
                        c.isWalkableAt(l + i, p) && f.push([l + i, p]))
                      : 0 !== n &&
                        (c.isWalkableAt(l - 1, p) && f.push([l - 1, p]),
                        c.isWalkableAt(l + 1, p) && f.push([l + 1, p]),
                        c.isWalkableAt(l, p + n) && f.push([l, p + n]))
                else
                  for (
                    o = c.getNeighbors(t, !1), a = 0, u = o.length;
                    u > a;
                    ++a
                  )
                    (s = o[a]), f.push([s.x, s.y])
                return f
              }),
              (e.exports = r)
          },
          { '../core/Heuristic': 4, './JumpPointFinder': 16 },
        ],
        18: [
          function (t, e) {
            function r(t) {
              ;(t = t || {}),
                (this.allowDiagonal = t.allowDiagonal),
                (this.dontCrossCorners = t.dontCrossCorners),
                (this.heuristic = t.heuristic || o.manhattan)
            }
            var i = t('heap'),
              n = t('../core/Util'),
              o = t('../core/Heuristic')
            ;(r.prototype.findPath = function (t, e, r, o, s) {
              var a,
                u,
                h,
                l,
                p,
                c,
                f,
                d,
                g = new i(function (t, e) {
                  return t.f - e.f
                }),
                y = s.getNodeAt(t, e),
                b = s.getNodeAt(r, o),
                A = this.heuristic,
                k = this.allowDiagonal,
                m = this.dontCrossCorners,
                v = Math.abs,
                w = Math.SQRT2
              for (y.g = 0, y.f = 0, g.push(y), y.opened = !0; !g.empty(); ) {
                if (((a = g.pop()), (a.closed = !0), a === b))
                  return n.backtrace(b)
                u = s.getNeighbors(a, k, m)
                var x = u.length
                for (l = 0, p = u.length; p > l; ++l)
                  (h = u[l]),
                    h.closed ||
                      ((c = h.x),
                      (f = h.y),
                      (d = a.g + (0 === c - a.x || 0 === f - a.y ? 1 : w)),
                      (!h.opened || d < h.g) &&
                        ((h.g = (d * x) / 9),
                        (h.h = h.h || A(v(c - r), v(f - o))),
                        (h.f = h.g + h.h),
                        (h.parent = a),
                        h.opened
                          ? g.updateItem(h)
                          : (g.push(h), (h.opened = !0))))
              }
              return []
            }),
              (e.exports = r)
          },
          { '../core/Heuristic': 4, '../core/Util': 6, heap: 1 },
        ],
        19: [
          function (t, e) {
            e.exports = {
              Heap: t('heap'),
              Node: t('./core/Node'),
              Grid: t('./core/Grid'),
              Util: t('./core/Util'),
              Heuristic: t('./core/Heuristic'),
              AStarFinder: t('./finders/AStarFinder'),
              BestFirstFinder: t('./finders/BestFirstFinder'),
              BreadthFirstFinder: t('./finders/BreadthFirstFinder'),
              DijkstraFinder: t('./finders/DijkstraFinder'),
              BiAStarFinder: t('./finders/BiAStarFinder'),
              BiBestFirstFinder: t('./finders/BiBestFirstFinder'),
              BiBreadthFirstFinder: t('./finders/BiBreadthFirstFinder'),
              BiDijkstraFinder: t('./finders/BiDijkstraFinder'),
              IDAStarFinder: t('./finders/IDAStarFinder'),
              JumpPointFinder: t('./finders/JumpPointFinder'),
              OrthogonalJumpPointFinder: t(
                './finders/OrthogonalJumpPointFinder',
              ),
              TraceFinder: t('./finders/TraceFinder'),
            }
          },
          {
            './core/Grid': 3,
            './core/Heuristic': 4,
            './core/Node': 5,
            './core/Util': 6,
            './finders/AStarFinder': 7,
            './finders/BestFirstFinder': 8,
            './finders/BiAStarFinder': 9,
            './finders/BiBestFirstFinder': 10,
            './finders/BiBreadthFirstFinder': 11,
            './finders/BiDijkstraFinder': 12,
            './finders/BreadthFirstFinder': 13,
            './finders/DijkstraFinder': 14,
            './finders/IDAStarFinder': 15,
            './finders/JumpPointFinder': 16,
            './finders/OrthogonalJumpPointFinder': 17,
            './finders/TraceFinder': 18,
            heap: 1,
          },
        ],
      },
      {},
      [19],
    )(19)
  })
}
