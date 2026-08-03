# POST /auth/login --- Autenticación de Usuario

## Requisito

-   **Autenticación:** Ninguna (endpoint público)

## Body (LoginUserDto)

``` json
{
  "username": "string",
  "password": "string",
  "latitude":  number?,
  "longitude": number?,
  "remember":  boolean?
}
```

### Notas

-   **username:** Puede ser `name_user` o `email_user` (según tu lógica
    interna).
-   **remember:**
    -   `true` → sesión aproximada de **30 días**\
    -   `false` u omitido → sesión aproximada de **24 horas**

## Ejemplo mínimo (Postman-ready)

``` json
{
  "username": "christian_dev",
  "password": "SecurePass123",
  "remember": true
}
```

## Ejemplo con coordenadas (opcional)

``` json
{
  "username": "maria.lopez",
  "password": "MariaL2026!",
  "latitude": -2.8974,
  "longitude": -79.0045,
  "remember": false
}
```

## Respuesta esperada (éxito --- 200/201)

``` json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
}
```
