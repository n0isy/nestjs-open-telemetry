import { Injectable, Logger, NestInterceptor, Type } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants'
import { AttributeNames, NestScope } from '../../open-telemetry.enums'
import { GuardInjector } from './guard.injector'
import { BaseInjector } from './base.injector'

@Injectable()
export class InterceptorInjector extends BaseInjector {
  private readonly logger = new Logger(GuardInjector.name)

  public inject(): void {
    this.injectGlobals()

    const controllers = this.getControllers()

    for (const controller of controllers) {
      if (this.isIntercepted(controller.metatype)) {
        const interceptors = this.getInterceptors(controller.metatype).map((interceptor) => {
          const prototype = interceptor['prototype'] ?? interceptor
          if (this.isAffected(prototype.intercept))
            return interceptor
          const traceName = `Interceptor -> ${prototype.constructor.name}`
          prototype.intercept = this.wrap(prototype.intercept, traceName, {
            attributes: {
              [AttributeNames.MODULE]: controller.host?.name,
              [AttributeNames.CONTROLLER]: controller.name,
              [AttributeNames.INTERCEPTOR]: prototype.constructor.name,
              [AttributeNames.SCOPE]: NestScope.CONTROLLER,
              [AttributeNames.INJECTOR]: InterceptorInjector.name,
            },
          })
          this.logger.log(`Mapped ${traceName}`)
          return interceptor
        })

        if (interceptors.length > 0)
          Reflect.defineMetadata(INTERCEPTORS_METADATA, interceptors, controller.metatype)
      }

      const keys = this.metadataScanner.getAllMethodNames(
        controller.metatype.prototype,
      )

      for (const key of keys) {
        if (this.isIntercepted(controller.metatype.prototype[key])) {
          const interceptors = this.getInterceptors(controller.metatype.prototype[key]).map(
            (interceptor) => {
              const prototype = interceptor['prototype'] ?? interceptor
              if (this.isAffected(prototype.intercept))
                return interceptor
              const traceName = `Interceptor -> ${prototype.constructor.name}`
              prototype.intercept = this.wrap(
                prototype.intercept,
                traceName,
                {
                  attributes: {
                    [AttributeNames.MODULE]: controller.host?.name,
                    [AttributeNames.CONTROLLER]: controller.name,
                    [AttributeNames.INTERCEPTOR]: prototype.constructor.name,
                    [AttributeNames.SCOPE]: NestScope.METHOD,
                    [AttributeNames.PROVIDER_METHOD]: controller.metatype.prototype[key].name,
                    [AttributeNames.INJECTOR]: InterceptorInjector.name,
                  },
                },
              )
              this.logger.log(`Mapped ${traceName}`)
              return interceptor
            },
          )

          if (interceptors.length > 0) {
            Reflect.defineMetadata(
              INTERCEPTORS_METADATA,
              interceptors,
              controller.metatype.prototype[key],
            )
          }
        }
      }
    }
  }

  private injectGlobals() {
    const providers = this.getProviders()

    for (const provider of providers) {
      if (
        typeof provider.token === 'string'
        && provider.token.includes(APP_INTERCEPTOR)
        && !this.isAffected(provider.metatype.prototype.intercept)
      ) {
        const traceName = `Interceptor -> Global -> ${provider.metatype.name}`
        provider.metatype.prototype.intercept = this.wrap(
          provider.metatype.prototype.intercept,
          traceName,
          {
            attributes: {
              [AttributeNames.INTERCEPTOR]: provider.metatype.name,
              [AttributeNames.SCOPE]: NestScope.GLOBAL,
              [AttributeNames.INJECTOR]: InterceptorInjector.name,
            },
          },
        )
        this.affect(provider.metatype)
        this.logger.log(`Mapped ${traceName}`)
      }
    }
  }

  private getInterceptors(target: object): Type<NestInterceptor>[] {
    return Reflect.getMetadata(INTERCEPTORS_METADATA, target) || []
  }

  private isIntercepted(target: object): boolean {
    return Reflect.hasMetadata(INTERCEPTORS_METADATA, target)
  }
}
