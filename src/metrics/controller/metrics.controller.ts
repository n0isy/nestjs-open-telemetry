import { Controller, Get, Header, Inject, Req, UnauthorizedException } from '@nestjs/common'
import { SDK_CONFIG } from '../../open-telemetry.enums'
import { GenericRequest, OpenTelemetryModuleConfig } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'

export function createMetricsController(path: string) {
  @Controller()
  class MetricsController {
    constructor(
      readonly openTelemetryService: OpenTelemetryService,
      @Inject(SDK_CONFIG) readonly config: OpenTelemetryModuleConfig,
    ) {}

    @Get(path)
    @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    async getMetrics(@Req() req: any): Promise<string> {
      const authFn = this.config.metrics?.authentication

      if (authFn && !authFn(req as GenericRequest)) {
        throw new UnauthorizedException('Unauthorized access to metrics')
      }

      // Collect metrics from the meter provider
      return await this.openTelemetryService.collectMetrics()
    }
  }
  return MetricsController
}
