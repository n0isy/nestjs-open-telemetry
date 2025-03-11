import { Test, TestingModule } from '@nestjs/testing'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PrometheusExporterInterface } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'

// Mock PrometheusExporter for testing
class MockPrometheusExporter implements PrometheusExporterInterface {
  private prefix: string = ''

  constructor() {
    // No longer using mockMetrics
  }

  async collect(): Promise<{ resourceMetrics: any, errors: unknown[] }> {
    // Create mock resource metrics and errors
    return {
      resourceMetrics: {
        resource: {
          attributes: {
            service: 'test',
          },
        },
        scopeMetrics: [{
          scope: { name: 'test' },
          metrics: [
            {
              descriptor: {
                name: 'test_metric',
                description: 'Test metric description',
                type: 'COUNTER',
              },
              dataPoints: [{
                value: 42,
                attributes: {
                  service: 'test',
                  ...(this.prefix ? { prefix: this.prefix } : {}),
                },
              }],
            },
          ],
        }],
      },
      errors: [],
    }
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix
  }
}

describe('prometheus Integration', () => {
  let service: OpenTelemetryService
  let exporter: MockPrometheusExporter

  beforeEach(async () => {
    // Create mock exporter with specific metrics
    exporter = new MockPrometheusExporter()

    // Create testing module
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

    // Set the exporter on the service
    service.setMetricsExporter(exporter)
  })

  it('should return fallback message when no exporter is set', async () => {
    // Create a new service instance without setting an exporter
    const newModule: TestingModule = await Test.createTestingModule({
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

    const newService = newModule.get<OpenTelemetryService>(OpenTelemetryService)

    // Service should return fallback message when no exporter is set
    const metrics = await newService.collectMetrics()
    expect(metrics).toContain('# Metrics collection is not available')
  })

  it('should return metrics from exporter', async () => {
    const metrics = await service.collectMetrics()
    expect(metrics).toContain('test_metric')
    expect(metrics).toContain('42')
    expect(metrics).toContain('service="test"')
  })

  it('should handle different metric types correctly', async () => {
    // Mock a more complex response with different metric types
    jest.spyOn(exporter, 'collect').mockImplementationOnce(async () => ({
      resourceMetrics: {
        resource: {
          attributes: {
            service: 'test',
          },
        },
        scopeMetrics: [{
          scope: { name: 'test' },
          metrics: [
            {
              descriptor: {
                name: 'test_counter',
                description: 'Test counter description',
                type: 'COUNTER',
              },
              dataPoints: [{
                value: 123,
                attributes: { service: 'test' },
              }],
            },
            {
              descriptor: {
                name: 'test_gauge',
                description: 'Test gauge description',
                type: 'GAUGE',
              },
              dataPoints: [{
                value: 45.6,
                attributes: { service: 'test' },
              }],
            },
            {
              descriptor: {
                name: 'test_histogram',
                description: 'Test histogram description',
                type: 'HISTOGRAM',
              },
              dataPoints: [{
                attributes: { service: 'test' },
                buckets: [
                  { boundary: 10, count: 10 },
                  { boundary: 20, count: 15 },
                  { boundary: Infinity, count: 20 },
                ],
                sum: 256.1,
                count: 20,
              }],
            },
          ],
        }],
      },
      errors: [],
    }))

    const metrics = await service.collectMetrics()

    // Should include all different metric types
    expect(metrics).toContain('test_counter')
    expect(metrics).toContain('test_gauge')
    expect(metrics).toContain('test_histogram')

    // Check specific values and formats
    expect(metrics).toContain('test_counter{service="test"} 123')
    expect(metrics).toContain('test_gauge{service="test"} 45.6')
    expect(metrics).toContain('test_histogram_bucket{service="test",le="+Inf"} 20')
  })

  it('should handle errors from exporter', async () => {
    // Create a broken exporter that throws errors
    const brokenExporter: PrometheusExporterInterface = {
      collect: async () => {
        throw new Error('Metrics collection failed')
      },
    }

    service.setMetricsExporter(brokenExporter)

    // Should gracefully handle the error
    const metrics = await service.collectMetrics()
    expect(metrics).toContain('Error collecting metrics: Metrics collection failed')
  })
})
