import {
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

/**
 * Toda la lógica de "hablar con el microservicio de órdenes" vive acá:
 * - inyecta el internalToken en cada mensaje
 * - resuelve el Observable con firstValueFrom
 * - centraliza el manejo de errores cuando aplica
 *
 * El controller ya no conoce `ClientProxy` ni `process.env.INTERNAL_SECRET`.
 */
@Injectable()
export class OrdersGatewayService {
    constructor(
        @Inject('ORDER_SERVICE') private readonly client: ClientProxy,
    ) { }

    private send<T = any>(cmd: string, payload: Record<string, any> = {}): Promise<T> {
        return firstValueFrom(
            this.client.send<T>(
                { cmd },
                { internalToken: process.env.INTERNAL_SECRET, ...payload },
            ),
        );
    }

    // ---------- Órdenes ----------

    createOrder(dto: any, files: any[], user: any) {
        return this.send('create_order', { dto, files, user });
    }

    findCustomer(find: any, user: any) {
        return this.send('find_customer', { find, user });
    }

    getTechnicians(user: any, orderTypeId: any) {
        return this.send('get_technicians', { user, orderTypeId });
    }

    getBrands() {
        return this.send('get_brands');
    }

    findModels(brandId: number) {
        return this.send('find_models', { brandId });
    }

    getTypeDevice() {
        return this.send('get_type_device');
    }

    getOrderStatus() {
        return this.send('get_order_status');
    }

    createDevice(body: any, user: any) {
        return this.send('create_device', { ...body, user });
    }

    searchIMEI(imei: string, user: any) {
        return this.send('search_imei', { imei, user });
    }

    getDeviceById(deviceId: number, user: any) {
        return this.send('get_device_by_id', { deviceId, user });
    }

    updateDevice(deviceId: number, dto: any, user: any) {
        return this.send('update_device', {
            deviceId,
            dto,
            user: { userId: user.userId, companyId: user.companyId },
        });
    }

    getInitialData() {
        return this.send('get_newdata_catalog_orders');
    }

    listOrders(dto: any, user: any) {
        return this.send('list_orders', { dto, user });
    }

    listMyOrders(dto: any, user: any) {
        return this.send('list_my_orders', { dto, user });
    }

    getOrderFullData(dto: any, user: any) {
        return this.send('get_order_full_data', { dto, user });
    }

    async changeOrderStatus(dto: any, user: any) {
        try {
            return await this.send('change_order_status', { dto, user });
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Error interno en la comunicación con el microservicio',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    // ---------- Findings / procedimientos ----------

    createOrderFinding(dto: any, user: any) {
        return this.send('create_order_finding', { dto, user });
    }

    createFindingProcedure(dto: any, user: any) {
        return this.send('create_finding_procedure', { dto, user });
    }

    updateFinding(findingId: number, dto: any, user: any) {
        return this.send('update_order_finding', { findingId, dto, user });
    }

    updateProcedure(procedureId: number, dto: any, user: any) {
        return this.send('update_finding_procedure', { procedureId, dto, user });
    }

    deleteFinding(findingId: number, user: any) {
        return this.send('delete_order_finding', { findingId, user });
    }

    deleteProcedure(procedureId: number, user: any) {
        return this.send('delete_finding_procedure', { procedureId, user });
    }

    // ---------- Adjuntos ----------

    deleteAttachment(attachmentId: number, user: any) {
        return this.send('delete_attachment', { attachmentId, user });
    }

    uploadAttachments(files: any[], dto: any, user: any) {
        return this.send('upload_attachments', { files, dto, user });
    }

    // ---------- Pagos / cierre ----------

    registerPayment(dto: any, files: any[], user: any) {
        return this.send('register_order_payment', { dto, files, user });
    }

    closeOrder(dto: any, files: any[], user: any) {
        return this.send('close_order', { dto, files, user });
    }

    getPaymentCatalogs() {
        return this.send('get_payment_catalogs');
    }

    getOrderPayment(paymentId: number, user: any) {
        return this.send('get_order_payment', { dto: { payment_id: paymentId }, user });
    }

    verifyPayment(paymentId: number, companyId: number, verifiedById: number) {
        return this.send('verify_order_payment', {
            dto: { paymentId, companyId, verifiedById },
        });
    }

    getPaymentSignedUrls(paymentId: number, companyId: number) {
        return this.send('get_payment_signed_urls', { paymentId, companyId });
    }

    // ---------- Consultas varias ----------

    getLastOrdersByDevice(deviceId: number, user: any) {
        return this.send('get_last_orders_by_device', { deviceId, user });
    }

    getOrderPublicData(publicId: string) {
        return this.send('get_order_public_data', { publicId });
    }

    checkWarranty(imei: string) {
        return this.send('check_warranty_by_imei', { dto: { imei } });
    }

    // ---------- Notas ----------

    createOrderNote(dto: any, user: any) {
        return this.send('create_order_note', { dto, user });
    }

    deleteOrderNote(noteId: number, user: any) {
        return this.send('delete_order_note', { dto: { note_id: noteId }, user });
    }

    updateOrderNote(noteId: number, dto: any, user: any) {
        return this.send('update_order_note', { noteId, dto, user });
    }

    // ---------- Historial de búsqueda ----------

    getSearchHistory(user: any) {
        return this.send('get_search_history', { user });
    }

    saveSearchHistory(dto: any, user: any) {
        return this.send('save_search_history', { dto, user });
    }

    deleteSearchHistory(searchTerm: string, user: any) {
        return this.send('delete_search_history', { data: { searchTerm }, user });
    }

    // ---------- Dispositivo <-> orden ----------

    linkDeviceToOrder(dto: any, user: any) {
        return this.send('link_device_to_order', { dto, user });
    }

    // ---------- Compras potenciales ----------

    markPotentialPurchase(body: any, user: any) {
        return this.send('mark_potential_purchase', { ...body, user });
    }

    unmarkPotentialPurchase(orderId: number, user: any) {
        return this.send('unmark_potential_purchase', { order_id: orderId, user });
    }

    listPotentialPurchases(dto: any, companyId: number) {
        return this.send('list_potential_purchases', { companyId, dto });
    }

    getPotentialPurchaseFullData(id: number, companyId: number) {
        return this.send('get_potential_purchase_full_data', { id, companyId });
    }

    // ---------- Geo ----------

    getGeoCountries(user: any) {
        return this.send('get_geo_countries', { user });
    }

    getGeoProvinces(countryId: number, user: any) {
        return this.send('get_geo_provinces', { country_id: countryId, user });
    }

    getGeoCities(provinceId: number, user: any) {
        return this.send('get_geo_cities', { province_id: provinceId, user });
    }

    // ---------- Envíos (shipping) ----------

    saveInbound(orderId: number, dto: any, user: any) {
        return this.send('save_order_inbound', { orderId, dto, user });
    }

    saveOutbound(orderId: number, dto: any, user: any) {
        return this.send('save_order_outbound', { orderId, dto, user });
    }

    getShipping(orderId: number, user: any) {
        return this.send('get_order_shipping', { orderId, user });
    }

    // ---------- Repuestos ----------

    cancelSpareAssignment(
        orderId: number,
        spareAssignmentId: string,
        dto: any,
        user: any,
    ) {
        return this.send('cancel_spare_assignment', {
            orderId,
            spareAssignmentId,
            dto,
            user,
        });
    }

    // ---------- Productos pendientes ----------

    createPendingProduct(dto: any, files: any[], user: any) {
        return this.send('create_order_pending_product', { dto, files, user });
    }

    updatePendingProduct(
        id: number,
        dto: any,
        files: any[],
        removeAttachmentIds: number[],
        user: any,
    ) {
        return this.send('update_order_pending_product', {
            id,
            dto,
            files,
            removeAttachmentIds,
            user,
        });
    }

    deletePendingProduct(id: number, user: any) {
        return this.send('delete_order_pending_product', { id, user });
    }

    // ---------- Servicios extra ----------

    createExtraService(dto: any, files: any[], user: any) {
        return this.send('create_order_extra_service', { dto, files, user });
    }

    updateExtraService(
        id: number,
        dto: any,
        files: any[],
        removeAttachmentIds: number[],
        user: any,
    ) {
        return this.send('update_order_extra_service', {
            id,
            dto,
            files,
            removeAttachmentIds,
            user,
        });
    }

    deleteExtraService(id: number, user: any) {
        return this.send('delete_order_extra_service', { id, user });
    }

    listServiceTypes() {
        return this.send('list_order_service_types');
    }

    updateOrderPriceAgreement(orderId: number, dto: any, user: any) {
        return this.send('update_order_price_agreement', { orderId, dto, user });
    }

    deleteOrderPriceAgreement(orderId: number, user: any) {
        return this.send('delete_order_price_agreement', { orderId, user });
    }
    createOrderPriceAgreement(orderId: number, dto: any, user: any) {
        return this.send('create_order_price_agreement', { orderId, dto, user });
    }
    getEmployeesBasic(user: any) {
        return this.send('get_employees_basic', { user });
    }
}