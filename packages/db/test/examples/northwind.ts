import { BasedDb } from '../../src/index.js'
// import { mermaid } from '@based/schema-diagram'
import { deepCopy } from '@based/utils'
import { Schema } from '@based/schema'
import test from '../shared/test.js'
import createNorthwindDb, { defaultSchema } from '../shared/northwindDb.js'

await test('Basic SQL', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // 1. Retrieve all columns in the Region table.
  console.log(1)
  await db.query('region').include('*').get().inspect()

  // 2. Select the FirstName and LastName columns from the Employees table.
  console.log(2)
  console.log(
    await db
      .query('employees')
      .include('firstName', 'lastName')
      .get()
      .toObject(),
  )

  // 3. Select the FirstName and LastName columns from the Employees table.
  // Sort by LastName.
  console.log(3)
  await db
    .query('employees')
    .include('firstName', 'lastName')
    .sort('lastName')
    .get()
    .inspect()

  // 4. Create a report showing Northwind's orders sorted by Freight from most
  // expensive to cheapest.
  // Show OrderId, OrderDate, ShippedDate, CustomerId, and Freight.
  console.log(4)
  await db
    .query('orders')
    .include('orderDate', 'shippedDate', 'customer.id', 'freight')
    .sort('freight', 'desc')
    .get()
    .inspect()

  // 5. Create a report showing the title and the first and last name of all sales representatives.
  console.log(5)
  await db
    .query('employees')
    .include('title', 'firstName', 'lastName')
    .filter('title', '=', 'Sales Representative')
    .get()
    .inspect()

  // 6. Create a report showing the first and last names of all employees who have a region specified.
  console.log(6)
  console.log(
    await db
      .query('employees')
      .include('firstName', 'lastName', 'region')
      .filter('region', '!=', '')
      .get()
      .toObject(),
  )

  // 7. Create a report showing the first and last name of all employees whose last names start
  // with a letter in the last half of the alphabet.
  // Sort by LastName in descending order.
  // TODO
  console.log(7)
  //await db.query('employees').include('firstName', 'lastName').filter('lastName', 'startsWith', ??

  // 8. Create a report showing the title of courtesy and the first and last name of all employees
  // whose title of courtesy begins with "M".
  // TODO
  console.log(8)

  // 9. Create a report showing the first and last name of all sales representatives who are from
  // Seattle or Redmond.
  console.log(9)
  // TODO Impossible to OR
  await db
    .query('employees')
    .include('firstName', 'lastName', 'title', 'city')
    .filter('title', '=', 'Sales Representative')
    .filter('region', '=', 'WA')
    .or((f) => {
      f.filter('city', '=', 'Seattle').or('city', '=', 'London')
    })
    .get()
    .inspect(10)

  // 10. Create a report that shows the company name, contact title, city and country of all
  // customers in Mexico or in any city in Spain except Madrid.
  console.log(10)
  // TODO Impossible
  await db
    .query('customers')
    .include('companyName', 'contactTitle', 'city', 'country')
    //.filter('country', 'includes', ['Mexico', 'Spain'])
    .filter('country', 'includes', ['Mexico', 'Spain'])
    .filter('city', '!=', 'Madrid')
    .get()
    .inspect(100)

  // 11. If the cost of freight is greater than or equal to $500.00, it will now be taxed by 10%.
  // Create a report that shows the order id, freight cost, freight cost with this tax for all orders of
  // $500 or more.
  console.log(11)
  // TODO not possible to aggregate and then filter

  // 12. Find the Total Number of Units Ordered of Product ID 3
  console.log(12)
  console.log(
    await db
      .query('orderDetails')
      .filter('product', '=', 3)
      .count()
      .get()
      .toObject(),
  )

  // 13. Retrieve the number of employees in each city
  console.log(13)
  console.log(
    await db.query('employees').groupBy('city').count().get().toObject(),
  )

  // 14. Find the number of sales representatives in each city that contains at least 2 sales
  // representatives. Order by the number of employees.
  // TODO Can't filter by the result

  // 15. Find the Companies (the CompanyName) that placed orders in 1997
  console.log(15)
  await db
    .query('orders')
    .include('orderDate', 'customer.companyName')
    .filter('orderDate', '..', [
      new Date('1997'),
      new Date(+new Date('1998') - 1),
    ])
    .get()
    .inspect()

  // 16. Create a report showing employee orders.
  console.log(16)
  // TODO

  // 17. Create a report showing the Order ID, the name of the company that placed the order,
  // and the first and last name of the associated employee.
  // Only show orders placed after January 1, 1998 that shipped after they were required.
  // Sort by Company Name.
  console.log(17)
  // TODO filter by field?
  //console.log(await db.query('orders')
  //  .include('customer.companyName', 'employee.firstName', 'employee.lastName', 'shippedDate', 'orderDate', 'requiredDate')
  //  .filter('orderDate', '>=', new Date('January 1, 1998'))
  //  .filter('shippedDate', '>', 'requiredDate')
  //  .get().toObject())

  // 18. Create a report that shows the total quantity of products (from the Order_Details table)
  // ordered. Only show records for products for which the quantity ordered is fewer than 200.
  // TODO

  // SELECT * FROM Customers
  // WHERE country='Mexico';
  console.log('where')
  await db.query('customers').filter('country', '=', 'Mexico').get().inspect()

  // SELECT * FROM products
  // ORDER BY price;
  console.log('order by')
  await db.query('products').sort('unitPrice', 'desc').get().inspect()

  // SELECT * FROM products
  // ORDER BY price;
  console.log('limit')
  console.dir(
    await db
      .query('products')
      .sort('unitPrice', 'desc')
      .range(0, 3)
      .get()
      .toObject(),
    { depth: 10 },
  )

  // SELECT * FROM customers
  // WHERE country IN ('Germany', 'France', 'UK');
  console.log('in')
  await db
    .query('customers')
    .filter('country', '=', ['Germany', 'France', 'UK'])
    .range(0, 3)
    .get()
    .inspect()

  // SELECT * FROM products
  // WHERE unitPrice BETWEEN 10 AND 20
  // ORDER BY price;
  console.log('between')
  await db
    .query('products')
    .filter('unitPrice', '..', [10, 20])
    .sort('unitPrice', 'desc')
    .get()
    .inspect()

  // SELECT customer_id AS ID, company_name AS customer
  // FROM customers;
  console.log('sql aliases')
  console.log(
    (await db.query('customers').include('companyName').get().toObject()).map(
      (r) => ({ id: r.id, customer: r.companyName }),
    ),
  )
  // Union
  // SELECT 'customer' AS Type, contact_name, city, country
  // FROM customers
  // UNION
  // SELECT 'supplier', contact_name, city, country
  // FROM Suppliers
  console.log('union')
  const unionA = await db
    .query('customers')
    .include('contactName', 'city', 'country')
    .range(0, 2)
    .get()
    .toObject()
  const unionB = await db
    .query('suppliers')
    .include('contactName', 'city', 'country')
    .range(0, 2)
    .get()
    .toObject()
  const union = [
    ...unionA.map((r) => ({ type: 'customer', ...r })),
    ...unionB.map((r) => ({ type: 'supplier', ...r })),
  ]
  console.log(union)

  // union all
  // SELECT City, Country FROM Customers
  // WHERE Country='Germany'
  // UNION ALL
  // SELECT City, Country FROM Suppliers
  // WHERE Country='Germany'
  // ORDER BY City;
  console.log('union all')
  const unionAllA = await db
    .query('customers')
    .include('city', 'country')
    .range(0, 3)
    .get()
    .toObject()
  const unionAllB = await db
    .query('suppliers')
    .include('city', 'country')
    .range(0, 3)
    .get()
    .toObject()
  const unionAll = [
    ...unionAllA.map(({ city, country }) => ({ city, country })),
    ...unionAllB.map(({ city, country }) => ({ city, country })),
  ].sort((a, b) => a.city.localeCompare(b.city))
  console.log(unionAll)
})

