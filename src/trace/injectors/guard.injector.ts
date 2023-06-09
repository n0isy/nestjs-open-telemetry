import { CanActivate, Injectable, Logger, Type } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { AttributeNames, NestScope } from '../../open-telemetry.constants'
import { BaseInjector } from './base.injector'

@Injectable()
export class GuardInjector extends BaseInjector {
  private readonly logger = new Logger(GuardInjector.name)

  public inject(): void {
    this.injectGlobals()

    const controllers = this.getControllers()

    for (const controller of controllers) {
      if (this.isGuarded(controller.metatype)) {
        const guards = this.getGuards(controller.metatype).map((guard) => {
          const prototype = guard['prototype'] ?? guard
          if (this.isAffected(prototype.canActivate))
            return guard
          const traceName = `Guard -> ${prototype.constructor.name}`
          prototype.canActivate = this.wrap(prototype.canActivate, traceName, {
            attributes: {
              [AttributeNames.MODULE]: controller.host?.name,
              [AttributeNames.CONTROLLER]: controller.name,
              [AttributeNames.GUARD]: prototype.constructor.name,
              [AttributeNames.SCOPE]: NestScope.CONTROLLER,
              [AttributeNames.INJECTOR]: GuardInjector.name,
            },
          })
          this.logger.log(`Mapped ${traceName}`)
          return guard
        })

        if (guards.length > 0)
          Reflect.defineMetadata(GUARDS_METADATA, guards, controller.metatype)
      }

      const keys = this.metadataScanner.getAllMethodNames(
        controller.metatype.prototype,
      )

      for (const key of keys) {
        if (
          this.isGuarded(controller.metatype.prototype[key])
        ) {
          const guards = this.getGuards(controller.metatype.prototype[key]).map(
            (guard) => {
              const prototype = guard['prototype'] ?? guard
              if (this.isAffected(prototype.canActivate))
                return guard
              const traceName = `Guard -> ${prototype.constructor.name}`
              prototype.canActivate = this.wrap(
                prototype.canActivate,
                traceName,
                {
                  attributes: {
                    [AttributeNames.MODULE]: controller.host?.name,
                    [AttributeNames.CONTROLLER]: controller.name,
                    [AttributeNames.GUARD]: prototype.constructor.name,
                    [AttributeNames.SCOPE]: NestScope.METHOD,
                    [AttributeNames.PROVIDER_METHOD]: controller.metatype.prototype[key].name,
                    [AttributeNames.INJECTOR]: GuardInjector.name,
                  },
                },
              )
              this.logger.log(`Mapped ${traceName}`)
              return guard
            },
          )

          if (guards.length > 0) {
            Reflect.defineMetadata(
              GUARDS_METADATA,
              guards,
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
        && provider.token.includes(APP_GUARD)
        && !this.isAffected(provider.metatype.prototype.canActivate)
      ) {
        const traceName = `Guard -> Global -> ${provider.metatype.name}`
        provider.metatype.prototype.canActivate = this.wrap(
          provider.metatype.prototype.canActivate,
          traceName,
          {
            attributes: {
              [AttributeNames.GUARD]: provider.metatype.name,
              [AttributeNames.SCOPE]: NestScope.GLOBAL,
              [AttributeNames.INJECTOR]: GuardInjector.name,
            },
          },
        )
        this.logger.log(`Mapped ${traceName}`)
      }
    }
  }

  private getGuards(prototype: object): Type<CanActivate>[] {
    return Reflect.getMetadata(GUARDS_METADATA, prototype) || []
  }

  private isGuarded(prototype: object): boolean {
    return Reflect.hasMetadata(GUARDS_METADATA, prototype)
  }
}
