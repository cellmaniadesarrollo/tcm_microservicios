// gateway/src/inventario/inventario.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);
  private readonly inventarioUrl: string;
  private readonly ordersServiceUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.inventarioUrl = this.configService.get('INVENTARIO_SERVICE_URL', 'http://inventario:3030');
    this.ordersServiceUrl = this.configService.get('ORDER_SERVICE_URL', 'http://orders:3001');
    this.logger.log(`Inventario service URL: ${this.inventarioUrl}`);
    this.logger.log(`Orders service URL: ${this.ordersServiceUrl}`);
  }

  // ============================================
  // ✅ PRODUCTOS
  // ============================================

  async createProduct(data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.inventarioUrl}/api/products`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error creating product:', error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al crear producto',
      };
    }
  }

  async getProducts(filters: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products`, { params: filters })
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error getting products:', error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener productos',
      };
    }
  }

  async getProductById(id: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/${id}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting product ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener producto ${id}`,
      };
    }
  }

  async getProductByCode(code: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/code/${code}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting product by code ${code}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener producto por código ${code}`,
      };
    }
  }

  async updateProduct(id: string, data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.put(`${this.inventarioUrl}/api/products/${id}`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error updating product ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al actualizar producto ${id}`,
      };
    }
  }

  async inventoryMovement(id: string, data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.patch(`${this.inventarioUrl}/api/products/${id}/inventory`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error inventory movement for product ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error en movimiento de inventario para producto ${id}`,
      };
    }
  }

  async deleteProduct(id: string) {
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.inventarioUrl}/api/products/${id}`)
      );
      return { message: 'Producto eliminado' };
    } catch (error: any) {
      this.logger.error(`Error deleting product ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al eliminar producto ${id}`,
      };
    }
  }

  async restoreProduct(id: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.patch(`${this.inventarioUrl}/api/products/${id}/restore`, {})
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error restoring product ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al restaurar producto ${id}`,
      };
    }
  }

  async getStats() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/stats`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error getting stats:', error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener estadísticas',
      };
    }
  }

  async getLowStock() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/low-stock`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error getting low stock products:', error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener productos con stock bajo',
      };
    }
  }

  async getProductsByDeviceId(deviceId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/device/${deviceId}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting products by device ${deviceId}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener productos por dispositivo ${deviceId}`,
      };
    }
  }

  // ============================================
  // ✅ CATEGORÍAS
  // ============================================

  async createCategory(data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.inventarioUrl}/api/categories`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error creating category:', error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al crear categoría',
      };
    }
  }

  async getCategories(filters: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/categories`, { params: filters })
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error getting categories:', error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener categorías',
      };
    }
  }

  async getCategoryById(id: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/categories/${id}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting category ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener categoría ${id}`,
      };
    }
  }

  async updateCategory(id: string, data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.put(`${this.inventarioUrl}/api/categories/${id}`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error updating category ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al actualizar categoría ${id}`,
      };
    }
  }

  async deleteCategory(id: string) {
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.inventarioUrl}/api/categories/${id}`)
      );
      return { message: 'Categoría eliminada' };
    } catch (error: any) {
      this.logger.error(`Error deleting category ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al eliminar categoría ${id}`,
      };
    }
  }

  // ============================================
  // ✅ MOVIMIENTOS
  // ============================================

  async getMovementsByProduct(productId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/movements/product/${productId}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting movements for product ${productId}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener movimientos del producto ${productId}`,
      };
    }
  }

  async getMovementsByOrder(orderId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/movements/order/${orderId}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting movements for order ${orderId}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener movimientos de la orden ${orderId}`,
      };
    }
  }

  async getMovementById(id: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/movements/${id}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting movement ${id}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener movimiento ${id}`,
      };
    }
  }

  // ============================================
  // ✅ INVENTARIO DESDE ORDEN
  // ============================================

  async createInventoryFromOrder(data: any) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.inventarioUrl}/api/products/from-order`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error creating inventory from order:', error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al crear inventario desde orden',
      };
    }
  }

  async getInventoryByOrder(orderId: string) {
    try {
      // ✅ Asegurar que el orderId se pasa correctamente
      this.logger.log(`📤 [Gateway] getInventoryByOrder: ${orderId}`);
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/by-order/${orderId}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`Error getting inventory by order ${orderId}:`, error.message);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener inventario de la orden ${orderId}`,
      };
    }
  }

  // ============================================
  // ✅ NUEVOS MÉTODOS PARA TYPES, BRANDS, COLORS, GENERATE SKU
  // ============================================

  /**
   * Obtener todos los tipos de inventario
   */
  async getTypes(): Promise<any> {
    this.logger.log(`📤 [Gateway] getTypes`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/income-backend/types`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getTypes: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener tipos',
      };
    }
  }

  /**
   * Obtener todas las marcas
   */
  async getBrands(): Promise<any> {
    this.logger.log(`📤 [Gateway] getBrands`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/income-backend/brands`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getBrands: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener marcas',
      };
    }
  }

  /**
   * Obtener todos los colores
   */
  async getColors(): Promise<any> {
    this.logger.log(`📤 [Gateway] getColors`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/income-backend/colors`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getColors: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener colores',
      };
    }
  }

  /**
   * Obtener todas las calidades
   */
  async getQualities(): Promise<any> {
    this.logger.log(`📤 [Gateway] getQualities`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/income-backend/qualities`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getQualities: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener calidades',
      };
    }
  }

  /**
   * Obtener todos los inventarios disponibles
   */
  async getInventories(): Promise<any> {
    this.logger.log(`📤 [Gateway] getInventories`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/income-backend/inventories`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getInventories: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener inventarios',
      };
    }
  }

  /**
   * Generar SKU
   */
  async generateSku(data: { typeId: string; brandId: string; colorId: string; inventoryName?: string }): Promise<any> {
    this.logger.log(`📤 [Gateway] generateSku - typeId: ${data.typeId}, brandId: ${data.brandId}, colorId: ${data.colorId}`);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.inventarioUrl}/api/income-backend/generate-sku`, data)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error generateSku: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al generar SKU',
      };
    }
  }

  // ============================================
  // ✅ NUEVOS MÉTODOS PARA BODEGA
  // ============================================

  /**
   * Obtener órdenes para bodega (status_id = 9)
   * CONSULTA AL SERVICIO DE ÓRDENES
   */
  async getOrdersForWarehouse(): Promise<any> {
    this.logger.log(`📤 [Gateway] getOrdersForWarehouse - Consultando: ${this.ordersServiceUrl}/orders/list`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.ordersServiceUrl}/orders/list`, {
          params: {
            page: 1,
            limit: 100,
            orderStatusId: 9
          }
        })
      );
      
      this.logger.log(`✅ [Gateway] ${response.data?.data?.length || 0} órdenes encontradas`);
      return response.data;
      
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getOrdersForWarehouse: ${error.message}`);
      
      // ❌ SIN DATOS DE PRUEBA - LANZAR ERROR REAL
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al obtener órdenes para bodega',
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Obtener detalles de una orden específica
   * CONSULTA AL SERVICIO DE ÓRDENES
   */
  async getOrderDetails(orderId: string): Promise<any> {
    this.logger.log(`📤 [Gateway] getOrderDetails: ${orderId}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.ordersServiceUrl}/orders/${orderId}`)
      );
      return response.data;
      
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getOrderDetails ${orderId}: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener detalles de la orden ${orderId}`,
      };
    }
  }

  /**
   * Obtener inventario existente de una orden
   * CONSULTA AL MICROSERVICIO DE INVENTARIO
   */
  async getInventoryByOrderFromIncome(orderId: string): Promise<any> {
    this.logger.log(`📤 [Gateway] getInventoryByOrderFromIncome: ${orderId}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/by-order/${orderId}`)
      );
      return response.data;
      
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getInventoryByOrderFromIncome ${orderId}: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener inventario de la orden ${orderId}`,
      };
    }
  }

  /**
   * Guardar inventario desde una orden
   * GUARDA EN EL MICROSERVICIO DE INVENTARIO
   */
  async saveInventoryFromOrder(payload: any): Promise<any> {
    this.logger.log(`📤 [Gateway] saveInventoryFromOrder - OrderId: ${payload.orderId}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.inventarioUrl}/api/income-backend/inventory/save`, payload)
      );
      this.logger.log(`✅ [Gateway] Inventario guardado correctamente`);
      return response.data;
      
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error saveInventoryFromOrder: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al guardar inventario',
      };
    }
  }

  /**
   * Obtener partes disponibles para una orden
   * CONSULTA AL MICROSERVICIO DE INVENTARIO
   */
  async getAvailableParts(orderId: string): Promise<any> {
    this.logger.log(`📤 [Gateway] getAvailableParts: ${orderId}`);
    
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/income-backend/parts/available/${orderId}`)
      );
      return response.data;
      
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getAvailableParts ${orderId}: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener partes disponibles para la orden ${orderId}`,
      };
    }
  }

  /**
   * Buscar ítems en inventory flow
   */
  async searchInventoryFlowItems(query: any): Promise<any> {
    this.logger.log(`📤 [Gateway] searchInventoryFlowItems - q: ${query.q}, inventoryId: ${query.inventoryId}`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/income-backend/search-inventory-flow`, { 
          params: query 
        })
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error searchInventoryFlowItems: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al buscar ítems en inventory flow',
      };
    }
  }

  /**
   * Obtener inventory flow por ID
   */
  async getInventoryFlowById(id: string): Promise<any> {
    this.logger.log(`📤 [Gateway] getInventoryFlowById: ${id}`);
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.inventarioUrl}/api/products/inventory-flow/${id}`)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error getInventoryFlowById: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || `Error al obtener inventory flow ${id}`,
      };
    }
  }

  /**
   * Crear producto desde inventory flow existente
   */
  async createProductFromInventoryFlow(payload: any): Promise<any> {
    this.logger.log(`📤 [Gateway] createProductFromInventoryFlow - inventoryFlowId: ${payload.inventoryFlowId}`);
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.inventarioUrl}/api/products/from-inventory-flow`, payload)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ [Gateway] Error createProductFromInventoryFlow: ${error.message}`);
      throw {
        statusCode: error.response?.status || 500,
        message: error.response?.data?.message || error.message || 'Error al crear producto desde inventory flow',
      };
    }
  }
}