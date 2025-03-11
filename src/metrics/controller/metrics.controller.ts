import { Controller, Get, Header, Inject, Req, UnauthorizedException } from '@nestjs/common'
import { SDK_CONFIG } from '../../open-telemetry.enums'
import { GenericRequest, OpenTelemetryModuleConfig } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'

/**
 * Controller to expose metrics endpoint.
 * This will be conditionally registered based on module configuration.
 */
@Controller()
export class MetricsController {
  constructor(
    private readonly openTelemetryService: OpenTelemetryService,
    @Inject(SDK_CONFIG) private readonly config: OpenTelemetryModuleConfig,
  ) {}

  /**
   * Endpoint to expose metrics in Prometheus format.
   * Uses the configured endpoint path from module options.
   */
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(@Req() req: any): Promise<string> {
    const authFn = this.config.metrics?.authentication

    // If authentication function is provided, check authentication
    if (authFn && !authFn(req as GenericRequest)) {
      throw new UnauthorizedException('Unauthorized access to metrics')
    }

    // Collect metrics from meter provider
    return this.openTelemetryService.collectMetrics()
  }
}
