import { Repository } from 'typeorm';
import { UserEmployeeCache } from '../../users-employees-events/entities/user_employee_cache.entity';
export interface UserSnapshot {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    dni: string | null;
    email: string;
    phone: string | null;
}

/**
 * Resuelve el snapshot completo de un usuario desde el caché.
 * Si no se encuentra, devuelve un objeto mínimo con solo el id
 * para no romper el broadcast.
 */
export async function resolveUserSnapshot(
    userId: string,
    repo: Repository<UserEmployeeCache>,
): Promise<UserSnapshot> {
    const user = await repo.findOne({ where: { id: userId } });

    if (!user) {
        return {
            id: userId,
            username: 'unknown',
            first_name: '',
            last_name: '',
            dni: null,
            email: '',
            phone: null,
        };
    }

    return {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        dni: user.dni ?? null,
        email: user.email,
        phone: user.phone ?? null,
    };
}