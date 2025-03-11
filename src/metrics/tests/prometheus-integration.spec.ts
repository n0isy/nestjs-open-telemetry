import { Test, TestingModule } from '@nestjs/testing'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PrometheusExporterInterface } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'

// Mock PrometheusExporter for testing
class MockPrometheusExporter implements PrometheusExporterInterface {
  private prefix: string = ''
  private _mockMetrics: string = ''

  constructor(mockMetrics: string = '') {
    this._mockMetrics = mockMetrics
  }

  getMetrics(): string {
    // Format mimics Prometheus output format
    return this._mockMetrics || `# HELP test_metric Test metric description
# TYPE test_metric counter
test_metric{${this.prefix ? `prefix="${this.prefix}",` : ''}service="test"} 42
`
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix
  }

  // Additional method for testing - not part of interface
  setMockMetrics(metrics: string): void {
    this._mockMetrics = metrics
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
    const metrics = newService.collectMetrics()
    expect(metrics).toContain('# Metrics collection is not available')
  })

  it('should return metrics from exporter', () => {
    const metrics = service.collectMetrics()
    expect(metrics).toContain('test_metric')
    expect(metrics).toContain('42')
    expect(metrics).toContain('service="test"')
  })

  it('should handle different metric types correctly', () => {
    // Set mock metrics with different types
    exporter.setMockMetrics(`# HELP test_counter Test counter description
# TYPE test_counter counter
test_counter{service="test"} 123

# HELP test_gauge Test gauge description
# TYPE test_gauge gauge
test_gauge{service="test"} 45.6

# HELP test_histogram Test histogram description
# TYPE test_histogram histogram
test_histogram_bucket{service="test",le="10"} 10
test_histogram_bucket{service="test",le="20"} 15
test_histogram_bucket{service="test",le="+Inf"} 20
test_histogram_sum{service="test"} 256.1
test_histogram_count{service="test"} 20
`)

    const metrics = service.collectMetrics()

    // Should include all different metric types
    expect(metrics).toContain('test_counter')
    expect(metrics).toContain('test_gauge')
    expect(metrics).toContain('test_histogram')

    // Check specific values and formats
    expect(metrics).toContain('test_counter{service="test"} 123')
    expect(metrics).toContain('test_gauge{service="test"} 45.6')
    expect(metrics).toContain('test_histogram_bucket{service="test",le="+Inf"} 20')
  })

  it('should handle errors from exporter', () => {
    // Create a broken exporter that throws errors
    const brokenExporter: PrometheusExporterInterface = {
      getMetrics: () => {
        throw new Error('Metrics collection failed')
      },
    }

    service.setMetricsExporter(brokenExporter)

    // Should gracefully handle the error
    const metrics = service.collectMetrics()
    expect(metrics).toContain('Error collecting metrics: Metrics collection failed')
  })
})
