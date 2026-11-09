import { Controller, Get } from '@nestjs/common';
import { Auth } from '../../common/auth/decorators/auth.decorator';
import { User } from '../../common/auth/decorators/user.decorator';
import { EmployeesService } from './employees.service';

@Controller('employees')
@Auth()
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    // GET /employees/basic  → [{ id, username, name }]
    @Get('basic')
    listBasic(@User() user: any) {
        return this.employeesService.listBasic({
            userId: user.sub,
            companyId: user.companyId,
            branchId: user.branchId,
        });
    }
}