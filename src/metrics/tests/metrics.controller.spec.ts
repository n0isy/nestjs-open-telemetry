import { Controller } from '@nestjs/common/interfaces'
import { Test, TestingModule } from '@nestjs/testing'
import { SDK_CONFIG } from '../../open-telemetry.enums'
import { OpenTelemetryModuleConfig } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'
import { createMetricsController } from '../controller/metrics.controller'

describe('metricsController', () => {
  let controller: Controller
  let openTelemetryService: OpenTelemetryService

  // Mock config with no authentication
  const mockConfig: Partial<OpenTelemetryModuleConfig> = {
    metrics: {
      enabled: true,
      endpoint: '/metrics',
    },
  }

  it('should return metrics from OpenTelemetryService', async () => {
    // Create testing module with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      controllers: [createMetricsController('/metrics')],
      providers: [
        {
          provide: OpenTelemetryService,
          useValue: {
            collectMetrics: jest.fn().mockReturnValue('test_metric 123'),
          },
        },
        {
          provide: SDK_CONFIG,
          useValue: mockConfig,
        },
      ],
    }).compile()
    const ControllerClass = createMetricsController('/metrics')
    openTelemetryService = module.get<OpenTelemetryService>(OpenTelemetryService)
    controller = new ControllerClass(openTelemetryService, mockConfig)

    const metrics = await (controller as any).getMetrics({})
    expect(metrics).toBe('test_metric 123')
    expect(openTelemetryService.collectMetrics).toHaveBeenCalled()
  })
})
