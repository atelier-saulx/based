import { BasedDb } from '../../src/db.js'
// import { mermaid } from '@based/schema-diagram'
import { deepCopy } from '../../src/utils/index.js'
import test from '../shared/test.js'
import createNorthwindDb, { defaultSchema } from '../shared/northwindDb.js'
import { deepEqual } from '../shared/assert.js'
import type { SchemaIn } from '../../src/schema/index.js'

await test('Basic SQL', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // 1. Retrieve all columns in the Region table.
  const r1 = await db.query('region').include('*').get()
  deepEqual(r1, [
    {
      id: 1,
      regionDescription: 'Eastern',
    },
    {
      id: 2,
      regionDescription: 'Western',
    },
    {
      id: 3,
      regionDescription: 'Northern',
    },
    {
      id: 4,
      regionDescription: 'Southern',
    },
  ])

  // 2. Select the FirstName and LastName columns from the Employees table.
  const r2 = await db.query('employees').include('firstName', 'lastName').get()
  deepEqual(r2, [
    { id: 1, lastName: 'Davolio', firstName: 'Nancy' },
    { id: 2, lastName: 'Fuller', firstName: 'Andrew' },
    { id: 3, lastName: 'Leverling', firstName: 'Janet' },
    { id: 4, lastName: 'Peacock', firstName: 'Margaret' },
    { id: 5, lastName: 'Buchanan', firstName: 'Steven' },
    { id: 6, lastName: 'Suyama', firstName: 'Michael' },
    { id: 7, lastName: 'King', firstName: 'Robert' },
    { id: 8, lastName: 'Callahan', firstName: 'Laura' },
    { id: 9, lastName: 'Dodsworth', firstName: 'Anne' },
  ])

  // 3. Select the FirstName and LastName columns from the Employees table.
  // Sort by LastName.
  const r3 = await db
    .query('employees')
    .include('firstName', 'lastName')
    .sort('lastName')
    .get()
  deepEqual(r3, [
    { id: 5, lastName: 'Buchanan', firstName: 'Steven' },
    { id: 8, lastName: 'Callahan', firstName: 'Laura' },
    { id: 1, lastName: 'Davolio', firstName: 'Nancy' },
    { id: 9, lastName: 'Dodsworth', firstName: 'Anne' },
    { id: 2, lastName: 'Fuller', firstName: 'Andrew' },
    { id: 7, lastName: 'King', firstName: 'Robert' },
    { id: 3, lastName: 'Leverling', firstName: 'Janet' },
    { id: 4, lastName: 'Peacock', firstName: 'Margaret' },
    { id: 6, lastName: 'Suyama', firstName: 'Michael' },
  ])

  // 4. Create a report showing Northwind's orders sorted by Freight from most
  // expensive to cheapest.
  // Show OrderId, OrderDate, ShippedDate, CustomerId, and Freight.
  const r4 = await db
    .query('orders')
    .include('orderDate', 'shippedDate', 'customer.id', 'freight')
    .sort('freight', 'desc')
    .range(0, 3)
    .get()
  deepEqual(r4, [
    {
      id: 10540,
      freight: 1007.64,
      shippedDate: 866160000000,
      orderDate: 864000000000,
      customer: { id: 63 },
    },
    {
      id: 10372,
      freight: 890.78,
      shippedDate: 850089600000,
      orderDate: 849657600000,
      customer: { id: 62 },
    },
    {
      id: 11030,
      freight: 830.75,
      shippedDate: 893635200000,
      orderDate: 892771200000,
      customer: { id: 71 },
    },
  ])

  // 5. Create a report showing the title and the first and last name of all sales representatives.
  const r5 = await db
    .query('employees')
    .include('title', 'firstName', 'lastName')
    .filter('title', '=', 'Sales Representative')
    .get()
  deepEqual(
    r5,
    [
      {
        id: 1,
        lastName: 'Davolio',
        firstName: 'Nancy',
        title: 'Sales Representative',
      },
      {
        id: 3,
        lastName: 'Leverling',
        firstName: 'Janet',
        title: 'Sales Representative',
      },
      {
        id: 4,
        lastName: 'Peacock',
        firstName: 'Margaret',
        title: 'Sales Representative',
      },
      {
        id: 6,
        lastName: 'Suyama',
        firstName: 'Michael',
        title: 'Sales Representative',
      },
      {
        id: 7,
        lastName: 'King',
        firstName: 'Robert',
        title: 'Sales Representative',
      },
      {
        id: 9,
        lastName: 'Dodsworth',
        firstName: 'Anne',
        title: 'Sales Representative',
      },
    ],
    '5. Create a report showing the title and the first and last name of all sales representatives',
  )

  // 6a. Create a report showing the first and last names of all employees who have a region specified.
  const r6a = await db
    .query('employees')
    .include('firstName', 'lastName', 'region')
    .filter('region', '!=', '')
    .get()
  deepEqual(
    r6a,
    [
      { id: 1, lastName: 'Davolio', firstName: 'Nancy', region: 'WA' },
      { id: 2, lastName: 'Fuller', firstName: 'Andrew', region: 'WA' },
      { id: 3, lastName: 'Leverling', firstName: 'Janet', region: 'WA' },
      { id: 4, lastName: 'Peacock', firstName: 'Margaret', region: 'WA' },
      { id: 8, lastName: 'Callahan', firstName: 'Laura', region: 'WA' },
    ],
    '6a. Create a report showing the first and last names of all employees who have a region specified.',
  )

  // 6b. Create a report showing the first and last names of all employees who don't have a region specified.
  const r6b = await db
    .query('employees')
    .include('firstName', 'lastName', 'region')
    .filter('region', '=', '')
    .get()
  deepEqual(
    r6b,
    [
      { id: 5, lastName: 'Buchanan', firstName: 'Steven', region: '' },
      { id: 6, lastName: 'Suyama', firstName: 'Michael', region: '' },
      { id: 7, lastName: 'King', firstName: 'Robert', region: '' },
      { id: 9, lastName: 'Dodsworth', firstName: 'Anne', region: '' },
    ],
    "6b. Create a report showing the first and last names of all employees who don't have a region specified.",
  )

  // 7. Create a report showing the first and last name of all employees whose last names start
  // with a letter in the last half of the alphabet.
  // Sort by LastName in descending order.
  // TODO
  // const r7 = await db.query('employees').include('firstName', 'lastName').filter('lastName', 'startsWith', ??

  // 8. Create a report showing the title of courtesy and the first and last name of all employees
  // whose title of courtesy begins with "M".
  // TODO

  // 9. Create a report showing the first and last name of all sales representatives who are from
  // Seattle or Redmond.
  // TODO Impossible to OR
  const r9 = await db
    .query('employees')
    .include('firstName', 'lastName', 'title', 'city', 'region')
    .filter('title', 'includes', 'Sales')
    .filter('region', '!=', '')
    .filter('city', '=', ['Seattle', 'Redmond'])
    .get()
  deepEqual(
    r9,
    [
      {
        id: 1,
        firstName: 'Nancy',
        lastName: 'Davolio',
        title: 'Sales Representative',
        city: 'Seattle',
        region: 'WA',
      },
      {
        id: 4,
        firstName: 'Margaret',
        lastName: 'Peacock',
        title: 'Sales Representative',
        city: 'Redmond',
        region: 'WA',
      },
      {
        id: 8,
        firstName: 'Laura',
        lastName: 'Callahan',
        title: 'Inside Sales Coordinator',
        city: 'Seattle',
        region: 'WA',
      },
    ],
    '9. Create a report showing the first and last name of all sales representatives who are from ( Seattle or Redmond.)',
  )

  // 10. Create a report that shows the company name, contact title, city and country of all
  // customers in Mexico or in any city in Spain except Madrid.
  // TODO Impossible
  const r10 = await db
    .query('customers')
    .include('companyName', 'contactTitle', 'city', 'country')
    //.filter('country', 'includes', ['Mexico', 'Spain'])
    .filter('country', 'includes', ['Mexico', 'Spain'])
    .filter('city', '!=', 'Madrid')
    .get()
  deepEqual(
    r10,
    [
      {
        id: 2,
        companyName: 'Ana Trujillo Emparedados y helados',
        contactTitle: 'Owner',
        city: 'México D.F.',
        country: 'Mexico',
      },
      {
        id: 3,
        companyName: 'Antonio Moreno Taquería',
        contactTitle: 'Owner',
        city: 'México D.F.',
        country: 'Mexico',
      },
      {
        id: 13,
        companyName: 'Centro comercial Moctezuma',
        contactTitle: 'Marketing Manager',
        city: 'México D.F.',
        country: 'Mexico',
      },
      {
        id: 29,
        companyName: 'Galería del gastrónomo',
        contactTitle: 'Marketing Manager',
        city: 'Barcelona',
        country: 'Spain',
      },
      {
        id: 30,
        companyName: 'Godos Cocina Típica',
        contactTitle: 'Sales Manager',
        city: 'Sevilla',
        country: 'Spain',
      },
      {
        id: 58,
        companyName: 'Pericles Comidas clásicas',
        contactTitle: 'Sales Representative',
        city: 'México D.F.',
        country: 'Mexico',
      },
      {
        id: 80,
        companyName: 'Tortuga Restaurante',
        contactTitle: 'Owner',
        city: 'México D.F.',
        country: 'Mexico',
      },
    ],
    '10. Create a report that shows the company name, contact title, city and country of all',
  )

  // 11. If the cost of freight is greater than or equal to $500.00, it will now be taxed by 10%.
  // Create a report that shows the order id, freight cost, freight cost with this tax for all orders of
  // $500 or more.
  // TODO not possible to aggregate and then filter

  // 12. Find the Total Number of Units Ordered of Product ID 3
  const r12 = await db
    .query('orderDetails')
    .filter('product', '=', 3)
    .count()
    .get()
  deepEqual(
    r12,
    { count: 12 },
    '12. Find the Total Number of Units Ordered of Product ID 3',
  )

  // 13. Retrieve the number of employees in each city
  const r13 = await db.query('employees').groupBy('city').count().get()
  deepEqual(
    r13,
    {
      Seattle: { count: 2 },
      Redmond: { count: 1 },
      London: { count: 4 },
      Kirkland: { count: 1 },
      Tacoma: { count: 1 },
    },
    '13. Retrieve the number of employees in each city',
  )

  // 14. Find the number of sales representatives in each city that contains at least 2 sales
  // representatives. Order by the number of employees.
  // TODO Can't filter by the result

  // 15. Find the Companies (the CompanyName) that placed orders in 1997
  const r15 = await db
    .query('orders')
    .include('orderDate', 'customer.companyName')
    .filter('orderDate', '..', [
      new Date('1997'),
      new Date(+new Date('1998') - 1),
    ])
    .sort('orderDate', 'asc')
    .range(0, 3)
    .get()
  deepEqual(
    r15,
    [
      {
        id: 10402,
        orderDate: 852163200000,
        customer: { id: 20, companyName: 'Ernst Handel' },
      },
      {
        id: 10404,
        orderDate: 852249600000,
        customer: { id: 49, companyName: 'Magazzini Alimentari Riuniti' },
      },
      {
        id: 10403,
        orderDate: 852249600000,
        customer: { id: 20, companyName: 'Ernst Handel' },
      },
    ],
    '15. Find the Companies (the CompanyName) that placed orders in 1997',
  )

  // 16. Create a report showing employee orders.
  // TODO

  // 17. Create a report showing the Order ID, the name of the company that placed the order,
  // and the first and last name of the associated employee.
  // Only show orders placed after January 1, 1998 that shipped after they were required.
  // Sort by Company Name.
  // TODO filter by field?
  const r17 = await db
    .query('orders')
    .include(
      'customer.companyName',
      'employee.firstName',
      'employee.lastName',
      'shippedDate',
      'orderDate',
      'requiredDate',
    )
    .filter('orderDate', '>=', new Date('1/1/1998 00:00+00'))
    .filter('shippedDate', '>', 'requiredDate')
    .sort('orderDate', 'asc')
    .range(0, 3)
    .get()
  deepEqual(
    r17,
    [
      {
        id: 10810,
        shippedDate: 884131200000,
        requiredDate: 886032000000,
        orderDate: 883612800000,
        customer: { id: 42, companyName: 'Laughing Bacchus Wine Cellars' },
        employee: { id: 2, lastName: 'Fuller', firstName: 'Andrew' },
      },
      {
        id: 10809,
        shippedDate: 884131200000,
        requiredDate: 886032000000,
        orderDate: 883612800000,
        customer: { id: 88, companyName: 'Wellington Importadora' },
        employee: { id: 7, lastName: 'King', firstName: 'Robert' },
      },
      {
        id: 10808,
        shippedDate: 884304000000,
        requiredDate: 886032000000,
        orderDate: 883612800000,
        customer: { id: 55, companyName: 'Old World Delicatessen' },
        employee: { id: 2, lastName: 'Fuller', firstName: 'Andrew' },
      },
    ],
    '17. Create a report showing the Order ID, the name of the company that placed the order',
  )

  // 18. Create a report that shows the total quantity of products (from the Order_Details table)
  // ordered. Only show records for products for which the quantity ordered is fewer than 200.
  // TODO

  // SELECT * FROM Customers
  // WHERE country='Mexico';
  const r19 = await db.query('customers').filter('country', '=', 'Mexico').get()
  deepEqual(
    r19,
    [
      {
        id: 2,
        companyName: 'Ana Trujillo Emparedados y helados',
        contactName: 'Ana Trujillo',
        contactTitle: 'Owner',
        address: 'Avda. de la Constitución 2222',
        city: 'México D.F.',
        region: '',
        postalCode: '05021',
        country: 'Mexico',
        phone: '(5) 555-4729',
        fax: '(5) 555-3745',
        customerId: 'ANATR',
      },
      {
        id: 3,
        companyName: 'Antonio Moreno Taquería',
        contactName: 'Antonio Moreno',
        contactTitle: 'Owner',
        address: 'Mataderos  2312',
        city: 'México D.F.',
        region: '',
        postalCode: '05023',
        country: 'Mexico',
        phone: '(5) 555-3932',
        fax: '',
        customerId: 'ANTON',
      },
      {
        id: 13,
        companyName: 'Centro comercial Moctezuma',
        contactName: 'Francisco Chang',
        contactTitle: 'Marketing Manager',
        address: 'Sierras de Granada 9993',
        city: 'México D.F.',
        region: '',
        postalCode: '05022',
        country: 'Mexico',
        phone: '(5) 555-3392',
        fax: '(5) 555-7293',
        customerId: 'CENTC',
      },
      {
        id: 58,
        companyName: 'Pericles Comidas clásicas',
        contactName: 'Guillermo Fernández',
        contactTitle: 'Sales Representative',
        address: 'Calle Dr. Jorge Cash 321',
        city: 'México D.F.',
        region: '',
        postalCode: '05033',
        country: 'Mexico',
        phone: '(5) 552-3745',
        fax: '(5) 545-3745',
        customerId: 'PERIC',
      },
      {
        id: 80,
        companyName: 'Tortuga Restaurante',
        contactName: 'Miguel Angel Paolino',
        contactTitle: 'Owner',
        address: 'Avda. Azteca 123',
        city: 'México D.F.',
        region: '',
        postalCode: '05033',
        country: 'Mexico',
        phone: '(5) 555-2933',
        fax: '',
        customerId: 'TORTU',
      },
    ],
    '18. Create a report that shows the total quantity of products (from the Order_Details table)',
  )

  // SELECT * FROM products ORDER BY price;
  const r20 = await db
    .query('products')
    .sort('unitPrice', 'desc')
    .range(0, 4)
    .get()
  deepEqual(
    r20,
    [
      {
        id: 38,
        unitPrice: 263.5,
        discontinued: 0,
        productName: 'Côte de Blaye',
        quantityPerUnit: '12 - 75 cl bottles',
        unitsInStock: 17,
        unitsOnOrder: 0,
        reorderLevel: 15,
      },
      {
        id: 29,
        unitPrice: 123.79,
        discontinued: 1,
        productName: 'Thüringer Rostbratwurst',
        quantityPerUnit: '50 bags x 30 sausgs.',
        unitsInStock: 0,
        unitsOnOrder: 0,
        reorderLevel: 0,
      },
      {
        id: 9,
        unitPrice: 97,
        discontinued: 1,
        productName: 'Mishi Kobe Niku',
        quantityPerUnit: '18 - 500 g pkgs.',
        unitsInStock: 29,
        unitsOnOrder: 0,
        reorderLevel: 0,
      },
      {
        id: 20,
        unitPrice: 81,
        discontinued: 0,
        productName: "Sir Rodney's Marmalade",
        quantityPerUnit: '30 gift boxes',
        unitsInStock: 40,
        unitsOnOrder: 0,
        reorderLevel: 0,
      },
    ],
    'SELECT * FROM products ORDER BY price;',
  )

  // SELECT * FROM products ORDER BY price;
  const r21 = await db
    .query('products')
    .sort('unitPrice', 'desc')
    .range(0, 3)
    .get()
  deepEqual(
    r21,
    [
      {
        id: 38,
        unitPrice: 263.5,
        discontinued: 0,
        productName: 'Côte de Blaye',
        quantityPerUnit: '12 - 75 cl bottles',
        unitsInStock: 17,
        unitsOnOrder: 0,
        reorderLevel: 15,
      },
      {
        id: 29,
        unitPrice: 123.79,
        discontinued: 1,
        productName: 'Thüringer Rostbratwurst',
        quantityPerUnit: '50 bags x 30 sausgs.',
        unitsInStock: 0,
        unitsOnOrder: 0,
        reorderLevel: 0,
      },
      {
        id: 9,
        unitPrice: 97,
        discontinued: 1,
        productName: 'Mishi Kobe Niku',
        quantityPerUnit: '18 - 500 g pkgs.',
        unitsInStock: 29,
        unitsOnOrder: 0,
        reorderLevel: 0,
      },
    ],
    'SELECT * FROM products ORDER BY price;',
  )

  // SELECT * FROM customers WHERE country IN ('Germany', 'France', 'UK');
  const r22 = await db
    .query('customers')
    .filter('country', '=', ['Germany', 'France', 'UK'])
    .range(0, 3)
    .get()
  deepEqual(
    r22,
    [
      {
        id: 1,
        companyName: 'Alfreds Futterkiste',
        contactName: 'Maria Anders',
        contactTitle: 'Sales Representative',
        address: 'Obere Str. 57',
        city: 'Berlin',
        region: '',
        postalCode: '12209',
        country: 'Germany',
        phone: '030-0074321',
        fax: '030-0076545',
        customerId: 'ALFKI',
      },
      {
        id: 4,
        companyName: 'Around the Horn',
        contactName: 'Thomas Hardy',
        contactTitle: 'Sales Representative',
        address: '120 Hanover Sq.',
        city: 'London',
        region: '',
        postalCode: 'WA1 1DP',
        country: 'UK',
        phone: '(171) 555-7788',
        fax: '(171) 555-6750',
        customerId: 'AROUT',
      },
      {
        id: 6,
        companyName: 'Blauer See Delikatessen',
        contactName: 'Hanna Moos',
        contactTitle: 'Sales Representative',
        address: 'Forsterstr. 57',
        city: 'Mannheim',
        region: '',
        postalCode: '68306',
        country: 'Germany',
        phone: '0621-08460',
        fax: '0621-08924',
        customerId: 'BLAUS',
      },
    ],
    "SELECT * FROM customers WHERE country IN ('Germany', 'France', 'UK')",
  )

  // SELECT * FROM products WHERE unitPrice BETWEEN 10 AND 20 ORDER BY price;
  const r23 = await db
    .query('products')
    .filter('unitPrice', '..', [10, 20])
    .sort('unitPrice', 'desc')
    .get()
  deepEqual(
    r23,
    [
      {
        id: 57,
        unitPrice: 19.5,
        discontinued: 0,
        productName: 'Ravioli Angelo',
        quantityPerUnit: '24 - 250 g pkgs.',
        unitsInStock: 36,
        unitsOnOrder: 0,
        reorderLevel: 20,
      },
      {
        id: 44,
        unitPrice: 19.45,
        discontinued: 0,
        productName: 'Gula Malacca',
        quantityPerUnit: '20 - 2 kg bags',
        unitsInStock: 27,
        unitsOnOrder: 0,
        reorderLevel: 15,
      },
      {
        id: 2,
        unitPrice: 19,
        discontinued: 1,
        productName: 'Chang',
        quantityPerUnit: '24 - 12 oz bottles',
        unitsInStock: 17,
        unitsOnOrder: 40,
        reorderLevel: 25,
      },
      {
        id: 36,
        unitPrice: 19,
        discontinued: 0,
        productName: 'Inlagd Sill',
        quantityPerUnit: '24 - 250 g  jars',
        unitsInStock: 112,
        unitsOnOrder: 0,
        reorderLevel: 20,
      },
      {
        id: 40,
        unitPrice: 18.4,
        discontinued: 0,
        productName: 'Boston Crab Meat',
        quantityPerUnit: '24 - 4 oz tins',
        unitsInStock: 123,
        unitsOnOrder: 0,
        reorderLevel: 30,
      },
      {
        id: 1,
        unitPrice: 18,
        discontinued: 1,
        productName: 'Chai',
        quantityPerUnit: '10 boxes x 30 bags',
        unitsInStock: 39,
        unitsOnOrder: 0,
        reorderLevel: 10,
      },
      {
        id: 35,
        unitPrice: 18,
        discontinued: 0,
        productName: 'Steeleye Stout',
        quantityPerUnit: '24 - 12 oz bottles',
        unitsInStock: 20,
        unitsOnOrder: 0,
        reorderLevel: 15,
      },
      {
        id: 39,
        unitPrice: 18,
        discontinued: 0,
        productName: 'Chartreuse verte',
        quantityPerUnit: '750 cc per bottle',
        unitsInStock: 69,
        unitsOnOrder: 0,
        reorderLevel: 5,
      },
      {
        id: 76,
        unitPrice: 18,
        discontinued: 0,
        productName: 'Lakkalikööri',
        quantityPerUnit: '500 ml',
        unitsInStock: 57,
        unitsOnOrder: 0,
        reorderLevel: 20,
      },
      {
        id: 16,
        unitPrice: 17.45,
        discontinued: 0,
        productName: 'Pavlova',
        quantityPerUnit: '32 - 500 g boxes',
        unitsInStock: 29,
        unitsOnOrder: 0,
        reorderLevel: 10,
      },
      {
        id: 66,
        unitPrice: 17,
        discontinued: 0,
        productName: 'Louisiana Hot Spiced Okra',
        quantityPerUnit: '24 - 8 oz jars',
        unitsInStock: 4,
        unitsOnOrder: 100,
        reorderLevel: 20,
      },
      {
        id: 50,
        unitPrice: 16.25,
        discontinued: 0,
        productName: 'Valkoinen suklaa',
        quantityPerUnit: '12 - 100 g bars',
        unitsInStock: 65,
        unitsOnOrder: 0,
        reorderLevel: 30,
      },
      {
        id: 70,
        unitPrice: 15,
        discontinued: 0,
        productName: 'Outback Lager',
        quantityPerUnit: '24 - 355 ml bottles',
        unitsInStock: 15,
        unitsOnOrder: 10,
        reorderLevel: 30,
      },
      {
        id: 73,
        unitPrice: 15,
        discontinued: 0,
        productName: 'Röd Kaviar',
        quantityPerUnit: '24 - 150 g jars',
        unitsInStock: 101,
        unitsOnOrder: 0,
        reorderLevel: 5,
      },
      {
        id: 25,
        unitPrice: 14,
        discontinued: 0,
        productName: 'NuNuCa Nuß-Nougat-Creme',
        quantityPerUnit: '20 - 450 g glasses',
        unitsInStock: 76,
        unitsOnOrder: 0,
        reorderLevel: 30,
      },
      {
        id: 34,
        unitPrice: 14,
        discontinued: 0,
        productName: 'Sasquatch Ale',
        quantityPerUnit: '24 - 12 oz bottles',
        unitsInStock: 111,
        unitsOnOrder: 0,
        reorderLevel: 15,
      },
      {
        id: 42,
        unitPrice: 14,
        discontinued: 1,
        productName: 'Singaporean Hokkien Fried Mee',
        quantityPerUnit: '32 - 1 kg pkgs.',
        unitsInStock: 26,
        unitsOnOrder: 0,
        reorderLevel: 0,
      },
      {
        id: 67,
        unitPrice: 14,
        discontinued: 0,
        productName: 'Laughing Lumberjack Lager',
        quantityPerUnit: '24 - 12 oz bottles',
        unitsInStock: 52,
        unitsOnOrder: 0,
        reorderLevel: 10,
      },
      {
        id: 58,
        unitPrice: 13.25,
        discontinued: 0,
        productName: 'Escargots de Bourgogne',
        quantityPerUnit: '24 pieces',
        unitsInStock: 62,
        unitsOnOrder: 0,
        reorderLevel: 20,
      },
      {
        id: 15,
        unitPrice: 13,
        discontinued: 0,
        productName: 'Genen Shouyu',
        quantityPerUnit: '24 - 250 ml bottles',
        unitsInStock: 39,
        unitsOnOrder: 0,
        reorderLevel: 5,
      },
      {
        id: 77,
        unitPrice: 13,
        discontinued: 0,
        productName: 'Original Frankfurter grüne Soße',
        quantityPerUnit: '12 boxes',
        unitsInStock: 32,
        unitsOnOrder: 0,
        reorderLevel: 15,
      },
      {
        id: 48,
        unitPrice: 12.75,
        discontinued: 0,
        productName: 'Chocolade',
        quantityPerUnit: '10 pkgs.',
        unitsInStock: 15,
        unitsOnOrder: 70,
        reorderLevel: 25,
      },
      {
        id: 31,
        unitPrice: 12.5,
        discontinued: 0,
        productName: 'Gorgonzola Telino',
        quantityPerUnit: '12 - 100 g pkgs',
        unitsInStock: 0,
        unitsOnOrder: 70,
        reorderLevel: 20,
      },
      {
        id: 68,
        unitPrice: 12.5,
        discontinued: 0,
        productName: 'Scottish Longbreads',
        quantityPerUnit: '10 boxes x 8 pieces',
        unitsInStock: 6,
        unitsOnOrder: 10,
        reorderLevel: 15,
      },
      {
        id: 46,
        unitPrice: 12,
        discontinued: 0,
        productName: 'Spegesild',
        quantityPerUnit: '4 - 450 g glasses',
        unitsInStock: 95,
        unitsOnOrder: 0,
        reorderLevel: 0,
      },
    ],
    'SELECT * FROM products WHERE unitPrice BETWEEN 10 AND 20 ORDER BY price;',
  )

  // SELECT customer_id AS ID, company_name AS customer FROM customers;
  const r24 = (
    await db.query('customers').include('companyName').get().toObject()
  ).map((r) => ({ id: r.id, customer: r.companyName }))
  deepEqual(
    r24,
    [
      { id: 1, customer: 'Alfreds Futterkiste' },
      { id: 2, customer: 'Ana Trujillo Emparedados y helados' },
      { id: 3, customer: 'Antonio Moreno Taquería' },
      { id: 4, customer: 'Around the Horn' },
      { id: 5, customer: 'Berglunds snabbköp' },
      { id: 6, customer: 'Blauer See Delikatessen' },
      { id: 7, customer: 'Blondesddsl père et fils' },
      { id: 8, customer: 'Bólido Comidas preparadas' },
      { id: 9, customer: "Bon app'" },
      { id: 10, customer: 'Bottom-Dollar Markets' },
      { id: 11, customer: "B's Beverages" },
      { id: 12, customer: 'Cactus Comidas para llevar' },
      { id: 13, customer: 'Centro comercial Moctezuma' },
      { id: 14, customer: 'Chop-suey Chinese' },
      { id: 15, customer: 'Comércio Mineiro' },
      { id: 16, customer: 'Consolidated Holdings' },
      { id: 17, customer: 'Drachenblut Delikatessen' },
      { id: 18, customer: 'Du monde entier' },
      { id: 19, customer: 'Eastern Connection' },
      { id: 20, customer: 'Ernst Handel' },
      { id: 21, customer: 'Familia Arquibaldo' },
      { id: 22, customer: 'FISSA Fabrica Inter. Salchichas S.A.' },
      { id: 23, customer: 'Folies gourmandes' },
      { id: 24, customer: 'Folk och fä HB' },
      { id: 25, customer: 'Frankenversand' },
      { id: 26, customer: 'France restauration' },
      { id: 27, customer: 'Franchi S.p.A.' },
      { id: 28, customer: 'Furia Bacalhau e Frutos do Mar' },
      { id: 29, customer: 'Galería del gastrónomo' },
      { id: 30, customer: 'Godos Cocina Típica' },
      { id: 31, customer: 'Gourmet Lanchonetes' },
      { id: 32, customer: 'Great Lakes Food Market' },
      { id: 33, customer: 'GROSELLA-Restaurante' },
      { id: 34, customer: 'Hanari Carnes' },
      { id: 35, customer: 'HILARION-Abastos' },
      { id: 36, customer: 'Hungry Coyote Import Store' },
      { id: 37, customer: 'Hungry Owl All-Night Grocers' },
      { id: 38, customer: 'Island Trading' },
      { id: 39, customer: 'Königlich Essen' },
      { id: 40, customer: "La corne d'abondance" },
      { id: 41, customer: "La maison d'Asie" },
      { id: 42, customer: 'Laughing Bacchus Wine Cellars' },
      { id: 43, customer: 'Lazy K Kountry Store' },
      { id: 44, customer: 'Lehmanns Marktstand' },
      { id: 45, customer: "Let's Stop N Shop" },
      { id: 46, customer: 'LILA-Supermercado' },
      { id: 47, customer: 'LINO-Delicateses' },
      { id: 48, customer: 'Lonesome Pine Restaurant' },
      { id: 49, customer: 'Magazzini Alimentari Riuniti' },
      { id: 50, customer: 'Maison Dewey' },
      { id: 51, customer: 'Mère Paillarde' },
      { id: 52, customer: 'Morgenstern Gesundkost' },
      { id: 53, customer: 'North/South' },
      { id: 54, customer: 'Océano Atlántico Ltda.' },
      { id: 55, customer: 'Old World Delicatessen' },
      { id: 56, customer: 'Ottilies Käseladen' },
      { id: 57, customer: 'Paris spécialités' },
      { id: 58, customer: 'Pericles Comidas clásicas' },
      { id: 59, customer: 'Piccolo und mehr' },
      { id: 60, customer: 'Princesa Isabel Vinhos' },
      { id: 61, customer: 'Que Delícia' },
      { id: 62, customer: 'Queen Cozinha' },
      { id: 63, customer: 'QUICK-Stop' },
      { id: 64, customer: 'Rancho grande' },
      { id: 65, customer: 'Rattlesnake Canyon Grocery' },
      { id: 66, customer: 'Reggiani Caseifici' },
      { id: 67, customer: 'Ricardo Adocicados' },
      { id: 68, customer: 'Richter Supermarkt' },
      { id: 69, customer: 'Romero y tomillo' },
      { id: 70, customer: 'Santé Gourmet' },
      { id: 71, customer: 'Save-a-lot Markets' },
      { id: 72, customer: 'Seven Seas Imports' },
      { id: 73, customer: 'Simons bistro' },
      { id: 74, customer: 'Spécialités du monde' },
      { id: 75, customer: 'Split Rail Beer & Ale' },
      { id: 76, customer: 'Suprêmes délices' },
      { id: 77, customer: 'The Big Cheese' },
      { id: 78, customer: 'The Cracker Box' },
      { id: 79, customer: 'Toms Spezialitäten' },
      { id: 80, customer: 'Tortuga Restaurante' },
      { id: 81, customer: 'Tradição Hipermercados' },
      { id: 82, customer: "Trail's Head Gourmet Provisioners" },
      { id: 83, customer: 'Vaffeljernet' },
      { id: 84, customer: 'Victuailles en stock' },
      { id: 85, customer: 'Vins et alcools Chevalier' },
      { id: 86, customer: 'Die Wandernde Kuh' },
      { id: 87, customer: 'Wartian Herkku' },
      { id: 88, customer: 'Wellington Importadora' },
      { id: 89, customer: 'White Clover Markets' },
      { id: 90, customer: 'Wilman Kala' },
      { id: 91, customer: 'Wolski  Zajazd' },
    ],
    'SELECT customer_id AS ID, company_name AS customer FROM customers;',
  )

  // Union
  // SELECT 'customer' AS Type, contact_name, city, country
  // FROM customers
  // UNION
  // SELECT 'supplier', contact_name, city, country
  // FROM Suppliers
  const r25unionA = await db
    .query('customers')
    .include('contactName', 'city', 'country')
    .range(0, 2)
    .get()
    .toObject()
  const r25unionB = await db
    .query('suppliers')
    .include('contactName', 'city', 'country')
    .range(0, 2)
    .get()
    .toObject()
  const r25union = [
    ...r25unionA.map((r) => ({ type: 'customer', ...r })),
    ...r25unionB.map((r) => ({ type: 'supplier', ...r })),
  ]
  deepEqual(
    r25union,
    [
      {
        type: 'customer',
        id: 1,
        contactName: 'Maria Anders',
        city: 'Berlin',
        country: 'Germany',
      },
      {
        type: 'customer',
        id: 2,
        contactName: 'Ana Trujillo',
        city: 'México D.F.',
        country: 'Mexico',
      },
      {
        type: 'supplier',
        id: 1,
        contactName: 'Charlotte Cooper',
        city: 'London',
        country: 'UK',
      },
      {
        type: 'supplier',
        id: 2,
        contactName: 'Shelley Burke',
        city: 'New Orleans',
        country: 'USA',
      },
    ],
    'Union',
  )

  // union all
  // SELECT City, Country FROM Customers
  // WHERE Country='Germany'
  // UNION ALL
  // SELECT City, Country FROM Suppliers
  // WHERE Country='Germany'
  // ORDER BY City;
  const r26unionAllA = await db
    .query('customers')
    .include('city', 'country')
    .range(0, 3)
    .get()
    .toObject()
  const r26unionAllB = await db
    .query('suppliers')
    .include('city', 'country')
    .range(0, 3)
    .get()
    .toObject()
  const r26unionAll = [
    ...r26unionAllA.map(({ city, country }) => ({ city, country })),
    ...r26unionAllB.map(({ city, country }) => ({ city, country })),
  ].sort((a, b) => a.city.localeCompare(b.city))
  deepEqual(
    r26unionAll,
    [
      { city: 'Ann Arbor', country: 'USA' },
      { city: 'Berlin', country: 'Germany' },
      { city: 'London', country: 'UK' },
      { city: 'México D.F.', country: 'Mexico' },
      { city: 'México D.F.', country: 'Mexico' },
      { city: 'New Orleans', country: 'USA' },
    ],
    'union all',
  )
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
  const newCustId = await db.create('customers', {
    companyName: 'Cardinal',
    contactName: 'Tom B. Erichsen',
    address: 'Skagen 21',
    city: 'Stavanger',
    postalCode: '4006',
    country: 'Norway',
  })

  deepEqual(
    await db
      .query('customers')
      .include('*')
      .filter('companyName', '=', 'Cardinal')
      .get(),
    [
      {
        id: newCustId,
        companyName: 'Cardinal',
        contactName: 'Tom B. Erichsen',
        contactTitle: '',
        address: 'Skagen 21',
        city: 'Stavanger',
        region: '',
        postalCode: '4006',
        country: 'Norway',
        phone: '',
        fax: '',
        customerId: '',
      },
    ],
  )

  // UPDATE customers
  // SET contact_name = 'Haakon Christensen'
  // WHERE CustomerID = 1;
  db.update('customers', newCustId, {
    contactName: 'Haakon Christensen',
  })

  deepEqual(
    await db
      .query('customers')
      .include('*')
      .filter('companyName', '=', 'Cardinal')
      .get(),
    [
      {
        id: newCustId,
        companyName: 'Cardinal',
        contactName: 'Haakon Christensen',
        contactTitle: '',
        address: 'Skagen 21',
        city: 'Stavanger',
        region: '',
        postalCode: '4006',
        country: 'Norway',
        phone: '',
        fax: '',
        customerId: '',
      },
    ],
  )

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

  deepEqual(
    await db
      .query('customers')
      .include('*')
      .filter('companyName', '=', 'Cardinal')
      .get(),
    [],
  )
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
  deepEqual(
    await db
      .query('orders')
      .include('customer.companyName', 'orderDate')
      .range(0, 10)
      .get(),
    [
      {
        id: 10248,
        orderDate: 836438400000,
        customer: { id: 85, companyName: 'Vins et alcools Chevalier' },
      },
      {
        id: 10249,
        orderDate: 836524800000,
        customer: { id: 79, companyName: 'Toms Spezialitäten' },
      },
      {
        id: 10250,
        orderDate: 836784000000,
        customer: { id: 34, companyName: 'Hanari Carnes' },
      },
      {
        id: 10251,
        orderDate: 836784000000,
        customer: { id: 84, companyName: 'Victuailles en stock' },
      },
      {
        id: 10252,
        orderDate: 836870400000,
        customer: { id: 76, companyName: 'Suprêmes délices' },
      },
      {
        id: 10253,
        orderDate: 836956800000,
        customer: { id: 34, companyName: 'Hanari Carnes' },
      },
      {
        id: 10254,
        orderDate: 837043200000,
        customer: { id: 14, companyName: 'Chop-suey Chinese' },
      },
      {
        id: 10255,
        orderDate: 837129600000,
        customer: { id: 68, companyName: 'Richter Supermarkt' },
      },
      {
        id: 10256,
        orderDate: 837388800000,
        customer: { id: 88, companyName: 'Wellington Importadora' },
      },
      {
        id: 10257,
        orderDate: 837475200000,
        customer: { id: 35, companyName: 'HILARION-Abastos' },
      },
    ],
  )
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
  deepEqual(
    await db
      .query('customers')
      .include('companyName', (q) => q('orders').include('id'))
      .sort('companyName')
      .range(0, 5)
      .get(),
    [
      {
        id: 1,
        companyName: 'Alfreds Futterkiste',
        orders: [
          { id: 10643 },
          { id: 10692 },
          { id: 10702 },
          { id: 10835 },
          { id: 10952 },
          { id: 11011 },
        ],
      },
      {
        id: 2,
        companyName: 'Ana Trujillo Emparedados y helados',
        orders: [{ id: 10308 }, { id: 10625 }, { id: 10759 }, { id: 10926 }],
      },
      {
        id: 3,
        companyName: 'Antonio Moreno Taquería',
        orders: [
          { id: 10365 },
          { id: 10507 },
          { id: 10535 },
          { id: 10573 },
          { id: 10677 },
          { id: 10682 },
          { id: 10856 },
        ],
      },
      {
        id: 4,
        companyName: 'Around the Horn',
        orders: [
          { id: 10355 },
          { id: 10383 },
          { id: 10453 },
          { id: 10558 },
          { id: 10707 },
          { id: 10741 },
          { id: 10743 },
          { id: 10768 },
          { id: 10793 },
          { id: 10864 },
          { id: 10920 },
          { id: 10953 },
          { id: 11016 },
        ],
      },
      {
        id: 11,
        companyName: "B's Beverages",
        orders: [
          { id: 10289 },
          { id: 10471 },
          { id: 10484 },
          { id: 10538 },
          { id: 10539 },
          { id: 10578 },
          { id: 10599 },
          { id: 10943 },
          { id: 10947 },
          { id: 11023 },
        ],
      },
    ],
  )
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

  db.delete(
    'customers',
    (await db.query('customers', { customerId: 'WELLI' }).get()).id!,
  )

  // Delete orders by WANDK
  const wandk = await db.query('customers', { customerId: 'WANDK' }).get()
  const wandkOrders = await db
    .query('orders')
    .filter('customer', '=', wandk)
    .get()
  for (const order of wandkOrders) {
    db.delete('orders', order.id)
  }

  // SELECT customers.company_name, orders.order_id
  // FROM customers
  // FULL OUTER JOIN orders ON customers.customer_id=orders.customer_id
  // ORDER BY customers.company_name;

  const customers = await db.query('customers').get().toObject()
  const orders = await db
    .query('orders')
    .include('customer.id')
    .get()
    .toObject()
  const result: any[] = []

  // LEFT JOIN: Customers with Orders
  customers.forEach((customer) => {
    const matchingOrders = orders.filter(
      (order) => order?.customer?.id === customer.id,
    )
    if (matchingOrders.length > 0) {
      matchingOrders.forEach((order) => {
        result.push({
          companyName: customer.companyName,
          OrderId: order.id,
        })
      })
    } else {
      result.push({
        companyName: customer.companyName,
        orderId: null,
      })
    }
  })

  // RIGHT JOIN: Orders with no matching Customers
  orders.forEach((order) => {
    const customer = customers.find((c) => c.id === order.customer?.id)
    if (!customer) {
      result.push({
        companyName: null,
        orderId: order.id,
      })
    }
  })

  // Sort by companyName
  result.sort((a, b) => {
    if (a.companyName === null) return 1
    if (b.companyName === null) return -1
    return a.companyName.localeCompare(b.companyName)
  })

  deepEqual(result.length, 823)
  deepEqual(result.slice(0, 3), [
    { companyName: 'Alfreds Futterkiste', OrderId: 10643 },
    { companyName: 'Alfreds Futterkiste', OrderId: 10692 },
    { companyName: 'Alfreds Futterkiste', OrderId: 10702 },
  ])
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
  const result: any[] = []
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

  deepEqual(result.length, 88)
  // TODO Something breaks with unicode here
  //deepEqual(result, [{"customerA":"ANATR","customerB":"ANTON","city":"México D.F."},{"customerA":"ANATR","customerB":"CENTC","city":"México D.F."},{"customerA":"ANATR","customerB":"PERIC","city":"México D.F."},{"customerA":"ANATR","customerB":"TORTU","city":"México D.F."},{"customerA":"ANTON","customerB":"ANATR","city":"México D.F."},{"customerA":"ANTON","customerB":"CENTC","city":"México D.F."},{"customerA":"ANTON","customerB":"PERIC","city":"México D.F."},{"customerA":"ANTON","customerB":"TORTU","city":"México D.F."},{"customerA":"AROUT","customerB":"BSBEV","city":"London"},{"customerA":"AROUT","customerB":"CONSH","city":"London"},{"customerA":"AROUT","customerB":"EASTC","city":"London"},{"customerA":"AROUT","customerB":"NORTS","city":"London"},{"customerA":"AROUT","customerB":"SEVES","city":"London"},{"customerA":"BOLID","customerB":"FISSA","city":"Madrid"},{"customerA":"BOLID","customerB":"ROMEY","city":"Madrid"},{"customerA":"BSBEV","customerB":"AROUT","city":"London"},{"customerA":"BSBEV","customerB":"CONSH","city":"London"},{"customerA":"BSBEV","customerB":"EASTC","city":"London"},{"customerA":"BSBEV","customerB":"NORTS","city":"London"},{"customerA":"BSBEV","customerB":"SEVES","city":"London"},{"customerA":"CACTU","customerB":"OCEAN","city":"Buenos Aires"},{"customerA":"CACTU","customerB":"RANCH","city":"Buenos Aires"},{"customerA":"CENTC","customerB":"ANATR","city":"México D.F."},{"customerA":"CENTC","customerB":"ANTON","city":"México D.F."},{"customerA":"CENTC","customerB":"PERIC","city":"México D.F."},{"customerA":"CENTC","customerB":"TORTU","city":"México D.F."},{"customerA":"COMMI","customerB":"FAMIA","city":"Sao Paulo"},{"customerA":"COMMI","customerB":"QUEEN","city":"Sao Paulo"},{"customerA":"COMMI","customerB":"TRADH","city":"Sao Paulo"},{"customerA":"CONSH","customerB":"AROUT","city":"London"},{"customerA":"CONSH","customerB":"BSBEV","city":"London"},{"customerA":"CONSH","customerB":"EASTC","city":"London"},{"customerA":"CONSH","customerB":"NORTS","city":"London"},{"customerA":"CONSH","customerB":"SEVES","city":"London"},{"customerA":"DUMON","customerB":"FRANR","city":"Nantes"},{"customerA":"EASTC","customerB":"AROUT","city":"London"},{"customerA":"EASTC","customerB":"BSBEV","city":"London"},{"customerA":"EASTC","customerB":"CONSH","city":"London"},{"customerA":"EASTC","customerB":"NORTS","city":"London"},{"customerA":"EASTC","customerB":"SEVES","city":"London"},{"customerA":"FAMIA","customerB":"COMMI","city":"Sao Paulo"},{"customerA":"FAMIA","customerB":"QUEEN","city":"Sao Paulo"},{"customerA":"FAMIA","customerB":"TRADH","city":"Sao Paulo"},{"customerA":"FISSA","customerB":"BOLID","city":"Madrid"},{"customerA":"FISSA","customerB":"ROMEY","city":"Madrid"},{"customerA":"FRANR","customerB":"DUMON","city":"Nantes"},{"customerA":"FURIB","customerB":"PRINI","city":"Lisboa"},{"customerA":"HANAR","customerB":"QUEDE","city":"Rio de Janeiro"},{"customerA":"HANAR","customerB":"RICAR","city":"Rio de Janeiro"},{"customerA":"LONEP","customerB":"THEBI","city":"Portland"},{"customerA":"NORTS","customerAmerB":"EASTC","city":"London"},{"customerA":"NORTS","customerB":"SEVES","city":"London"},{"customerA":"OCEAN","customerB":"CACTU","city":"Buenos Aires"},{"customerA":"OCEAN","customerB":"RANCH","city":"Buenos Aires"},{"customerA":"PARIS","customerB":"SPECD","city":"Paris"},{"customerA":"PERIC","customerB":"ANATR","city":"México D.F."},{"customerA":"PERIC","customerB":"ANTON","city":"México D.F."},{"customerA":"PERIC","customerB":"CENTC","city":"México D.F."},{"customerA":"PERIC","customerB":"TORTU","city":"México D.F."},{"customerA":"PRINI","customerB":"FURIB","city":"Lisboa"},{"customerA":"QUEDE","customerB":"HANAR","city":"Rio de Janeiro"},{"customerA":"QUEDE","customerB":"RICAR","city":"Rio de Janeiro"},{"customerA":"QUEEN","customerB":"COMMI","city":"Sao Paulo"},{"customerA":"QUEEN","customerB":"FAMIA","city":"Sao Paulo"},{"customerA":"QUEEN","customerB":"TRADH","city":"Sao Paulo"},{"customerA":"RANCH","customerB":"CACTU","city":"Buenos Aires"},{"customerA":"RANCH","customerB":"OCEAN","city":"Buenos Aires"},{"customerA":"RICAR","customerB":"HANAR","city":"Rio de Janeiro"},{"customerA":"RICAR","customerB":"QUEDE","city":"Rio de Janeiro"},{"customerA":"ROMEY","customerB":"BOLID","city":"Madrid"},{"customerA":"ROMEY","customerB":"FISSA","city":"Madrid"},{"customerA":"SEVES","customerB":"AROUT","city":"London"},{"customerA":"SEVES","customerB":"BSBEV","city":"London"},{"customerA":"SEVES","customerB":"CONSH","city":"London"},{"customerA":"SEVES","customerB":"EASTC","city":"London"},{"customerA":"SEVES","customerB":"NORTS","city":"London"},{"customerA":"SPECD","customerB":"PARIS","city":"Paris"},{"customerA":"THEBI","customerB":"LONEP","city":"Portland"},{"customerA":"TORTU","customerB":"ANATR","city":"México D.F."},{"customerA":"TORTU","customerB":"ANTON","city":"México D.F."},{"customerA":"TORTU","customerB":"CENTC","city":"México D.F."},{"customerA":"TORTU","customerB":"PERIC","city":"México D.F."},{"customerA":"TRADH","customerB":"COMMI","city":"Sao Paulo"},{"customerA":"TRADH","customerB":"FAMIA","city":"Sao Paulo"},{"customerA":"TRADH","customerB":"QUEEN","city":"Sao Paulo"}])
})

