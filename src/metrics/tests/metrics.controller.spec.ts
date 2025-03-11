import { UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { SDK_CONFIG } from '../../open-telemetry.enums'
import { OpenTelemetryModuleConfig } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'
import { MetricsController } from '../controller/metrics.controller'

describe('metricsController', () => {
  let controller: MetricsController
  let openTelemetryService: OpenTelemetryService

  // Mock config with no authentication
  const mockConfig: Partial<OpenTelemetryModuleConfig> = {
    metrics: {
      enabled: true,
      endpoint: '/metrics',
    },
  }

  // Mock config with authentication
  const mockConfigWithAuth: Partial<OpenTelemetryModuleConfig> = {
    metrics: {
      enabled: true,
      endpoint: '/metrics',
      authentication: (req: any) => req.authorized === true,
    },
  }

  beforeEach(async () => {
    // Create testing module with mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
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

    controller = module.get<MetricsController>(MetricsController)
    openTelemetryService = module.get<OpenTelemetryService>(OpenTelemetryService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should return metrics from OpenTelemetryService', async () => {
    const metrics = await controller.getMetrics({})
    expect(metrics).toBe('test_metric 123')
    expect(openTelemetryService.collectMetrics).toHaveBeenCalled()
  })

  describe('with authentication', () => {
    beforeEach(async () => {
      // Create testing module with auth config
      const module: TestingModule = await Test.createTestingModule({
        controllers: [MetricsController],
        providers: [
          {
            provide: OpenTelemetryService,
            useValue: {
              collectMetrics: jest.fn().mockReturnValue('test_metric 123'),
            },
          },
          {
            provide: SDK_CONFIG,
            useValue: mockConfigWithAuth,
          },
        ],
      }).compile()

      controller = module.get<MetricsController>(MetricsController)
      openTelemetryService = module.get<OpenTelemetryService>(OpenTelemetryService)
    })

    it('should return metrics when authentication succeeds', async () => {
      const req = { authorized: true }
      const metrics = await controller.getMetrics(req)
      expect(metrics).toBe('test_metric 123')
    })

    it('should throw UnauthorizedException when authentication fails', async () => {
      const req = { authorized: false }
      await expect(controller.getMetrics(req)).rejects.toThrow(UnauthorizedException)
    })
  })
})
