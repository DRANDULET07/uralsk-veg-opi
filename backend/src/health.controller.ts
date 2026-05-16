import { Controller, Get } from '@nestjs/common'

interface HealthResponse {
  status: 'ok'
  service: string
  checkedAt: string
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'uralsk-veg-opi-backend',
      checkedAt: new Date().toISOString(),
    }
  }
}
