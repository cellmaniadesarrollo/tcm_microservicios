Te dejo 10 ejemplos de JSON listos para Postman, cumpliendo:

✅ 5 usuarios con grupo CASHIERS (772fa33a-2e2f-4725-bf24-6f3c445eae6e)

✅ Los demás con grupos aleatorios

✅ Un usuario puede tener varios grupos

✅ Género aleatorio usando los UUID que diste

🔎 Al final te indico cuáles tienen CASHIERS (los que te interesan)

🧾 1️⃣ Usuario – TIENE CASHIERS
{
  "name_user": "juan_cash1",
  "password_user": "Pass123!",
  "email_user": "juan.cash1@example.com",
  "first_name1": "Juan",
  "first_name2": "Carlos",
  "last_name1": "Pérez",
  "last_name2": "Mora",
  "dni": "0102030401",
  "birthdate": "1990-01-10",
  "date_of_admission": "2022-02-15",
  "email_personal": "juan.perez@gmail.com",
  "email_business": "juan.perez@company.com",
  "addres": "Av. Central 123",
  "phone_personal": "0981112233",
  "phone_business": "022345678",
  "gender_id": "293c4f45-4b67-4637-ae18-8587eefd1824",
  "group_ids": [
    "772fa33a-2e2f-4725-bf24-6f3c445eae6e"
  ]
}

🧾 2️⃣ Usuario – TIENE CASHIERS + CSRS
{
  "name_user": "maria_cash2",
  "password_user": "Pass123!",
  "email_user": "maria.cash2@example.com",
  "first_name1": "María",
  "first_name2": "Elena",
  "last_name1": "Gómez",
  "last_name2": "Ruiz",
  "dni": "0102030402",
  "birthdate": "1992-05-18",
  "date_of_admission": "2023-01-10",
  "email_personal": "maria.gomez@gmail.com",
  "email_business": "maria.gomez@company.com",
  "addres": "Calle Norte 456",
  "phone_personal": "0982223344",
  "phone_business": "022456789",
  "gender_id": "62eeb03c-956f-46b7-b9d9-ba69a7ce800a",
  "group_ids": [
    "772fa33a-2e2f-4725-bf24-6f3c445eae6e",
    "8a1cfa41-1aae-4e9e-95ac-411e9bcfe049"
  ]
}

🧾 3️⃣ Usuario – TIENE CASHIERS + ACCOUNTANTS
{
  "name_user": "luis_cash3",
  "password_user": "Pass123!",
  "email_user": "luis.cash3@example.com",
  "first_name1": "Luis",
  "first_name2": "Alberto",
  "last_name1": "Torres",
  "last_name2": "Vega",
  "dni": "0102030403",
  "birthdate": "1987-09-03",
  "date_of_admission": "2020-06-20",
  "email_personal": "luis.torres@gmail.com",
  "email_business": "luis.torres@company.com",
  "addres": "Av. Sur 789",
  "phone_personal": "0983334455",
  "phone_business": "022567890",
  "gender_id": "293c4f45-4b67-4637-ae18-8587eefd1824",
  "group_ids": [
    "772fa33a-2e2f-4725-bf24-6f3c445eae6e",
    "3f552a99-8ba0-454a-828e-94a807864157"
  ]
}

🧾 4️⃣ Usuario – TIENE CASHIERS + COMPANY_ADMIN
{
  "name_user": "ana_cash4",
  "password_user": "Pass123!",
  "email_user": "ana.cash4@example.com",
  "first_name1": "Ana",
  "first_name2": "Lucía",
  "last_name1": "Martínez",
  "last_name2": "Salas",
  "dni": "0102030404",
  "birthdate": "1995-11-25",
  "date_of_admission": "2024-03-01",
  "email_personal": "ana.martinez@gmail.com",
  "email_business": "ana.martinez@company.com",
  "addres": "Barrio Centro",
  "phone_personal": "0984445566",
  "phone_business": "022678901",
  "gender_id": "62eeb03c-956f-46b7-b9d9-ba69a7ce800a",
  "group_ids": [
    "772fa33a-2e2f-4725-bf24-6f3c445eae6e",
    "6b076ba1-10b2-41c9-a154-ad3aafc907a7"
  ]
}

