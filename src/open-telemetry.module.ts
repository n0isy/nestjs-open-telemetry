import type { DynamicModule, FactoryProvider, ValueProvider } from '@nestjs/common'
import type { OpenTelemetryModuleAsyncOption, OpenTelemetryModuleConfig, PrometheusExporterInterface } from './open-telemetry.interface'
import type { Injector } from './trace/injectors'
import { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { MetricsController } from './metrics/controller'
import { UniversalHttpMetricsMiddleware } from './metrics/middleware'
import {
  defaultConfig,
} from './open-telemetry.constants'
import { SDK_CONFIG, SDK_INJECTORS } from './open-telemetry.enums'
import { OpenTelemetryService } from './open-telemetry.service'

export class OpenTelemetryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(UniversalHttpMetricsMiddleware)
      .forRoutes('*')
  }

  public static forRoot(
    config: Partial<OpenTelemetryModuleConfig> = {},
  ): DynamicModule {
    config.resource = defaultConfig.resource?.merge(config.resource ?? new Resource({}))
    config = { ...defaultConfig, ...config }
    const injectors = config?.autoInjectors ?? []
    if (!config.instrumentations)
      config.instrumentations = getNodeAutoInstrumentations()

    // Set up providers array
    const providers = [
      ...injectors,
      OpenTelemetryService,
      this.buildProvider(config),
      this.buildInjectors(config),
      UniversalHttpMetricsMiddleware,
      {
        provide: SDK_CONFIG,
        useValue: config,
      },
    ]

    // Configure exports
    const exports = [
      OpenTelemetryService,
    ]

    // Set up controllers array if metrics controller is enabled
    const controllers: any[] = []
    if (config.metrics?.enabled && config.metrics?.controller) {
      // Create a metrics exporter
      // Try to load PrometheusExporter dynamically to avoid breaking when it's not installed
      let metricsExporter: PrometheusExporterInterface

      try {
        // Using dynamic import to check if the package is available
        // eslint-disable-next-line ts/no-require-imports
        const prometheusModule = require('@opentelemetry/exporter-prometheus')
        const PrometheusExporter = prometheusModule.PrometheusExporter

        // Create the exporter with preventServerStart: true to prevent HTTP server
        metricsExporter = new PrometheusExporter({
          preventServerStart: true,
          prefix: config.metrics?.prefix || '',
        })
      }
      catch {
        // PrometheusExporter not available, use fallback
        metricsExporter = {
          collect: async () => ({
            resourceMetrics: { resource: {}, scopeMetrics: [] },
            errors: [] as unknown[],
          }),
          setPrefix: (_unused: string) => { /* no-op */ },
        }
      }

      // Add the exporter provider
      providers.push({
        provide: 'PROMETHEUS_EXPORTER',
        useValue: metricsExporter,
      })

      // Add the exporter setup factory
      providers.push({
        provide: 'METRICS_EXPORTER_SETUP',
        useFactory: (service: OpenTelemetryService, exporter: PrometheusExporterInterface) => {
          service.setMetricsExporter(exporter)
        },
        inject: [OpenTelemetryService, 'PROMETHEUS_EXPORTER'],
      })

      // Add the metrics controller with configured path
      const metricsPath = config.metrics?.endpoint?.startsWith('/')
        ? config.metrics.endpoint.substring(1)
        : config.metrics.endpoint || 'metrics'

      controllers.push({
        type: MetricsController,
        path: metricsPath,
      })
    }

    return {
      global: true,
      module: OpenTelemetryModule,
      imports: [],
      controllers,
      providers,
      exports,
    }
  }

  private static buildProvider(
    configuration?: Partial<OpenTelemetryModuleConfig>,
  ): ValueProvider {
    const sdk = new NodeSDK(configuration)
    sdk.start()
    return {
      provide: NodeSDK,
      useValue: sdk,
    }
  }

  private static buildInjectors(
    configuration?: Partial<OpenTelemetryModuleConfig>,
  ): FactoryProvider {
    const injectors = configuration?.autoInjectors ?? []
    return {
      provide: SDK_INJECTORS,
      useFactory: (...injectors: Injector[]) => {
        for (const injector of injectors) {
          if (injector['inject'])
            injector.inject()
        }
      },
      inject: [
        ...injectors,
      ],
    }
  }

  public static forRootAsync(
    configuration: OpenTelemetryModuleAsyncOption,
  ): DynamicModule {
    return {
      global: true,
      module: OpenTelemetryModule,
      imports: [...(configuration?.imports ?? [])],
      providers: [
        OpenTelemetryService,
        UniversalHttpMetricsMiddleware,
        this.buildAsyncProvider(),
        this.buildAsyncInjectors(),
        {
          provide: SDK_CONFIG,
          useFactory: configuration.useFactory,
          inject: configuration.inject,
        },
        {
          provide: 'PROMETHEUS_EXPORTER',
          useFactory: (config: OpenTelemetryModuleConfig) => {
            if (config.metrics?.enabled && config.metrics?.controller) {
              // Try to load PrometheusExporter dynamically
              try {
                // eslint-disable-next-line ts/no-require-imports
                const prometheusModule = require('@opentelemetry/exporter-prometheus')
                const PrometheusExporter = prometheusModule.PrometheusExporter

                // Create with preventServerStart true to prevent HTTP server
                return new PrometheusExporter({
                  preventServerStart: true,
                  prefix: config.metrics?.prefix || '',
                })
              }
              catch {
                // Fallback when PrometheusExporter not available
                return {
                  collect: async () => ({
                    resourceMetrics: { resource: {}, scopeMetrics: [] },
                    errors: [] as unknown[],
                  }),
                  setPrefix: (_unused: string) => { /* no-op */ },
                }
              }
            }
            return null
          },
          inject: [SDK_CONFIG],
        },
        {
          provide: 'METRICS_EXPORTER_SETUP',
          useFactory: (service: OpenTelemetryService, exporter: PrometheusExporterInterface) => {
            if (exporter) {
              service.setMetricsExporter(exporter)
            }
          },
          inject: [OpenTelemetryService, 'PROMETHEUS_EXPORTER'],
        },
        {
          provide: 'METRICS_PATH_SETUP',
          useFactory: (config: OpenTelemetryModuleConfig) => {
            // Return null if metrics are disabled to ensure controller isn't registered
            if (!config.metrics?.enabled || !config.metrics?.controller) {
              return null
            }

            // Extract path from configuration and prepare it
            const metricsPath = config.metrics?.endpoint?.startsWith('/')
              ? config.metrics.endpoint.substring(1)
              : config.metrics.endpoint || 'metrics'

            // Metrics endpoint will be available at the configured path

            return { path: metricsPath }
          },
          inject: [SDK_CONFIG],
        },
      ],
      controllers: [MetricsController],
      exports: [OpenTelemetryService],
    }
  }

  private static buildAsyncProvider(): FactoryProvider {
    return {
      provide: NodeSDK,
      useFactory: (config: OpenTelemetryModuleConfig) => {
        config.resource = defaultConfig.resource?.merge(config.resource ?? new Resource({}))
        Object.assign(config, { ...defaultConfig, ...config })
        if (!config.instrumentations)
          config.instrumentations = getNodeAutoInstrumentations()

        const sdk = new NodeSDK(config)
        sdk.start()
        return sdk
      },
      inject: [SDK_CONFIG],
    }
  }

  private static buildAsyncInjectors(): FactoryProvider {
    return {
      provide: SDK_INJECTORS,
      useFactory: async (config: OpenTelemetryModuleConfig, moduleRef: ModuleRef) => {
        config = { ...defaultConfig, ...config }
        const injectors
          = config.autoInjectors
          ?? defaultConfig.autoInjectors!

        for (const injector of injectors) {
          const created = await moduleRef.create(injector)
          if (created['inject'])
            created.inject()
        }

        return {}
      },
      inject: [SDK_CONFIG, ModuleRef],
    }
  }
}
