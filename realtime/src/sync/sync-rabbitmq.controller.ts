// src/sync/sync-rabbitmq.controller.ts
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { SyncGateway } from './sync.gateway';

@Controller()
export class SyncRabbitmqController {
    constructor(private readonly syncGateway: SyncGateway) { }

    // ==================== EVENTOS DE ÓRDENES ====================
    
    @EventPattern('order.created')
    async handleOrderCreated(data: any) {
        const companyId = data.company_id || data.companyId;

        if (!companyId) {
            console.warn('[Sync] order.created recibido sin company_id');
            return;
        }

        const companyRoom = `company:${companyId}`;
        this.syncGateway.server.to(companyRoom).emit('order.created', data);
        console.log(`✅ [Sync] order.created reenviado a sala: ${companyRoom}`);
    }

    @EventPattern('order.updated')
    async handleOrderUpdated(data: any) {
        const companyId = data.company_id || data.companyId;

        if (!companyId) {
            console.warn('[Sync] order.updated recibido sin company_id');
            return;
        }

        const companyRoom = `company:${companyId}`;
        this.syncGateway.server.to(companyRoom).emit('order.updated', data);
        console.log(`✅ [Sync] order.updated reenviado a sala: ${companyRoom}`);
    }

    // ==================== EVENTOS DE TASK-BOARD ====================
    
    @EventPattern('task.created')
    async handleTaskCreated(data: any) {
        console.log('🔥🔥🔥 [Sync] task.created recibido 🔥🔥🔥', data);
        
        const companyId = data.company_id || data.companyId;
        if (!companyId) {
            console.warn('[Sync] task.created recibido sin company_id');
            return;
        }

        // ✅ Si la tarea está asignada a alguien, enviar a su sala personal
        const assignedTo = data.assignedTo;
        
        if (assignedTo) {
            const userRoom = `user:${assignedTo}`;
            this.syncGateway.server.to(userRoom).emit('task.created', data);
            console.log(`✅ [Sync] task.created reenviado a sala personal: ${userRoom}`);
        } else {
            // Si no hay asignado, enviar a toda la empresa
            const companyRoom = `company:${companyId}`;
            this.syncGateway.server.to(companyRoom).emit('task.created', data);
            console.log(`✅ [Sync] task.created reenviado a sala: ${companyRoom}`);
        }
    } 

    @EventPattern('task.updated')
    async handleTaskUpdated(data: any) {
        console.log('🔥 [Sync] task.updated recibido', data);
        
        const companyId = data.company_id || data.companyId;
        if (!companyId) return;

        const assignedTo = data.assignedTo;
        
        if (assignedTo) {
            const userRoom = `user:${assignedTo}`;
            this.syncGateway.server.to(userRoom).emit('task.updated', data);
            console.log(`✅ [Sync] task.updated reenviado a sala personal: ${userRoom}`);
        } else {
            const companyRoom = `company:${companyId}`;
            this.syncGateway.server.to(companyRoom).emit('task.updated', data);
        }
    }

    @EventPattern('task.moved')
    async handleTaskMoved(data: any) {
        console.log('🔥 [Sync] task.moved recibido', data);
        
        const companyId = data.company_id || data.companyId;
        if (!companyId) return;

        const assignedTo = data.assignedTo;
        
        if (assignedTo) {
            const userRoom = `user:${assignedTo}`;
            this.syncGateway.server.to(userRoom).emit('task.moved', data);
        } else {
            const companyRoom = `company:${companyId}`;
            this.syncGateway.server.to(companyRoom).emit('task.moved', data);
        }
    }

    @EventPattern('task.completed')
    async handleTaskCompleted(data: any) {
        console.log('🔥 [Sync] task.completed recibido', data);
        
        const companyId = data.company_id || data.companyId;
        if (!companyId) return;

        const assignedTo = data.assignedTo;
        
        if (assignedTo) {
            const userRoom = `user:${assignedTo}`;
            this.syncGateway.server.to(userRoom).emit('task.completed', data);
        } else {
            const companyRoom = `company:${companyId}`;
            this.syncGateway.server.to(companyRoom).emit('task.completed', data);
        }
    }

    @EventPattern('task.deleted')
    async handleTaskDeleted(data: any) {
        console.log('🔥 [Sync] task.deleted recibido', data);
        
        const companyId = data.company_id || data.companyId;
        if (!companyId) return;

        const assignedTo = data.assignedTo;
        
        if (assignedTo) {
            const userRoom = `user:${assignedTo}`;
            this.syncGateway.server.to(userRoom).emit('task.deleted', data);
        } else {
            const companyRoom = `company:${companyId}`;
            this.syncGateway.server.to(companyRoom).emit('task.deleted', data);
        }
    }
}