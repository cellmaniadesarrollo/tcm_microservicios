# Orders Module – Endpoints Documentation

## 📦 Módulo

**orders**

* **Base URL:** `/orders`
* **Autenticación:** Requerida

  * `@Auth()`
  * `@Features('orders')`
* **Microservicio:** `ORDER_SERVICE`

---

## 🔹 Endpoints Principales

---

## 1️⃣ Crear Orden (Caja / Cajeros)

**POST** `/orders/create`

* **Grupo requerido:** `CASHIERS`
* **Body:** `CreateOrderGatewayDto`

### 📥 Request Body

```json
{
  "order_type_id": 1,
  "order_priority_id": 2,
  "customer_id": 145,
  "device_id": 78,
  "previous_order_id": 56,
  "technician_ids": ["uuid-tecnico-1", "uuid-tecnico-2"],
  "detalleIngreso": "No enciende, pantalla rota",
  "patron": "1234",
  "password": "abc123",
  "revisadoAntes": false,
  "estimated_price": 45.50
}
```

📌 **Notas:**

* `device_id` es opcional si el dispositivo se crea posteriormente.
* `previous_order_id` se usa para **reingresos**.
* `technician_ids` permite asignar uno o varios técnicos.

---

## 2️⃣ Listar Órdenes (Todas)

**POST** `/orders/list`

* **Body:** `ListOrdersGatewayDto`

### 📥 Request Body

```json
{
  "page": 1,
  "limit": 20,
  "search": "juan",
  "orderTypeId": 0,
  "orderStatusId": 0
}
```

📌 **Notas:**

* `0` indica **todos** los tipos o estados.
* Búsqueda por cliente, número de orden u otros campos relevantes.

---

## 3️⃣ Mis Órdenes (Técnicos)

**POST** `/orders/my-orders`

* **Descripción:** Lista únicamente las órdenes asignadas al técnico autenticado.
* **Body:** Igual a `/orders/list`

---

## 4️⃣ Ver Detalle Completo de una Orden

**POST** `/orders/find-one-order`

### 📥 Request Body

```json
{
  "orderId": 342
}
```

📌 Retorna:

* Datos generales de la orden
* Cliente
* Dispositivo
* Hallazgos
* Procedimientos
* Estados históricos

---

## 5️⃣ Cambiar Estado de Orden

**POST** `/orders/change-order-status`

* **Body:** `ChangeOrderStatusGatewayDto`

### 📥 Request Body

```json
{
  "orderId": 342,
  "toStatusId": 5,
  "observation": "Reparación finalizada, pendiente de retiro"
}
```

📌 **Notas:**

* `observation` es opcional.
* El flujo de estados puede estar validado por reglas de negocio.

---

## 6️⃣ Agregar Hallazgo / Falla a la Orden

**POST** `/orders/add-finding`

### 📥 Request Body

```json
{
  "orderId": 342,
  "title": "Pantalla LCD dañada",
  "description": "Fisuras visibles en la esquina superior derecha..."
}
```

📌 Un hallazgo puede tener múltiples procedimientos asociados.

---

## 7️⃣ Agregar Procedimiento / Acción Realizada

**POST** `/orders/add-procedure`

### 📥 Request Body

```json
{
  "findingId": 89,
  "description": "Reemplazo de LCD original + calibración táctil",
  "is_public": true,
  "time_spent_minutes": 45,
  "procedure_cost": 35.00,
  "warranty_days": 30,
  "requires_followup": false,
  "followup_notes": ""
}
```

📌 **Notas:**

* `is_public` indica si el procedimiento es visible para el cliente.
* Puede generar costos y garantía.

---

## 🖥️ Gestión de Dispositivos

---

## 8️⃣ Crear Dispositivo

**POST** `/orders/create-device`

* **Body:** `CreateDeviceDto`

### 📥 Request Body

```json
{
  "serial_number": "ABC123XYZ",
  "color": "Negro",
  "storage": "128GB",
  "models_id": 17,
  "device_type_id": 3,
  "imeis": [
    { "imei_number": "350123456789012" },
    { "imei_number": "350123456789020" }
  ],
  "accounts": [
    { "username": "usuario@gmail.com", "password": "123456", "account_type": "Google" },
    { "username": "appleid@icloud.com", "account_type": "Apple ID" }
  ]
}
```

---

## 9️⃣ Buscar Dispositivo por IMEI

**POST** `/orders/search-imei`

### 📥 Request Body

```json
{
  "imei": "350123"
}
```

---

## 🔟 Obtener Dispositivo por ID

**POST** `/orders/device/get-by-id`

### 📥 Request Body

```json
{
  "deviceId": 89
}
```

---

## 1️⃣1️⃣ Actualizar Dispositivo

**POST** `/orders/device/update`

* **Body:** `UpdateDeviceGatewayDto`

### 📥 Request Body

```json
{
  "deviceId": 89,
  "models_id": 18,
  "device_type_id": 3,
  "color": "Azul",
  "storage": "256GB",
  "imeis": [
    { "imei_id": 45, "imei_number": "350123456789012" },
    { "imei_number": "350987654321098" }
  ],
  "accounts": [
    { "account_id": 12, "username": "nuevo@gmail.com", "account_type": "Google" }
  ]
}
```

📌 **Notas:**

* Para editar IMEIs o cuentas existentes se debe enviar su `id`.
* Sin `id`, se crea un nuevo registro.

---

## 📚 Endpoints de Apoyo / Catálogos

| Método | Ruta                    | Descripción                     | Body                       |
| ------ | ----------------------- | ------------------------------- | -------------------------- |
| POST   | `/orders/find-customer` | Buscar cliente por texto        | `{ "find": "juan pérez" }` |
| GET    | `/orders/technicians`   | Lista de técnicos disponibles   | —                          |
| GET    | `/orders/brands`        | Marcas de dispositivos          | —                          |
| POST   | `/orders/find-models`   | Modelos por marca               | `{ "id": 5 }`              |
| GET    | `/orders/type-device`   | Tipos de dispositivos           | —                          |
| GET    | `/orders/initialdata`   | Catálogos iniciales del sistema | —                          |

---

## 📘 Notas Generales

* Todos los endpoints:

  * Requieren autenticación
  * Se comunican con `ORDER_SERVICE`
* Los cambios de estado, hallazgos y procedimientos quedan auditados.
* La paginación es obligatoria en listados.

---

📌 *Documentación diseñada para arquitectura NestJS + Gateway + Microservicios*