🧾 5️⃣ Usuario – TIENE CASHIERS + GUESTS
{
  "name_user": "carlos_cash5",
  "password_user": "Pass123!",
  "email_user": "carlos.cash5@example.com",
  "first_name1": "Carlos",
  "first_name2": "Andrés",
  "last_name1": "Rivas",
  "last_name2": "López",
  "dni": "0102030405",
  "birthdate": "1989-07-14",
  "date_of_admission": "2021-09-12",
  "email_personal": "carlos.rivas@gmail.com",
  "email_business": "carlos.rivas@company.com",
  "addres": "Zona Industrial",
  "phone_personal": "0985556677",
  "phone_business": "022789012",
  "gender_id": "977abd5f-34e5-42d0-aba9-4a11360bc6ba",
  "group_ids": [
    "772fa33a-2e2f-4725-bf24-6f3c445eae6e",
    "5cf8af24-abf2-4f07-bd19-aee654b0a9ca"
  ]
}

🧾 6️⃣ Usuario – TECHNICIANS
{
  "name_user": "tecnico_01",
  "password_user": "Pass123!",
  "email_user": "tech1@example.com",
  "first_name1": "Pedro",
  "first_name2": "José",
  "last_name1": "Mendoza",
  "last_name2": "Cruz",
  "dni": "0102030406",
  "birthdate": "1985-04-08",
  "date_of_admission": "2019-01-05",
  "email_personal": "pedro@gmail.com",
  "email_business": "pedro@company.com",
  "addres": "Zona Norte",
  "phone_personal": "0986667788",
  "phone_business": "022890123",
  "gender_id": "293c4f45-4b67-4637-ae18-8587eefd1824",
  "group_ids": [
    "3c1e87dd-558c-4037-b62f-9ccb6b221333"
  ]
}

🧾 7️⃣ Usuario – ADMINS
{
  "name_user": "admin_01",
  "password_user": "Pass123!",
  "email_user": "admin1@example.com",
  "first_name1": "Sofía",
  "first_name2": "Isabel",
  "last_name1": "Cordero",
  "last_name2": "Paz",
  "dni": "0102030407",
  "birthdate": "1991-06-30",
  "date_of_admission": "2020-10-10",
  "email_personal": "sofia@gmail.com",
  "email_business": "sofia@company.com",
  "addres": "Edificio Central",
  "phone_personal": "0987778899",
  "phone_business": "022901234",
  "gender_id": "62eeb03c-956f-46b7-b9d9-ba69a7ce800a",
  "group_ids": [
    "197be215-e765-4440-8939-29a13149dab7"
  ]
}

🧾 8️⃣ Usuario – CSRSSALE
{
  "name_user": "csr_sale01",
  "password_user": "Pass123!",
  "email_user": "csr1@example.com",
  "first_name1": "Miguel",
  "first_name2": "Ángel",
  "last_name1": "Suárez",
  "last_name2": "Reyes",
  "dni": "0102030408",
  "birthdate": "1993-02-17",
  "date_of_admission": "2022-08-01",
  "email_personal": "miguel@gmail.com",
  "email_business": "miguel@company.com",
  "addres": "Sucursal Sur",
  "phone_personal": "0988889900",
  "phone_business": "022012345",
  "gender_id": "293c4f45-4b67-4637-ae18-8587eefd1824",
  "group_ids": [
    "2a886920-3b02-49e0-85dd-aa638ee88e6c"
  ]
}

🧾 9️⃣ Usuario – ACCOUNTANTS
{
  "name_user": "conta_01",
  "password_user": "Pass123!",
  "email_user": "conta1@example.com",
  "first_name1": "Laura",
  "first_name2": "Patricia",
  "last_name1": "Navarro",
  "last_name2": "Gil",
  "dni": "0102030409",
  "birthdate": "1986-12-05",
  "date_of_admission": "2018-05-15",
  "email_personal": "laura@gmail.com",
  "email_business": "laura@company.com",
  "addres": "Zona Financiera",
  "phone_personal": "0990001122",
  "phone_business": "022123456",
  "gender_id": "62eeb03c-956f-46b7-b9d9-ba69a7ce800a",
  "group_ids": [
    "3f552a99-8ba0-454a-828e-94a807864157"
  ]
}

🧾 🔟 Usuario – IFE + CSRSPER
{
  "name_user": "ife_csr01",
  "password_user": "Pass123!",
  "email_user": "ife1@example.com",
  "first_name1": "Andrés",
  "first_name2": "Felipe",
  "last_name1": "Morales",
  "last_name2": "Pinto",
  "dni": "0102030410",
  "birthdate": "1994-10-21",
  "date_of_admission": "2023-06-18",
  "email_personal": "andres@gmail.com",
  "email_business": "andres@company.com",
  "addres": "Sucursal Este",
  "phone_personal": "0991112233",
  "phone_business": "022234567",
  "gender_id": "977abd5f-34e5-42d0-aba9-4a11360bc6ba",
  "group_ids": [
    "4e5cbd52-c9fe-48a0-90e2-f9048863908c",
    "c60633e5-7b86-46fb-9fb4-c2004c289c4a"
  ]
}