import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompanyReplica, CompanyReplicaDocument } from './schemas/company-replica.schema'

@Injectable()
export class CompaniesService {
    constructor(
        @InjectModel(CompanyReplica.name)
        private readonly companyModel: Model<CompanyReplicaDocument>,
    ) { }

    // ── Sync individual (Kafka events: created / updated) ──────────────────────
    async syncCompany(company: any): Promise<void> {
        await this.companyModel.findOneAndUpdate(
            { id: company.id },                         // filtro por UUID de negocio
            {
                $set: {
                    id: company.id,
                    name: company.name,
                    status: company.status,
                    maxUsers: company.maxUsers,
                    createdAt: company.createdAt,
                    updatedAt: company.updatedAt,
                    branches: this.mapBranches(company.branches ?? []),
                },
            },
            { upsert: true, returnDocument: 'after' },
        );

        console.log(`✅ Company ${company.id} sincronizada`);
    }

    // ── Última fecha de actualización (para sync incremental) ──────────────────
    async getLastUpdatedAt(): Promise<Date | null> {
        const result = await this.companyModel
            .findOne({ updatedAt: { $ne: null } })
            .sort({ updatedAt: -1 })
            .select('updatedAt')
            .lean();

        return result?.updatedAt ?? null;
    }

    // ── Sync masiva: inicial o incremental ─────────────────────────────────────
    async syncCompanyBulk(payload: any[]): Promise<void> {
        if (!payload?.length) return;

        // bulkWrite ejecuta todos los upserts en una sola round-trip a MongoDB
        const operations = payload.map((company) => ({
            updateOne: {
                filter: { id: company.id },
                update: {
                    $set: {
                        id: company.id,
                        name: company.name,
                        status: company.status,
                        maxUsers: company.maxUsers,
                        createdAt: company.createdAt,
                        updatedAt: company.updatedAt,
                        branches: this.mapBranches(company.branches ?? []),
                    },
                },
                upsert: true,
            },
        }));

        const result = await this.companyModel.bulkWrite(operations, {
            ordered: false,   // continúa aunque un doc falle
        });

        console.log(
            `✅ Sync compañías OK | Upserted: ${result.upsertedCount} | Modified: ${result.modifiedCount}`,
        );
    }

    // ── Helper: normaliza el array de branches ─────────────────────────────────
    private mapBranches(branches: any[]) {
        return branches.map((b) => ({
            id: b.id,
            name: b.name,
            address: b.address,
            code: b.code,
            status: b.status,
            location: b.location          // si ya viene como GeoJSON { type, coordinates }
                ? b.location
                : null,
        }));
    }
}