export const CUSTOMER_AUTHORIZERS_GROUP = 'CUSTOMER_AUTHORIZERS';

// Grupos que reciben el correo de autorización (confirma los nombres reales)
export const CUSTOMER_AUTH_RECIPIENT_GROUPS = [
    CUSTOMER_AUTHORIZERS_GROUP,
    'ADMIN',
    'CUSTOMER_ADMIN',
    'TECHNICIANS', // agregado para pruebas
];