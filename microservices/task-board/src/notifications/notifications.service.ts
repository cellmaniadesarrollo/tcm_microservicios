// task-board/src/notifications/notifications.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class NotificationsService {

    constructor(
        @Inject('REALTIME_SERVICE')
        private readonly realtimeClient: ClientProxy,
    ) { }

    async emitTaskCreated(
        task: {
            id: string;
            title: string;
            description?: string;
            status: string;
            priority: string;
            columnId?: string;
            columnName?: string;
        },
        boardId: string,
        companyId: string,
        createdBy: string,
        userName: string,
        assignedTo?: string
    ) {
        const payload = {
            event: 'task.created',
            task_id: task.id,
            board_id: boardId,
            company_id: companyId,
            userId: createdBy,
            userName: userName,
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                columnId: task.columnId,
                columnName: task.columnName,
            },
            action: "Tarea Creada",
            description: `📋 Nueva tarea: "${task.title}" ha sido creada en ${task.columnName || 'el tablero'}`,
            created_by: createdBy,
            timestamp: new Date().toISOString(),
            assignedTo: assignedTo,
        };

        try {
            await lastValueFrom(this.realtimeClient.emit('task.created', payload));
            console.log(`✅ [Notifications] Evento task.created enviado: ${task.title}`);
        } catch (error) {
            console.error(`❌ [Notifications] Error al emitir task.created:`, error);
        }
    }

    async emitTaskUpdated(
        task: {
            id: string;
            title: string;
            status: string;
            priority: string;
        },
        boardId: string,
        companyId: string,
        updatedBy: string,
        userName: string,
        changes: string[]
    ) {
        const payload = {
            event: 'task.updated',
            task_id: task.id,
            board_id: boardId,
            company_id: companyId,
            userId: updatedBy,
            userName: userName,
            task: {
                id: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
            },
            action: "Tarea Actualizada",
            description: `✏️ Tarea "${task.title}" actualizada: ${changes.join(', ')}`,
            updated_by: updatedBy,
            timestamp: new Date().toISOString(),
        };

        try {
            await lastValueFrom(this.realtimeClient.emit('task.updated', payload));
            console.log(`✅ [Notifications] Evento task.updated enviado`);
        } catch (error) {
            console.error(`❌ [Notifications] Error al emitir task.updated:`, error);
        }
    }

    async emitTaskMoved(
        task: {
            id: string;
            title: string;
        },
        boardId: string,
        companyId: string,
        movedBy: string,
        userName: string,
        fromColumn: string,
        toColumn: string
    ) {
        const payload = {
            event: 'task.moved',
            task_id: task.id,
            board_id: boardId,
            company_id: companyId,
            userId: movedBy,
            userName: userName,
            task: {
                id: task.id,
                title: task.title,
            },
            action: "Tarea Movida",
            description: `🔄 Tarea "${task.title}" movida de "${fromColumn}" a "${toColumn}"`,
            moved_by: movedBy,
            from_column: fromColumn,
            to_column: toColumn,
            timestamp: new Date().toISOString(),
        };

        try {
            await lastValueFrom(this.realtimeClient.emit('task.moved', payload));
            console.log(`✅ [Notifications] Evento task.moved enviado`);
        } catch (error) {
            console.error(`❌ [Notifications] Error al emitir task.moved:`, error);
        }
    }

    async emitTaskCompleted(
        task: {
            id: string;
            title: string;
        },
        boardId: string,
        companyId: string,
        completedBy: string,
        userName: string
    ) {
        const payload = {
            event: 'task.completed',
            task_id: task.id,
            board_id: boardId,
            company_id: companyId,
            userId: completedBy,
            userName: userName,
            task: {
                id: task.id,
                title: task.title,
            },
            action: "Tarea Completada",
            description: `✅ Tarea "${task.title}" ha sido completada`,
            completed_by: completedBy,
            timestamp: new Date().toISOString(),
        };

        try {
            await lastValueFrom(this.realtimeClient.emit('task.completed', payload));
            console.log(`✅ [Notifications] Evento task.completed enviado`);
        } catch (error) {
            console.error(`❌ [Notifications] Error al emitir task.completed:`, error);
        }
    }

    async emitTaskDeleted(
        task: {
            id: string;
            title: string;
        },
        boardId: string,
        companyId: string,
        deletedBy: string,
        userName: string
    ) {
        const payload = {
            event: 'task.deleted',
            task_id: task.id,
            board_id: boardId,
            company_id: companyId,
            userId: deletedBy,
            userName: userName,
            task: {
                id: task.id,
                title: task.title,
            },
            action: "Tarea Eliminada",
            description: `🗑️ Tarea "${task.title}" ha sido eliminada`,
            deleted_by: deletedBy,
            timestamp: new Date().toISOString(),
        };

        try {
            await lastValueFrom(this.realtimeClient.emit('task.deleted', payload));
            console.log(`✅ [Notifications] Evento task.deleted enviado`);
        } catch (error) {
            console.error(`❌ [Notifications] Error al emitir task.deleted:`, error);
        }
    }
}