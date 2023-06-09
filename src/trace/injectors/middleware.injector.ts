import { Injectable, Logger, Type } from '@nestjs/common'
import { MiddlewareModule } from '@nestjs/core/middleware/middleware-module'
import { AttributeNames } from '../../open-telemetry.constants'
import { BaseInjector } from './base.injector'

@Injectable()
export class MiddlewareInjector extends BaseInjector {
  private readonly logger = new Logger(MiddlewareInjector.name)
  public inject(): void {
    const metatype = MiddlewareModule as Type
    const originMethod = metatype.prototype.createProxy
    const logger = this.logger
    const wrap = this.wrap.bind(this)
    metatype.prototype.createProxy = function createProxy(...args: any[]) {
      const instance = args[0]
      const prototype = Object.getPrototypeOf(instance)
      if (prototype.use) {
        const traceName = `Middleware -> ${prototype.constructor.name}`
        prototype.use = wrap(prototype.use, traceName, {
          attributes: {
            [AttributeNames.MIDDLEWARE]: prototype.constructor.name,
            [AttributeNames.INJECTOR]: MiddlewareInjector.name,
          },
        })
        logger.log(`Mapped ${traceName}`)
      }
      return originMethod.apply(this, args)
    }
  }
}
