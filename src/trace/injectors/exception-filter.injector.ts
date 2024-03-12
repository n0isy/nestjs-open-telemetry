import type { ExceptionFilter } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { EnhancerInjector, EnhancerType } from './enhancer.injector'

@Injectable()
export class ExceptionFilterInjector extends EnhancerInjector<ExceptionFilter> {
  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer, EnhancerType.FILTER)
  }
}
