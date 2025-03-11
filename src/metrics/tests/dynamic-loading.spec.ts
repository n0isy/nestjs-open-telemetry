import { Test, TestingModule } from '@nestjs/testing'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PrometheusExporterInterface } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'

/**
 * Tests the dynamic loading mechanism by simulating PrometheusExporter
 * presence and absence through the OpenTelemetryService directly
 */
describe('module Dynamic Loading', () => {
  let service: OpenTelemetryService

  beforeEach(async () => {
    // Create a test module with OpenTelemetryService
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NodeSDK,
          useValue: {
            shutdown: jest.fn().mockResolvedValue(undefined),
          },
        },
        OpenTelemetryService,
      ],
    }).compile()

    service = module.get<OpenTelemetryService>(OpenTelemetryService)
  })

  it('should use fallback when exporter is not set', () => {
    // Without setting an exporter
    const metrics = service.collectMetrics()
    expect(metrics).toContain('Metrics collection is not available')
  })

  it('should use exporter when available', () => {
    // Create a mock exporter
    const mockExporter: PrometheusExporterInterface = {
      getMetrics: jest.fn().mockReturnValue('# MOCK metric{service="test"} 42'),
    }

    // Set the mock exporter
    service.setMetricsExporter(mockExporter)

    // Get metrics
    const metrics = service.collectMetrics()

    // Verify the mock was used
    expect(mockExporter.getMetrics).toHaveBeenCalled()
    expect(metrics).toBe('# MOCK metric{service="test"} 42')
  })

  it('should handle errors from exporter', () => {
    // Set an exporter that throws errors
    service.setMetricsExporter({
      getMetrics: () => { throw new Error('Test error') },
    })

    // Get metrics - should handle the error
    const metrics = service.collectMetrics()
    expect(metrics).toContain('Error collecting metrics: Test error')
  })
})
