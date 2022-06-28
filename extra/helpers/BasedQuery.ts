class BasedQuery {
  constructor() {
    this.q = {}
  }

  get (id, fields=[]) {
    let q = {
      $id: id
    }

    if (fields.length<=0) {
      q['$all'] = true
    } else {
      fields.forEach(field => {
        q[field] = true
      })
    }

    return q
  }

  select (...fields) {
    if (fields && fields.length>0) {
      if (fields[0] === '*') {
        this.q['$all'] = true
        this.q['id'] = true
        this.q['createdAt'] = true
        this.q['updatedAt'] = true
      } else {
        fields.forEach(field => {
          this.q[field] = true
        })
      }
    } else {
      this.q['$all'] = true
      this.q['id'] = true
      this.q['createdAt'] = true
      this.q['updatedAt'] = true
    }

    this.q['$list'] = {}

    return this
  }

  limit ($offset=null, $limit=null) {
    $offset!==null && (this.q['$list']['$offset'] = $offset)
    $limit!==null && (this.q['$list']['$limit'] = $limit)
    return this
  }

  sort ($field, $order='desc') {
    this.q['$list']['$sort'] = { $field, $order }
    return this
  }

  find (collection=null, traverse='descendants') {
    let $find = {}

    if (traverse) {
      $find['$traverse'] = traverse
    }

    if (collection) {
      $find['$filter'] = {
        $field: 'type',
        $operator: '=',
        $value: collection,
      }
    }

    this.q['$list']['$find'] = $find

    return this
  }

  list () {
    return this.q
  }
}

export default BasedQuery
