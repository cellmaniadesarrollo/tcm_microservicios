CreateCustomerDto, cumpliendo:

✅ idTypeId: 1–3 (Cédula / Pasaporte / RUC)

✅ genderId: 1–3

✅ contactTypeId: 1–4

✅ cityId: 1–8640

✅ Al menos 1 contacto y 1 dirección por cliente

✅ Algunos con contacto primario, otros sin

✅ Datos realistas para pruebas

🧾 1️⃣ Cliente
{
  "idTypeId": 1,
  "idNumber": "0912345678",
  "firstName": "Juan",
  "lastName": "Pérez",
  "birthDate": "1990-05-01",
  "genderId": 1,
  "contacts": [
    { "contactTypeId": 1, "value": "0991112233", "isPrimary": true },
    { "contactTypeId": 2, "value": "juan.perez@mail.com" }
  ],
  "addresses": [
    {
      "cityId": 45,
      "zone": "Norte",
      "sector": "La Kennedy",
      "locality": "Guayas",
      "mainStreet": "Av. Principal",
      "secondaryStreet": "Calle 1",
      "reference": "Frente al parque",
      "postalCode": "090101"
    }
  ]
}

🧾 2️⃣ Cliente
{
  "idTypeId": 2,
  "idNumber": "P1234567",
  "firstName": "María",
  "lastName": "Gómez",
  "birthDate": "1994-08-12",
  "genderId": 2,
  "contacts": [
    { "contactTypeId": 1, "value": "0982223344", "isPrimary": true },
    { "contactTypeId": 2, "value": "maria@mail.com" }
  ],
  "addresses": [
    {
      "cityId": 120,
      "zone": "Centro",
      "sector": "El Sagrario",
      "locality": "Pichincha",
      "mainStreet": "Av. 10 de Agosto",
      "secondaryStreet": "Calle Sucre"
    }
  ]
}

🧾 3️⃣ Cliente
{
  "idTypeId": 1,
  "idNumber": "0923456789",
  "firstName": "Carlos",
  "lastName": "Rivas",
  "genderId": 1,
  "contacts": [
    { "contactTypeId": 3, "value": "022345678", "isPrimary": true }
  ],
  "addresses": [
    {
      "cityId": 980,
      "zone": "Sur",
      "sector": "Chillogallo",
      "mainStreet": "Av. Maldonado"
    }
  ]
}

🧾 4️⃣ Cliente
{
  "idTypeId": 3,
  "idNumber": "1790012345001",
  "firstName": "Empresa",
  "lastName": "Comercial SA",
  "contacts": [
    { "contactTypeId": 2, "value": "info@empresa.com", "isPrimary": true },
    { "contactTypeId": 3, "value": "023456789" }
  ],
  "addresses": [
    {
      "cityId": 500,
      "zone": "Industrial",
      "mainStreet": "Av. Amazonas",
      "reference": "Parque Industrial"
    }
  ]
}

🧾 5️⃣ Cliente
{
  "idTypeId": 1,
  "idNumber": "0934567890",
  "firstName": "Ana",
  "lastName": "Martínez",
  "birthDate": "1988-11-22",
  "genderId": 2,
  "contacts": [
    { "contactTypeId": 1, "value": "0973334455", "isPrimary": true }
  ],
  "addresses": [
    {
      "cityId": 3210,
      "zone": "Este",
      "sector": "Alborada"
    }
  ]
}

🧾 6️⃣ Cliente
{
  "idTypeId": 2,
  "idNumber": "P9876543",
  "firstName": "Luis",
  "lastName": "Torres",
  "genderId": 1,
  "contacts": [
    { "contactTypeId": 1, "value": "0984445566", "isPrimary": true },
    { "contactTypeId": 4, "value": "WhatsApp" }
  ],
  "addresses": [
    { "cityId": 2500, "zone": "Oeste" }
  ]
}

🧾 7️⃣ Cliente
{
  "idTypeId": 1,
  "idNumber": "0945678901",
  "firstName": "Sofía",
  "lastName": "Navarro",
  "genderId": 2,
  "contacts": [
    { "contactTypeId": 2, "value": "sofia@mail.com", "isPrimary": true }
  ],
  "addresses": [
    { "cityId": 7800, "sector": "Centro Histórico" }
  ]
}

🧾 8️⃣ Cliente
{
  "idTypeId": 3,
  "idNumber": "0999999999001",
  "firstName": "Servicios",
  "lastName": "Globales",
  "contacts": [
    { "contactTypeId": 3, "value": "022998877", "isPrimary": true }
  ],
  "addresses": [
    { "cityId": 640, "zone": "Comercial" }
  ]
}

🧾 9️⃣ Cliente
{
  "idTypeId": 1,
  "idNumber": "0956789012",
  "firstName": "Miguel",
  "lastName": "Suárez",
  "genderId": 1,
  "contacts": [
    { "contactTypeId": 1, "value": "0998887766", "isPrimary": true },
    { "contactTypeId": 2, "value": "miguel@mail.com" }
  ],
  "addresses": [
    { "cityId": 4321, "zone": "Residencial" }
  ]
}

🧾 🔟 Cliente
{
  "idTypeId": 2,
  "idNumber": "P4455667",
  "firstName": "Laura",
  "lastName": "Cedeño",
  "genderId": 2,
  "contacts": [
    { "contactTypeId": 1, "value": "0987776655", "isPrimary": true }
  ],
  "addresses": [
    { "cityId": 1111, "sector": "Las Orquídeas" }
  ]
}