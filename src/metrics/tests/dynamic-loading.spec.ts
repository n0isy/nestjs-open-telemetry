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

  it('should use fallback when exporter is not set', async () => {
    // Without setting an exporter
    const metrics = await service.collectMetrics()
    expect(metrics).toContain('Metrics collection is not available')
  })

  it('should use exporter when available', async () => {
    // Create a mock exporter
    const mockExporter: PrometheusExporterInterface = {
      collect: jest.fn().mockResolvedValue({
        resourceMetrics: {
          resource: { attributes: { service: 'test' } },
          scopeMetrics: [{
            scope: { name: 'test' },
            metrics: [{
              descriptor: { name: 'mock_metric', type: 'COUNTER' },
              dataPoints: [{ value: 42, attributes: { service: 'test' } }],
            }],
          }],
        },
        errors: [],
      }),
    }

    // Set the mock exporter
    service.setMetricsExporter(mockExporter)

    // Manually initialize the PrometheusSerializer
    // eslint-disable-next-line ts/no-require-imports
    const { PrometheusSerializer } = require('@opentelemetry/exporter-prometheus')
    service['prometheusSerializer'] = new PrometheusSerializer('', false)

    // Get metrics
    const metrics = await service.collectMetrics()

    // Verify the mock was used
    expect(mockExporter.collect).toHaveBeenCalled()
    expect(metrics).toContain('mock_metric_total')
    expect(metrics).toContain('service="test"')
    expect(metrics).toContain('target_info')
  })

  it('should handle errors from exporter', async () => {
    // Set an exporter that throws errors
    service.setMetricsExporter({
      collect: async () => { throw new Error('Test error') },
    })

    // Initialize the PrometheusSerializer for this test too
    // eslint-disable-next-line ts/no-require-imports
    const { PrometheusSerializer } = require('@opentelemetry/exporter-prometheus')
    service['prometheusSerializer'] = new PrometheusSerializer('', false)

    // Get metrics - should handle the error
    const metrics = await service.collectMetrics()
    expect(metrics).toContain('Error collecting metrics: Test error')
  })
})
