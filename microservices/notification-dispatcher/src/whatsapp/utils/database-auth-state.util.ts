import { Repository } from 'typeorm';
import {
    initAuthCreds,
    BufferJSON,
    proto,
    AuthenticationCreds,
    SignalDataTypeMap,
    SignalDataSet,         // ← tipo correcto para el set
    SignalKeyStore,
} from '@whiskeysockets/baileys';
import { WhatsappSession } from '../entities/whatsapp-session.entity';

export async function useDatabaseAuthState(
    session: WhatsappSession,
    repo: Repository<WhatsappSession>,
) {
    const creds: AuthenticationCreds = session.creds
        ? JSON.parse(JSON.stringify(session.creds), BufferJSON.reviver)
        : initAuthCreds();

    const keysStore: Record<string, any> = session.keys
        ? JSON.parse(JSON.stringify(session.keys), BufferJSON.reviver)
        : {};

    const keys: SignalKeyStore = {
        get: async <T extends keyof SignalDataTypeMap>(
            type: T,
            ids: string[],
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
            const result: { [id: string]: SignalDataTypeMap[T] } = {};
            for (const id of ids) {
                let value = keysStore[`${type}-${id}`];
                if (type === 'app-state-sync-key' && value) {
                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                }
                if (value !== undefined) result[id] = value;
            }
            return result;
        },

        // SignalDataSet es { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] } }
        set: async (data: SignalDataSet): Promise<void> => {
            for (const [type, typeData] of Object.entries(data)) {
                if (!typeData) continue;
                for (const [id, value] of Object.entries(typeData)) {
                    const storeKey = `${type}-${id}`;
                    if (value != null) {
                        keysStore[storeKey] = value;
                    } else {
                        delete keysStore[storeKey];
                    }
                }
            }
            await repo.update(session.id, {
                keys: JSON.parse(JSON.stringify(keysStore, BufferJSON.replacer)),
            });
        },
    };

    return {
        state: { creds, keys },

        saveCreds: async () => {
            await repo.update(session.id, {
                creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
            });
        },
    };
} 