# Customers Module – Endpoints Documentation

## 📦 Módulo

**customers**

* **Base URL:** `/customers`
* **Autenticación:** Requerida

  * `@Auth()`
  * `@Features('orders')`
* **Comunicación:**

  * Todos los endpoints envían `internalToken` al microservicio correspondiente

---

## 🔹 Endpoints Principales

---

## 1️⃣ Crear Cliente

**POST** `/customers/save`

* **Autenticación:** ✅ Requerida
* **Body:** `CreateCustomerDto`

### 📥 Request Body

```json
{
  "idTypeId": 1,
  "idNumber": "0101234567",
  "firstName": "Juan",
  "lastName": "Pérez",
  "birthDate": "1990-05-15",
  "genderId": 1,
  "contacts": [
    {
      "contactTypeId": 1,
      "value": "0998765432",
      "isPrimary": true
    },
    {
      "contactTypeId": 2,
      "value": "juan@example.com",
      "isPrimary": false
    }
  ],
  "addresses": [
    {
      "cityId": 45,
      "zone": "El Vecino",
      "sector": "Centro",
      "locality": "Cuenca",
      "mainStreet": "Av. España",
      "secondaryStreet": "y Av. Américas",
      "reference": "Frente al parque",
      "postalCode": "010101"
    }
  ]
}
```

---

## 2️⃣ Actualizar Cliente

**POST** `/customers/update`

* **Autenticación:** ✅ Requerida
* **Body:**

  * `id` → ID del cliente
  * `data` → Campos a actualizar

### 📥 Request Body

```json
{
  "id": 123,
  "data": {
    "firstName": "Juan Carlos",
    "lastName": "Pérez Gómez",
    "birthDate": "1990-05-20",
    "genderId": 2,
    "contacts": [
      {
        "id": 45,
        "contactTypeId": 1,
        "value": "0987654321",
        "isPrimary": true
      },
      {
        "contactTypeId": 2,
        "value": "nuevo@email.com"
      }
    ],
    "addresses": [
      {
        "id": 10,
        "cityId": 45,
        "zone": "Centro",
        "mainStreet": "Av. Loja"
      }
    ]
  }
}
```

📌 **Nota:**

* Para editar contactos o direcciones existentes es obligatorio enviar su `id`.
* Si no se envía `id`, se crea un nuevo registro.

---

## 3️⃣ Buscar / Listar Clientes (Paginado)

**POST** `/customers/list`

* **Autenticación:** ✅ Requerida
* **Permiso especial:** Grupo `CASHIERS`
* **Body:** `SearchCustomersDto`

### 📥 Request Body

```json
{
  "page": 1,
  "limit": 20,
  "search": "juan"
}
```

🔍 **Búsqueda por:**

* Nombre
* Apellido
* Cédula / RUC
* Otros campos identificables del cliente

---

## 4️⃣ Crear Datos de Facturación (Billing)

**POST** `/customers/billing/create`

* **Autenticación:** ✅ Requerida
* **Body:** `CreateBillingDto`

### 📥 Request Body

```json
{
  "customerId": 123,
  "businessName": "Mi Empresa CIA. LTDA.",
  "identification": "0998765432001",
  "identificationTypeId": 2,
  "billingAddress": "Av. Principal 4-56",
  "billingPhone": "072345678",
  "billingEmail": "facturas@miempresa.com"
}
```

---

## 5️⃣ Actualizar Datos de Facturación

**POST** `/customers/billing/update`

* **Autenticación:** ✅ Requerida
* **Body:**

  * `id` → ID del registro de facturación
  * `data` → Campos a actualizar

### 📥 Request Body

```json
{
  "id": 67,
  "data": {
    "businessName": "Nueva Razón Social",
    "identification": "0998765432001",
    "billingEmail": "nuevo@facturas.com"
  }
}
```

---

## 📘 Notas Generales

* Todos los endpoints:

  * Requieren autenticación
  * Envían `internalToken` al microservicio
* Fechas deben enviarse en formato **ISO 8601**
* Campos no enviados en `update` **no se modifican**

---

 