await test('insert and update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // INSERT INTO customers (company_name, contact_name, address, city, postal_code, country)
  // VALUES ('Cardinal', 'Tom B. Erichsen', 'Skagen 21', 'Stavanger', '4006', 'Norway');
  const res = db.create('customers', {
    companyName: 'Cardinal',
    contactName: 'Tom B. Erichsen',
    address: 'Skagen 21',
    city: 'Stavanger',
    postalCode: '4006',
    country: 'Norway',
  })
  console.log('created')
  await db
    .query('customers')
    .include('*')
    .filter('companyName', '=', 'Cardinal')
    .get()
    .inspect()

  // UPDATE customers
  // SET contact_name = 'Haakon Christensen'
  // WHERE CustomerID = 1;
  db.update('customers', res, {
    contactName: 'Haakon Christensen',
  })
  console.log('updated')
  await db
    .query('customers')
    .include('*')
    .filter('companyName', '=', 'Cardinal')
    .get()
    .inspect()

  // DELETE FROM Customers WHERE CustomerName='Cardinal';
  db.delete(
    'customers',
    (
      await db
        .query('customers')
        .include('id')
        .filter('companyName', '=', 'Cardinal')
        .get()
        .toObject()
    )[0].id,
  )
  console.log('deleted')
  await db
    .query('customers')
    .include('*')
    .filter('companyName', '=', 'Cardinal')
    .get()
    .inspect()
})

