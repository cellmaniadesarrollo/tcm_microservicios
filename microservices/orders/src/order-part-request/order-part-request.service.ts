import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreatePartRequestDto } from './dto/create-part-request.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PartRequest } from './entities/part-request.entity';
import { EntityManager, ILike, In, Repository } from 'typeorm';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
// import { NotificationsService } from '../notifications/notifications.service';
// import { BroadcastService } from '../broadcast/broadcast.service';
import { Order } from '../order-workflow/entities/order.entity';
import { RpcException } from '@nestjs/microservices';
import { PartRequestStatus, PartRequestType } from './entities/enums/part-request-status.enum';
import { Attachment, AttachmentEntityType } from '../order-findings/entities/attachment.entity';
import { PartRequestStatusHistory } from './entities/part-request-status-history.entity';
import { mapUser, enrichPartRequestAttachmentsWithSignedUrls } from './helpers/part-requests.helpers';
import { ListPartRequestsDto } from './dto/list-part-requests.dto';
import { EncontradoNacionalDto } from './dto/encontrado-nacional.dto';
import { PartRequestSourcing } from './entities/part-request-sourcing.entity';
import { CreatePartRequestPaymentDto } from './dto/create-part-request-payment.dto';
import { PartRequestPayment } from './entities/part-request-payment.entity';
import { PartRequestShipping } from './entities/part-request-shipping.entity';
import { RegistrarEnvioGatewayDto } from './dto/registrar-envio-gateway.dto';
import { OrderPendingProduct } from '../order-extras/entities/order-pending-product.entity';
import { PartRequestArrival } from './entities/part-request-arrival.entity';
import { RegistrarLlegadaDto } from './dto/registrar-llegada.dto';
import { AprobarLlegadaDto } from './dto/aprobar-llegada.dto';
import { NoAprobarLlegadaDto } from './dto/no-aprobar-llegada.dto';
import { SearchProvidersDto } from './entities/search-providers.dto';
import { Provider } from './entities/provider.entity';
import { ProviderAccount } from './entities/provider-account.entity';
import { SourcingProviderAccount } from './entities/sourcing-provider-account.entity';
export const GRUPOS_CON_ACCESO_ESPERA_PAGO = [
    'ADMINS',
    'ORDER_AUDIT',
    'COMPANY_ADMIN',
];
@Injectable()
export class OrderPartRequestService {


}