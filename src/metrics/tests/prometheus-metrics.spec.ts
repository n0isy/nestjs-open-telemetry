import { Test } from '@nestjs/testing'
import { Attributes, metrics } from '@opentelemetry/api'
import { PrometheusExporter, PrometheusSerializer } from '@opentelemetry/exporter-prometheus'
import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { OpenTelemetryService } from '../../open-telemetry.service'
import { MetricsController } from '../controller/metrics.controller'

describe('prometheus Metrics Integration', () => {
  let openTelemetryService: OpenTelemetryService
  let metricsController: MetricsController
  let exporter: PrometheusExporter

  beforeAll(async () => {
    // Set up the MeterProvider and PrometheusExporter for testing
    const meterProvider = new MeterProvider()

    // Create the exporter with proper setup
    exporter = new PrometheusExporter({
      preventServerStart: true,
      prefix: 'test_',
    })

    // Connect the exporter to the meter provider
    meterProvider.addMetricReader(exporter)

    // Set the global meter provider
    metrics.setGlobalMeterProvider(meterProvider)

    // Create a test module with our OpenTelemetry module
    const moduleRef = await Test.createTestingModule({
      imports: [
        OpenTelemetryModule.forRoot({
          metrics: {
            enabled: true,
            controller: true,
            prefix: 'test_',
          },
        }),
      ],
    }).compile()

    // Get the instances we need to test
    openTelemetryService = moduleRef.get<OpenTelemetryService>(OpenTelemetryService)
    metricsController = moduleRef.get<MetricsController>(MetricsController)

    // Set up the exporter directly in our service
    openTelemetryService['metricsExporter'] = exporter

    // Initialize the PrometheusSerializer
    // eslint-disable-next-line ts/no-require-imports
    const { PrometheusSerializer } = require('@opentelemetry/exporter-prometheus')
    openTelemetryService['prometheusSerializer'] = new PrometheusSerializer('', false)
  })

  afterAll(async () => {
    // Clean up
    const sdk = await Test.createTestingModule({
      imports: [OpenTelemetryModule.forRoot()],
    }).compile().then(mod => mod.get<NodeSDK>(NodeSDK))

    await sdk.shutdown()
  })

  it('should create and collect counter metrics', async () => {
    // Create a counter metric
    const counter = openTelemetryService.createCounter('test_counter', {
      description: 'Test counter for integration test',
    })

    // Add some data to the counter with attributes
    const attributes: Attributes = {
      label1: 'value1',
      label2: 'value2',
    }

    counter.add(1, attributes)
    counter.add(2, attributes)

    // Collect metrics
    const metricsOutput = await openTelemetryService.collectMetrics()

    // Verify the output contains our counter
    expect(metricsOutput).toContain('test_counter_total')
    expect(metricsOutput).toContain('Test counter for integration test')
    expect(metricsOutput).toContain('label1="value1"')
    expect(metricsOutput).toContain('label2="value2"')
    expect(metricsOutput).toMatch(/test_counter_total.*3/) // Total should be 3
  })

  it('should create and collect histogram metrics', async () => {
    // Create a histogram metric
    const histogram = openTelemetryService.createHistogram('test_histogram', {
      description: 'Test histogram for integration test',
      unit: 'ms',
    })

    // Record some values
    const attributes: Attributes = {
      operation: 'db_query',
    }

    histogram.record(100, attributes)
    histogram.record(200, attributes)
    histogram.record(300, attributes)

    // Collect metrics
    const metricsOutput = await openTelemetryService.collectMetrics()

    // Verify the output contains our histogram buckets
    expect(metricsOutput).toContain('test_histogram')
    expect(metricsOutput).toContain('Test histogram for integration test')
    expect(metricsOutput).toContain('operation="db_query"')
    expect(metricsOutput).toContain('_count')
    expect(metricsOutput).toContain('_sum')

    // Count should be 3
    expect(metricsOutput).toMatch(/test_histogram_count.*3/)

    // Sum should be 600
    expect(metricsOutput).toMatch(/test_histogram_sum.*600/)
  })

  it('should collect metrics through the controller', async () => {
    // Create a request mock
    const reqMock = {}

    // Get metrics through the controller
    const controllerOutput = await metricsController.getMetrics(reqMock)

    // Verify the output contains our metrics
    expect(controllerOutput).toContain('test_counter_total')
    expect(controllerOutput).toContain('test_histogram')
  })

  it('should create and collect up-down counter metrics', async () => {
    // Create an up-down counter
    const upDownCounter = openTelemetryService.createUpDownCounter('test_updown_counter', {
      description: 'Test up-down counter for integration test',
    })

    // Add and subtract values
    upDownCounter.add(10, { direction: 'up' })
    upDownCounter.add(5, { direction: 'up' })
    upDownCounter.add(-3, { direction: 'down' })

    // Collect metrics
    const metricsOutput = await openTelemetryService.collectMetrics()

    // Verify the output contains our up-down counter
    expect(metricsOutput).toContain('test_updown_counter')
    expect(metricsOutput).toContain('Test up-down counter for integration test')

    // Values for the two different attribute sets
    expect(metricsOutput).toContain('direction="up"')
    expect(metricsOutput).toContain('direction="down"')
  })

  it('should create and collect observable gauge metrics', async () => {
    // Create an observable gauge
    const observableGauge = openTelemetryService.createObservableGauge('test_gauge', {
      description: 'Test gauge for integration test',
    })

    // Set up the observable
    let gaugeValue = 42
    observableGauge.addCallback((observableResult) => {
      observableResult.observe(gaugeValue, { source: 'test' })
    })

    // Collect metrics
    const metricsOutput = await openTelemetryService.collectMetrics()

    // Verify the output contains our gauge
    expect(metricsOutput).toContain('test_gauge')
    expect(metricsOutput).toContain('Test gauge for integration test')
    expect(metricsOutput).toContain('source="test"')
    expect(metricsOutput).toMatch(/test_gauge.*42/)

    // Update the gauge value and collect again
    gaugeValue = 84
    const updatedMetricsOutput = await openTelemetryService.collectMetrics()

    // Verify the gauge value has been updated
    expect(updatedMetricsOutput).toMatch(/test_gauge.*84/)
  })

  it('should handle serializer options correctly', async () => {
    // Create a new serializer with specific options
    const serializer = new PrometheusSerializer('custom_', true)

    // Create a counter
    const counter = openTelemetryService.createCounter('prefixed_counter', {
      description: 'Counter with custom prefix',
    })
    counter.add(1)

    // Collect data using the exporter
    const { resourceMetrics } = await exporter.collect()

    // Serialize with custom serializer
    const customOutput = serializer.serialize(resourceMetrics)

    // The output should have the custom prefix
    expect(customOutput).toContain('custom__prefixed_counter')

    // The timestamp should be included (appendTimestamp true)
    expect(customOutput).toMatch(/\d{10,}/)
  })
})
