import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import createNorthwind from './shared/northwindDb.js'

await test('northwind', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwind(db)

  // 1. Retrieve all columns in the Region table.
  console.log(1)
  await db.query('region').include('*').get().inspect()

  // 2. Select the FirstName and LastName columns from the Employees table.
  console.log(2)
  console.log(await db.query('employees').include('firstName', 'lastName').get().toObject())

  // 3. Select the FirstName and LastName columns from the Employees table.
  // Sort by LastName.
  console.log(3)
  await db.query('employees').include('firstName', 'lastName').sort('lastName').get().inspect()

  // 4. Create a report showing Northwind's orders sorted by Freight from most
  // expensive to cheapest.
  // Show OrderID, OrderDate, ShippedDate, CustomerID, and Freight.
  console.log(4)
  // TODO
  //await db.query('orders').include('orderDate', 'shippedDate' 'customer.id', 'freight').sort('', 'desc').get().inspect()
  //await db.query('orderDetails').groupBy('order').sort('order.freight').get().inspect()

  // 5. Create a report showing the title and the first and last name of all sales representatives.
  console.log(5)
  await db.query('employees').include('title', 'firstName', 'lastName').filter('title', '=', 'Sales Representative').get().inspect()

  // 6. Create a report showing the first and last names of all employees who have a region specified.
  console.log(6)
  console.log(await db.query('employees').include('firstName', 'lastName', 'region').filter('region', '!=', '').get().toObject())

  // 7. Create a report showing the first and last name of all employees whose last names start
  // with a letter in the last half of the alphabet.
  // Sort by LastName in descending order.
  // TODO
  //await db.query('employees').include('firstName', 'lastName').filter('lastName', 'startsWith', ??
  console.log(7)

  // 8. Create a report showing the title of courtesy and the first and last name of all employees
  // whose title of courtesy begins with "M".
  // TODO
  console.log(8)

  // 9. Create a report showing the first and last name of all sales representatives who are from
  // Seattle or Redmond.
  console.log(9)
  // TODO Impossible to OR
  console.log(await db.query('employees').include('firstName', 'lastName', 'title', 'city')
    .filter('title', '=', 'Sales Representative')
    .filter('region', '=', 'WA')
    .or((f) => {
      f.filter('city', '=', 'Seattle').or('city', '=', 'London')
    })
    .get().toObject())

  // 10. Create a report that shows the company name, contact title, city and country of all
  // customers in Mexico or in any city in Spain except Madrid.
  console.log(10)
  // TODO Impossible

  // 11. If the cost of freight is greater than or equal to $500.00, it will now be taxed by 10%.
  // Create a report that shows the order id, freight cost, freight cost with this tax for all orders of
  // $500 or more.
  console.log(11)
  // TODO not possible to aggregate and then filter

  // 12. Find the Total Number of Units Ordered of Product ID 3
  console.log(12)
  console.log(await db.query('orderDetails')
    .filter('product', '=', 3)
    .count()
    .get().toObject())

  // 13. Retrieve the number of employees in each city
  console.log(13)
  console.log(await db.query('employees')
    .groupBy('city')
    .count()
    .get().toObject())

  // 14. Find the number of sales representatives in each city that contains at least 2 sales
  // representatives. Order by the number of employees.
  // TODO Can't filter by the result

  // 15. Find the Companies (the CompanyName) that placed orders in 1997
  console.log(15)
  // TODO Needs by year filtering
  //console.log(await db.query('orders')
  //  .include('customer.companyName')
  //  .filter('orderDate', '=')
  //  .get().toObject())

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
  // The report should return the following 5 rows.

  // SELECT Orders.OrderID, Customers.CompanyName, Orders.OrderDate
  // FROM Orders
  // INNER JOIN Customers ON Orders.CustomerID=Customers.CustomerID;
  console.log('inner join')
  console.log(await db.query('orders').include('customer.companyName', 'orderDate').range(0, 10).get().toObject())

  // SELECT Customers.CompanyName, Orders.OrderID
  // FROM Customers
  // LEFT JOIN Orders
  // ON Customers.CustomerID=Orders.CustomerID
  // ORDER BY Customers.CompanyName;
  console.log('left join')
  //console.log(await db.query('customers').include('companyName', (q) => q('orders').filter('customerId' '=' ??)
  console.dir(await db.query('customers').include('companyName', (q) => q('orders').include('id')).sort('companyName').range(0, 5).get().toObject(), { depth: 10 })

  // Left join TODO

  // Full join TODO

  // Self join
  // SELECT A.CustomerName AS CustomerName1, B.CustomerName AS CustomerName2, A.City
  //   FROM Customers A, Customers B
  //   WHERE A.CustomerID <> B.CustomerID
  //   AND A.City = B.City
  //   ORDER BY A.City;

  // Union
  // SELECT 'Customer' AS Type, ContactName, City, Country
  // FROM Customers
  // UNION
  // SELECT 'Supplier', ContactName, City, Country
  // FROM Suppliers
  console.log('union')
  const unionA = await db.query('customers').include('contactName', 'city', 'country').range(0, 2).get().toObject()
  const unionB = await db.query('suppliers').include('contactName', 'city', 'country').range(0, 2).get().toObject()
  const union = [ ...unionA.map((r) => ({ type: 'customer', ...r })), ...unionB.map((r) => ({ type: 'supplier', ...r })) ]
  console.log(union)

  // union all
  // SELECT City, Country FROM Customers
  //   WHERE Country='Germany'
  //   UNION ALL
  //   SELECT City, Country FROM Suppliers
  //   WHERE Country='Germany'
  //   ORDER BY City;
  console.log('union all')
  const unionAllA = await db.query('customers').include('city', 'country').range(0, 3).get().toObject()
  const unionAllB = await db.query('suppliers').include('city', 'country').range(0, 3).get().toObject()
  const unionAll = [ ...unionA.map(({ city, country }) => ({ city, country })), ...unionB.map(({ city, country }) => ({ city, country })) ]
  console.log(unionAll)
})
