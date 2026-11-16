// order-fingerprint.ts
export function orderFingerprint(o: any): string {
    const findings = (o.findings ?? []).filter((f: any) => f.is_active);
    const procs = findings.flatMap((f: any) => (f.procedures ?? []).filter((p: any) => p.is_active));
    const paid = (o.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const cost = procs.reduce((s: number, p: any) => s + Number(p.procedure_cost ?? 0), 0);

    return [
        o.currentStatus?.id ?? 0,
        o.priority?.id ?? 0,
        o.is_national ? 1 : 0,
        o.device?.device_id ?? 0,
        (o.statusHistory ?? []).length,
        (o.payments ?? []).length,
        Math.round(paid * 100),
        findings.length,
        findings.filter((f: any) => f.is_resolved).length,
        procs.length,
        Math.round(cost * 100),
        (o.notes ?? []).filter((n: any) => !n.isDeleted).length,
        (o.technicians ?? []).length,
    ].join('|');
}