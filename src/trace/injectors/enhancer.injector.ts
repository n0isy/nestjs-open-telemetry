import { CanActivate, ExceptionFilter, NestInterceptor, PipeTransform, Type } from '@nestjs/common'
import { Module } from '@nestjs/core/injector/module'
import { ModuleRef } from '@nestjs/core'
import { BaseInjector } from './base.injector'

export abstract class EnhancerInjector extends BaseInjector {
  protected wrapEnhancer<T extends object>(classOrInstance: Type<T> | T): Type<T> | T {
    if (typeof classOrInstance !== 'function')
      return Object.create(classOrInstance)
    const wrappedClass = class extends classOrInstance {}
    Reflect.defineProperty(wrappedClass, 'name', {
      value: classOrInstance.name,
      writable: false,
    })
    this.reDecorate(classOrInstance, wrappedClass)
    return wrappedClass
  }

  protected resolveWrappedEnhancer<
    T extends PipeTransform
    | CanActivate
    | NestInterceptor
    | ExceptionFilter,
  >(module: Module, enhancer: Type<T>, wrappedEnhancer: Type<T>): void {
    const moduleRef = module.providers.get(ModuleRef)!.instance as ModuleRef
    const instanceWrapper = module.injectables.get(enhancer)
    module.addCustomClass(
      {
        provide: wrappedEnhancer,
        useClass: wrappedEnhancer,
      },
      module.injectables,
      instanceWrapper?.subtype,
    )
    moduleRef.create(wrappedEnhancer).then((value) => {
      const instanceWrapper = module.injectables.get(wrappedEnhancer)!
      instanceWrapper.instance = value
    })
  }
}