await test('inner join', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // SELECT orders.order_id, customers.company_name, orders.order_date
  // FROM orders
  // INNER JOIN customers ON orders.customer_id = customers.customer_id;
  await db
    .query('orders')
    .include('customer.companyName', 'orderDate')
    .range(0, 10)
    .get()
    .inspect()
})

await test('left join', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // SELECT customers.company_name, orders.order_id
  // FROM customers
  // LEFT JOIN orders
  // ON customers.customer_id = orders.customer_id
  // ORDER BY customers.company_name;
  //console.log(await db.query('customers').include('companyName', (q) => q('orders').filter('customerId' '=' ??)
  await db
    .query('customers')
    .include('companyName', (q) => q('orders').include('id'))
    .sort('companyName')
    .range(0, 5)
    .get()
    .inspect(10)
})

await test.skip('right join', async (t) => {
  // Right join TODO
  // SELECT orders.order_id employees.Last_name, employees.first_name
  // FROM orders
  // RIGHT JOIN employees
  // ON orders.employee_id = employees.employee_id
  // ORDER BY orders.order_id;
})

await test('full join', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  db.delete('customers', (await db.query('customers', { customerId: 'WELLI' }).get()).id)

  // Delete orders by WANDK
  const wandk = await db.query('customers', { customerId: 'WANDK' }).get()
  const wandkOrders = await db.query('orders').filter('customer', '=', wandk).get()
  for (const order of wandkOrders) {
    db.delete('orders', order.id)
  }

  // SELECT customers.company_name, orders.order_id
  // FROM customers
  // FULL OUTER JOIN orders ON customers.customer_id=orders.customer_id
  // ORDER BY customers.company_name;

  const customers = await db.query('customers').get().toObject()
  const orders = await db.query('orders').include('customer.id').get().toObject()
  const result = [];

  // LEFT JOIN: Customers with Orders
  customers.forEach((customer) => {
    const matchingOrders = orders.filter((order) => order?.customer?.id === customer.id)
    if (matchingOrders.length > 0) {
      matchingOrders.forEach((order) => {
        result.push({
          companyName: customer.companyName,
          OrderId: order.id
        })
      })
    } else {
      result.push({
        companyName: customer.companyName,
        orderId: null
      })
    }
  });

  // RIGHT JOIN: Orders with no matching Customers
  orders.forEach((order) => {
    const customer = customers.find((c) => c.id === order.customer?.id);
    if (!customer) {
      result.push({
        companyName: null,
        orderId: order.id
      });
    }
  });

  // Sort by companyName
  result.sort((a, b) => {
    if (a.companyName === null) return 1;
    if (b.companyName === null) return -1;
    return a.companyName.localeCompare(b.companyName);
  });

  console.dir(result);
})

