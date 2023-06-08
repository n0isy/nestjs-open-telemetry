import { Logger } from '@nestjs/common'
import { context, trace } from '@opentelemetry/api'
import type { Injector } from './injector'

export class LoggerInjector implements Injector {
  public inject(): void {
    Logger.prototype.log = this.wrapPrototype(
      Logger.prototype.log,
    )
    Logger.prototype.debug = this.wrapPrototype(
      Logger.prototype.debug,
    )
    Logger.prototype.error = this.wrapPrototype(
      Logger.prototype.error,
    )
    Logger.prototype.verbose = this.wrapPrototype(
      Logger.prototype.verbose,
    )
    Logger.prototype.warn = this.wrapPrototype(
      Logger.prototype.warn,
    )
  }

  private wrapPrototype(func: Function) {
    return {
      [func.name](...args: any[]) {
        const currentSpan = trace.getSpan(context.active())
        if (currentSpan) {
          currentSpan.addEvent(func.name, {
            message: args[0],
          })
        }

        func.apply(this, args)
      },
    }[func.name]
  }
}
