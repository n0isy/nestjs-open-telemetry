import { Inject, Injectable, Logger, Scope } from '@nestjs/common'
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { InternalCoreModule } from '@nestjs/core/injector/internal-core-module'
import { DiscoveryService, MetadataScanner, ModuleRef, ModulesContainer } from '@nestjs/core'
import type { OpenTelemetryModuleConfig } from '../../open-telemetry.interface'
import { AttributeNames, ProviderScope, SDK_CONFIG } from '../../open-telemetry.enums'
import { LoggerInjector } from './logger.injector'
import { BaseInjector } from './base.injector'

export interface ProviderInjectorConfig {
  excludeModules?: (Function | string)[]
  excludeProviders?: (Function | string)[]
}

export const internalExcludeModules: Function[] = [InternalCoreModule]
export const internalExcludeProviders: Function[] = [ModuleRef, MetadataScanner, DiscoveryService, LoggerInjector]

@Injectable()
export class ProviderInjector extends BaseInjector {
  private readonly logger = new Logger(ProviderInjector.name)
  private readonly config: ProviderInjectorConfig
  constructor(
    modulesContainer: ModulesContainer,
    @Inject(SDK_CONFIG)
    config: OpenTelemetryModuleConfig,
  ) {
    super(modulesContainer)
    if (config.injectorsConfig?.[ProviderInjector.name])
      this.config = config.injectorsConfig[ProviderInjector.name] as ProviderInjectorConfig
    else
      this.config = {}
  }

  public inject(): void {
    const providers = this.getProviders()

    for (const provider of providers) {
      if (provider.instance instanceof BaseInjector)
        continue
      if (provider.metatype === provider.host?.metatype)
        continue
      if (this.isExcluded(provider))
        continue
      if (this.isAffected(provider.metatype))
        continue
      const prototype = provider.metatype.prototype
      const keys = this.metadataScanner.getAllMethodNames(
        prototype,
      )

      for (const key of keys) {
        if (!this.isAffected(prototype[key])) {
          const name = `Provider -> ${this.getName(provider, prototype[key])}`
          const method = this.wrap(
            prototype[key],
            name,
            {
              attributes: {
                [AttributeNames.MODULE]: provider.host?.name,
                [AttributeNames.PROVIDER]: provider.name,
                [AttributeNames.PROVIDER_SCOPE]: provider.scope != null ? Scope[provider.scope] : ProviderScope.DEFAULT,
                [AttributeNames.PROVIDER_METHOD]: prototype[key].name,
                [AttributeNames.INJECTOR]: ProviderInjector.name,
              },
            },
            true,
          )

          prototype[key] = method
          this.logger.log(`Mapped ${name}`)
        }
      }
    }
  }

  private getName(provider: InstanceWrapper, func: Function): string {
    return `${provider.name}.${func.name}`
  }

  private isExcluded(provider: InstanceWrapper): boolean {
    if (internalExcludeModules.includes(<Function>provider.host?.metatype))
      return true
    if (internalExcludeProviders.includes(<Function>provider.metatype))
      return true
    if (
      this.config.excludeModules?.includes(<Function>provider.host?.metatype)
      || this.config.excludeModules?.includes(<string>provider.host?.name)
    )
      return true
    if (
      this.config.excludeProviders?.includes(<Function>provider.metatype)
      || this.config.excludeProviders?.includes(<string>provider.name)
    )
      return true
    return false
  }
}
