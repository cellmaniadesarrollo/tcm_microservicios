# POST /users --- Crear Usuario

## Requisito

-   **Autenticación:** Bearer Token (JWT de usuario autenticado)

## Body (CreateUserDto)

``` json
{
  "name_user": "string",
  "password_user": "string",
  "email_user": "email@valido.com",
  "first_name1": "string",
  "first_name2": "string?",           
  "last_name1": "string",
  "last_name2": "string?",            
  "dni": "string",
  "birthdate": "YYYY-MM-DD",
  "date_of_admission": "YYYY-MM-DD",
  "email_personal": "email@valido.com",
  "email_business": "email@valido.com",
  "addres": "string",
  "phone_personal": "string",
  "phone_business": "string",
  "gender_id": "UUID",
  "group_ids": ["UUID1", "UUID2"]
}
```

## Valores válidos (hardcoded temporal)

### gender_id (elige uno)

  Género      UUID
  ----------- ----------------------------------------
  Masculino   `da599ea2-0678-4a32-acc1-923bb867dd5e`
  Femenino    `7b4400ad-bca8-4b3e-ac89-f3779becf412`
  Otro        `4cceeeec-7458-4ba8-bcba-ec765b605ee8`

### group_ids (puedes combinar)

  Grupo           UUID
  --------------- ----------------------------------------
  ADMINS          `27b1bdb1-4e9f-4ae0-b48f-cd1adaa9576d`
  COMPANY_ADMIN   `e120705a-2817-44eb-8c9f-489a26512202`
  ACCOUNTANTS     `4f90d732-a564-459f-8759-5bcb781eb84d`
  CSRS            `688c4b93-f7e4-4f29-9e03-b66815eb319b`
  TECHNICIANS     `6fe664f7-8cbd-48d3-b07a-6c878143c993`
  CASHIERS        `b259c379-c5f5-4789-ae54-f80a1901cb97`
  GUESTS          `6a37fe7f-308d-4bcf-a39b-1769f69604b8`

## Ejemplo mínimo (Postman-ready)

``` json
{
  "name_user": "test.user",
  "password_user": "Test1234!",
  "email_user": "test@empresa.com",
  "first_name1": "Test",
  "last_name1": "Usuario",
  "dni": "9999999999",
  "birthdate": "1995-01-01",
  "date_of_admission": "2026-01-17",
  "email_personal": "personal@test.com",
  "email_business": "business@test.com",
  "addres": "Calle Test 123",
  "phone_personal": "0999999999",
  "phone_business": "072222222",
  "gender_id": "da599ea2-0678-4a32-acc1-923bb867dd5e",
  "group_ids": ["e120705a-2817-44eb-8c9f-489a26512202"]
}
```