await test('aggregates', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await createNorthwindDb(db)

  // min
  // SELECT MIN(unit_price)
  // FROM products;
  deepEqual(await db.query('products').min('unitPrice').get(), {
    unitPrice: { min: 2.5 },
  })

  // min group by
  // SELECT MIN(unit_price) AS SmallestPrice, category_id
  // FROM products
  // GROUP BY category_id;
  deepEqual(
    await db.query('products').min('unitPrice').groupBy('category').get(),
    {
      '1': { unitPrice: { min: 4.5 } },
      '2': { unitPrice: { min: 10 } },
      '3': { unitPrice: { min: 9.2 } },
      '4': { unitPrice: { min: 2.5 } },
      '5': { unitPrice: { min: 7 } },
      '6': { unitPrice: { min: 7.45 } },
      '7': { unitPrice: { min: 10 } },
      '8': { unitPrice: { min: 6 } },
    },
  )

  // max
  // SELECT MAX(unit_price)
  // FROM products;
  deepEqual(await db.query('products').max('unitPrice').get(), {
    unitPrice: { max: 263.5 },
  })

  // count
  // SELECT COUNT(*)
  // FROM products;
  deepEqual(await db.query('products').count().get(), { count: 77 })

  // count group by
  // SELECT COUNT(*) AS [number of products], category_id
  // FROM products
  // GROUP BY category_id;
  deepEqual(await db.query('products').count().groupBy('category').get(), {
    '1': { count: 12 },
    '2': { count: 12 },
    '3': { count: 13 },
    '4': { count: 10 },
    '5': { count: 7 },
    '6': { count: 6 },
    '7': { count: 5 },
    '8': { count: 12 },
  })

  // sum
  // SELECT SUM(quantity)
  // FROM order_details;
  deepEqual(await db.query('orderDetails').sum('quantity').get(), {
    quantity: { sum: 51317 },
  })

  // sum where
  // SELECT SUM(quantity)
  // FROM order_details
  // WHERE product_id = 11;
  deepEqual(
    await db
      .query('orderDetails')
      .sum('quantity')
      .filter('product.id', '=', 11)
      .get(),
    { quantity: { sum: 706 } },
  )

  // sum group by
  // SELECT order_id, SUM(quantity) AS [Total Quantity]
  // FROM order_details
  // GROUP BY order_id;
  deepEqual(
    await db
      .query('orderDetails')
      .sum('quantity')
      .groupBy('order')
      .range(0, 10)
      .get(),
    {
      '10248': { quantity: { sum: 27 } },
      '10249': { quantity: { sum: 49 } },
      '10250': { quantity: { sum: 60 } },
      '10251': { quantity: { sum: 41 } },
      '10252': { quantity: { sum: 105 } },
      '10253': { quantity: { sum: 102 } },
      '10254': { quantity: { sum: 57 } },
      '10255': { quantity: { sum: 110 } },
      '10256': { quantity: { sum: 27 } },
      '10257': { quantity: { sum: 25 } },
    },
  )

  // avg
  // SELECT AVG(unit_price)
  // FROM products;
  deepEqual(await db.query('products').avg('unitPrice').get(), {
    unitPrice: { average: 28.833896103896105 },
  })

  // avg where
  // SELECT AVG(unit_price)
  // FROM products
  // WHERE category_id = 1;
  deepEqual(
    await db
      .query('products')
      .avg('unitPrice')
      .filter('category.id', '=', 1)
      .get(),
    { unitPrice: { average: 37.979166666666664 } },
  )

  // avg group by
  // SELECT AVG(unit_price) AS AveragePrice, category_id
  // FROM products
  // GROUP BY category_id;
  deepEqual(
    await db.query('products').avg('unitPrice').groupBy('category').get(),
    {
      '1': { unitPrice: { average: 37.979166666666664 } },
      '2': { unitPrice: { average: 22.854166666666668 } },
      '3': { unitPrice: { average: 25.16 } },
      '4': { unitPrice: { average: 28.73 } },
      '5': { unitPrice: { average: 20.25 } },
      '6': { unitPrice: { average: 54.00666666666667 } },
      '7': { unitPrice: { average: 32.37 } },
      '8': { unitPrice: { average: 20.6825 } },
    },
  )
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
  await createNorthwindDb(db, schema as SchemaIn)

  // SELECT Avg(unit_price * discount) AS [Average discount] FROM [order_details];
  deepEqual(await db.query('orderDetails').avg('discountAmount').get(), {
    discountAmount: { average: 1.4448364269141538 },
  })
})

await test.skip('mermaid', async (t) => {
  // @ts-ignore
  console.log(mermaid(db.client.schema))
})
