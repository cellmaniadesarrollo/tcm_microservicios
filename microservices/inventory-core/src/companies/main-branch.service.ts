import { BadRequestException, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { DataSource, EntityManager } from 'typeorm';
import { BranchReplica } from './entities/branch-replica.entity';

/**
 * Resuelve la sucursal principal de una empresa.
 * Regla: 
 * 1. Si solo hay una sucursal activa, esa es la principal.
 * 2. Si hay varias, la principal es la que tenga el código menor (ej. '001').
 */
@Injectable()
export class MainBranchService {
    constructor(private readonly dataSource: DataSource) { }

    async getMainBranchId(companyId: string, em?: EntityManager): Promise<string> {
        const manager = em ?? this.dataSource.manager;

        // Buscamos las sucursales activas ordenadas por código de forma ascendente (menor a mayor)
        const branches = await manager.find(BranchReplica, {
            where: { company: { id: companyId }, status: true },
            select: { id: true, code: true, name: true },
            order: { code: 'ASC' },
        });

        if (branches.length === 0) {
            throw new RpcException(
                new BadRequestException('La empresa no tiene sucursales activas'),
            );
        }

        // Si solo hay una sucursal, es la principal.
        // Si hay varias, la de código menor (ej. '001') está en la primera posición por el order: { code: 'ASC' }.
        return branches[0].id;
    }
}