export interface KafkaEvent<T> {
    eventId: string;
    eventType: string;
    timestamp: string;
    source: string;
    version: number;
    data: T;
}