await test('self join', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // SELECT A.company_name AS CustomerName1, B.company_name AS CustomerName2, A.City
  // FROM customers A, customers B
  // WHERE A.customer_id <> B.customer_id
  // AND A.city = B.city
  // ORDER BY A.city;
  const result = []
  ;(
    (await db
      .query('customers')
      .include('customerId', 'companyName', 'city')
      .get()
      .toObject()) as {
      id: number
      customerId: string
      city: string
      companyName: string
    }[]
  ).forEach((a, _, customers) => {
    customers.forEach((b) => {
      if (a.city === b.city && a.customerId !== b.customerId) {
        result.push({
          customerA: a.customerId,
          customerB: b.customerId,
          city: a.city,
        })
      }
    })
  })

  console.log(result)
})

await test('aggregates', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // SELECT MIN(unit_price)
  // FROM products;
  console.log('min')
  await db.query('products').min('unitPrice').get().inspect()

  // SELECT MIN(unit_price) AS SmallestPrice, category_id
  // FROM products
  // GROUP BY category_id;
  console.log('min group by')
  await db
    .query('products')
    .min('unitPrice')
    .groupBy('category')
    .get()
    .inspect()

  // SELECT MAX(unit_price)
  // FROM products;
  console.log('max')
  await db.query('products').max('unitPrice').get().inspect()

  // SELECT COUNT(*)
  // FROM products;
  console.log('count')
  await db.query('products').count().get().inspect()

  // SELECT COUNT(*) AS [number of products], category_id
  // FROM products
  // GROUP BY category_id;
  console.log('count group by')
  await db.query('products').count().groupBy('category').get().inspect()

  // SELECT SUM(quantity)
  // FROM order_details;
  console.log('sum')
  await db.query('orderDetails').sum('quantity').get().inspect()

  // SELECT SUM(quantity)
  // FROM order_details
  // WHERE product_id = 11;
  console.log('sum where')
  await db
    .query('orderDetails')
    .sum('quantity')
    .filter('product.id', '=', 11)
    .get()
    .inspect()

  // SELECT order_id, SUM(quantity) AS [Total Quantity]
  // FROM order_details
  // GROUP BY order_id;
  console.log('sum group by')
  await db
    .query('orderDetails')
    .sum('quantity')
    .groupBy('order')
    .range(0, 10)
    .get()
    .inspect()

  // SELECT AVG(unit_price)
  // FROM products;
  console.log('avg')
  await db.query('products').avg('unitPrice').get().inspect()

  // SELECT AVG(unit_price)
  // FROM products
  // WHERE category_id = 1;
  console.log('avg where')
  await db
    .query('products')
    .avg('unitPrice')
    .filter('category.id', '=', 1)
    .get()
    .inspect()

  // SELECT AVG(unit_price) AS AveragePrice, category_id
  // FROM products
  // GROUP BY category_id;
  console.log('avg group by')
  await db
    .query('products')
    .avg('unitPrice')
    .groupBy('category')
    .get()
    .inspect()
})

await test('hooks', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const schema = deepCopy(defaultSchema)
  schema.types.orderDetails.props['discountAmount'] = 'number'
  schema.types.orderDetails['hooks'] = {
    create(payload: Record<string, any>) {
      if (payload.unitPrice !== undefined && payload.discount !== 0) {
        payload.discountAmount = payload.unitPrice * payload.discount
      }
    },
    update(payload: Record<string, any>) {
      if (payload.unitPrice !== undefined && payload.discount !== 0) {
        payload.discountAmount = payload.unitPrice * payload.discount
      }
    },
  }
  await createNorthwindDb(db, schema as Schema)

  // SELECT Avg(unit_price * discount) AS [Average discount] FROM [order_details];
  await db.query('orderDetails').avg('discountAmount').get().inspect()
})

await test.skip('mermaid', async (t) => {
  // @ts-ignore
  console.log(mermaid(db.client.schema))
})
