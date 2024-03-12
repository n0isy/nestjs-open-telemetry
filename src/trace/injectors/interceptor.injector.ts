import type { NestInterceptor } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { EnhancerInjector, EnhancerType } from './enhancer.injector'

@Injectable()
export class InterceptorInjector extends EnhancerInjector<NestInterceptor> {
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer, EnhancerType.INTERCEPTOR)
  }
}
