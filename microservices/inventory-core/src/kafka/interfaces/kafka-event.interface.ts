export interface KafkaEvent<T = any> {
    eventId: string;
    eventType: string;
    timestamp: string;
    source: string;
    version: number;
    data: T;
}