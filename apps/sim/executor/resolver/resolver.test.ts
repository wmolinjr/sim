import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBlock } from '@/blocks/index'
import { BlockType } from '@/executor/consts'
import { InputResolver } from '@/executor/resolver/resolver'
import type { ExecutionContext } from '@/executor/types'
import type { SerializedBlock, SerializedWorkflow } from '@/serializer/types'

describe('InputResolver', () => {
  let sampleWorkflow: SerializedWorkflow
  let mockContext: any
  let mockEnvironmentVars: Record<string, string>
  let mockWorkflowVars: Record<string, any>
  let resolver: InputResolver

  beforeEach(() => {
    sampleWorkflow = {
      version: '1.0',
      blocks: [
        {
          id: 'starter-block',
          metadata: { id: BlockType.STARTER, name: 'Start' },
          position: { x: 100, y: 100 },
          config: { tool: BlockType.STARTER, params: {} },
          inputs: {},
          outputs: {},
          enabled: true,
        },
        {
          id: 'function-block',
          metadata: { id: BlockType.FUNCTION, name: 'Function' },
          position: { x: 300, y: 100 },
          config: { tool: BlockType.FUNCTION, params: {} },
          inputs: {},
          outputs: {},
          enabled: true,
        },
        {
          id: 'condition-block',
          metadata: { id: BlockType.CONDITION, name: 'Condition' },
          position: { x: 500, y: 100 },
          config: { tool: BlockType.CONDITION, params: {} },
          inputs: {},
          outputs: {},
          enabled: true,
        },
        {
          id: 'api-block',
          metadata: { id: BlockType.API, name: 'API' },
          position: { x: 700, y: 100 },
          config: { tool: BlockType.API, params: {} },
          inputs: {},
          outputs: {},
          enabled: true,
        },
        {
          id: 'disabled-block',
          metadata: { id: 'generic', name: 'Disabled Block' },
          position: { x: 900, y: 100 },
          config: { tool: 'generic', params: {} },
          inputs: {},
          outputs: {},
          enabled: false,
        },
      ],
      connections: [
        { source: 'starter-block', target: 'function-block' },
        { source: 'function-block', target: 'condition-block' },
        { source: 'condition-block', target: 'api-block' },
        { source: 'api-block', target: 'disabled-block' },
      ],
      loops: {},
    }

    mockContext = {
      workflowId: 'test-workflow',
      workflow: sampleWorkflow,
      blockStates: new Map([
        ['starter-block', { output: { input: 'Hello World', type: 'text' } }],
        ['function-block', { output: { result: '42' } }], // String value as it would be in real app
      ]),
      activeExecutionPath: new Set(['starter-block', 'function-block']),
      blockLogs: [],
      metadata: { duration: 0 },
      environmentVariables: {},
      decisions: { router: new Map(), condition: new Map() },
      loopIterations: new Map(),
      loopItems: new Map(),
      completedLoops: new Set(),
      executedBlocks: new Set(['starter-block', 'function-block']),
    }

    mockEnvironmentVars = {
      API_KEY: 'test-api-key',
      BASE_URL: 'https://api.example.com',
    }

    mockWorkflowVars = {
      stringVar: {
        id: 'var1',
        workflowId: 'test-workflow',
        name: 'stringVar',
        type: 'string',
        value: 'Hello',
      },
      numberVar: {
        id: 'var2',
        workflowId: 'test-workflow',
        name: 'numberVar',
        type: 'number',
        value: '42',
      },
      boolVar: {
        id: 'var3',
        workflowId: 'test-workflow',
        name: 'boolVar',
        type: 'boolean',
        value: 'true',
      },
      objectVar: {
        id: 'var4',
        workflowId: 'test-workflow',
        name: 'objectVar',
        type: 'object',
        value: '{"name":"John","age":30}',
      },
      arrayVar: {
        id: 'var5',
        workflowId: 'test-workflow',
        name: 'arrayVar',
        type: 'array',
        value: '[1,2,3]',
      },
      plainVar: {
        id: 'var6',
        workflowId: 'test-workflow',
        name: 'plainVar',
        type: 'plain',
        value: 'Raw text without quotes',
      },
    }

    const accessibleBlocksMap = new Map<string, Set<string>>()
    const allBlockIds = sampleWorkflow.blocks.map((b) => b.id)
    const testBlockIds = ['test-block', 'test-block-2', 'generic-block']
    const allIds = [...allBlockIds, ...testBlockIds]

    sampleWorkflow.blocks.forEach((block) => {
      const accessibleBlocks = new Set(allIds)
      accessibleBlocksMap.set(block.id, accessibleBlocks)
    })

    testBlockIds.forEach((testId) => {
      const accessibleBlocks = new Set(allIds)
      accessibleBlocksMap.set(testId, accessibleBlocks)
    })

    resolver = new InputResolver(
      sampleWorkflow,
      mockEnvironmentVars,
      mockWorkflowVars,
      undefined,
      accessibleBlocksMap
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Variable Value Resolution', () => {
    it('should resolve string variables correctly', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            directRef: '<variable.stringVar>',
            interpolated: 'Hello <variable.stringVar>!',
          },
        },
        inputs: {
          directRef: 'string',
          interpolated: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.directRef).toBe('Hello')
      expect(result.interpolated).toBe('Hello Hello!')
    })

    it('should resolve number variables correctly', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            directRef: '<variable.numberVar>',
            interpolated: 'The number is <variable.numberVar>',
          },
        },
        inputs: {
          directRef: 'number',
          interpolated: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.directRef).toBe(42)
      expect(result.interpolated).toBe('The number is 42')
    })

    it('should resolve boolean variables correctly', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            directRef: '<variable.boolVar>',
            interpolated: 'Is it true? <variable.boolVar>',
          },
        },
        inputs: {
          directRef: 'boolean',
          interpolated: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.directRef).toBe(true)
      expect(result.interpolated).toBe('Is it true? true')
    })

    it('should resolve object variables correctly', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            directRef: '<variable.objectVar>',
          },
        },
        inputs: {
          directRef: 'json',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.directRef).toEqual({ name: 'John', age: 30 })
    })

    it('should resolve plain text variables without quoting', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            directRef: '<variable.plainVar>',
            interpolated: 'Content: <variable.plainVar>',
          },
        },
        inputs: {
          directRef: 'string',
          interpolated: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.directRef).toBe('Raw text without quotes')
      expect(result.interpolated).toBe('Content: Raw text without quotes')
    })
  })

  describe('Block Reference Resolution', () => {
    it('should resolve references to other blocks', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            starterRef: '<starter-block.input>',
            functionRef: '<function-block.result>',
            nameRef: '<Start.input>',
          },
        },
        inputs: {
          starterRef: 'string',
          functionRef: 'string',
          nameRef: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.starterRef).toBe('Hello World')
      expect(result.functionRef).toBe('42')
      expect(result.nameRef).toBe('Hello World') // Should resolve using block name
    })

    it('should handle the special "start" alias for starter block', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            startRef: '<start.input>',
            startType: '<start.type>',
          },
        },
        inputs: {
          startRef: 'string',
          startType: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.startRef).toBe('Hello World')
      expect(result.startType).toBe('text')
    })

    it('should throw an error for references to inactive blocks', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            inactiveRef: '<condition-block.result>',
          },
        },
        inputs: {
          inactiveRef: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)
      expect(result.inactiveRef).toBe('')
    })

    it('should throw an error for references to disabled blocks', () => {
      sampleWorkflow.connections.push({ source: 'disabled-block', target: 'test-block' })

      const disabledBlock = sampleWorkflow.blocks.find((b) => b.id === 'disabled-block')!
      disabledBlock.enabled = false
      mockContext.activeExecutionPath.add('disabled-block')

      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            disabledRef: '<disabled-block.result>',
          },
        },
        inputs: {
          disabledRef: 'string',
        },
        outputs: {},
        enabled: true,
      }

      expect(() => resolver.resolveInputs(block, mockContext)).toThrow(/Block ".+" is disabled/)
    })
  })

  describe('Environment Variable Resolution', () => {
    it('should resolve environment variables in API key contexts', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: BlockType.API, name: 'Test API Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'api',
          params: {
            apiKey: '{{API_KEY}}',
            url: 'https://example.com?key={{API_KEY}}',
            regularParam: 'Base URL is: {{BASE_URL}}',
          },
        },
        inputs: {
          apiKey: 'string',
          url: 'string',
          regularParam: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.apiKey).toBe('test-api-key')
      expect(result.url).toBe('https://example.com?key=test-api-key')
      expect(result.regularParam).toBe('Base URL is: {{BASE_URL}}')
    })

    it('should resolve explicit environment variables', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            explicitEnv: '{{BASE_URL}}',
          },
        },
        inputs: {
          explicitEnv: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.explicitEnv).toBe('https://api.example.com')
    })

    it('should not resolve environment variables in regular contexts', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            regularParam: 'Value with {{API_KEY}} embedded',
          },
        },
        inputs: {
          regularParam: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.regularParam).toBe('Value with {{API_KEY}} embedded')
    })
  })

  describe('Table Cell Resolution', () => {
    it('should resolve variable references in table cells', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            tableParam: [
              {
                id: 'row1',
                cells: {
                  Key: 'stringKey',
                  Value: '<variable.stringVar>',
                },
              },
              {
                id: 'row2',
                cells: {
                  Key: 'numberKey',
                  Value: '<variable.numberVar>',
                },
              },
              {
                id: 'row3',
                cells: {
                  Key: 'plainKey',
                  Value: '<variable.plainVar>',
                },
              },
            ],
          },
        },
        inputs: {
          tableParam: 'json',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.tableParam[0].cells.Value).toBe('Hello')
      expect(result.tableParam[1].cells.Value).toBe(42)
      expect(result.tableParam[2].cells.Value).toBe('Raw text without quotes') // plain var
    })

    it('should resolve block references in table cells', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            tableParam: [
              {
                id: 'row1',
                cells: {
                  Key: 'inputKey',
                  Value: '<start.input>',
                },
              },
              {
                id: 'row2',
                cells: {
                  Key: 'resultKey',
                  Value: '<function-block.result>',
                },
              },
            ],
          },
        },
        inputs: {
          tableParam: 'json',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.tableParam[0].cells.Value).toBe('Hello World')
      expect(result.tableParam[1].cells.Value).toBe('42')
    })

    it('should handle interpolated variable references in table cells', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            tableParam: [
              {
                id: 'row1',
                cells: {
                  Key: 'greeting',
                  Value: 'Hello, <variable.stringVar>!',
                },
              },
            ],
          },
        },
        inputs: {
          tableParam: 'json',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.tableParam[0].cells.Value).toBe('Hello, Hello!')
    })
  })

  describe('Special Block Types', () => {
    it('should handle code input for function blocks', () => {
      const block: SerializedBlock = {
        id: 'code-block',
        metadata: { id: BlockType.FUNCTION, name: 'Code Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            code: 'const name = "<variable.stringVar>";\nconst num = <variable.numberVar>;\nreturn { name, num };',
          },
        },
        inputs: {
          code: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.code).toContain('const name = "Hello";')
      expect(result.code).toContain('const num = 42;')
    })

    it('should handle body input for API blocks', () => {
      const block: SerializedBlock = {
        id: 'api-block',
        metadata: { id: BlockType.API, name: 'API Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'api',
          params: {
            body: '{ "name": "<variable.stringVar>", "value": <variable.numberVar> }',
          },
        },
        inputs: {
          body: 'json',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.body).toEqual({
        name: 'Hello',
        value: 42,
      })
    })

    it('should handle conditions parameter for condition blocks', () => {
      const block: SerializedBlock = {
        id: 'condition-block',
        metadata: { id: BlockType.CONDITION, name: 'Condition Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'condition',
          params: {
            conditions: '<start.input> === "Hello World"',
          },
        },
        inputs: {
          conditions: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.conditions).toBe('<start.input> === "Hello World"')
    })
  })

  describe('findVariableByName Helper', () => {
    it('should find variables with exact name match', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            param1: '<variable.stringVar>',
            param2: '<variable.numberVar>',
          },
        },
        inputs: {
          param1: 'string',
          param2: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.param1).toBe('Hello')
      expect(result.param2).toBe(42)
    })
  })

  describe('direct loop references', () => {
    it('should resolve direct loop.currentItem reference without quotes', () => {
      const loopBlock: SerializedBlock = {
        id: 'loop-1',
        position: { x: 0, y: 0 },
        config: { tool: BlockType.LOOP, params: {} },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.LOOP, name: 'Test Loop' },
        enabled: true,
      }

      const functionBlock: SerializedBlock = {
        id: 'function-1',
        position: { x: 0, y: 0 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            item: '<loop.currentItem>',
          },
        },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.FUNCTION, name: 'Process Item' },
        enabled: true,
      }

      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [loopBlock, functionBlock],
        connections: [],
        loops: {
          'loop-1': {
            id: 'loop-1',
            nodes: ['function-1'],
            iterations: 3,
            loopType: 'forEach',
            forEachItems: ['item1', 'item2', 'item3'],
          },
        },
      }

      const resolver = new InputResolver(workflow, {})
      const context: ExecutionContext = {
        workflowId: 'test',
        blockStates: new Map(),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map([['loop-1', 1]]),
        loopItems: new Map([['loop-1', ['item1']]]),
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['function-1']),
        workflow,
      }

      const resolvedInputs = resolver.resolveInputs(functionBlock, context)

      expect(resolvedInputs.item).toEqual(['item1']) // Current loop items
    })

    it('should resolve direct loop.index reference without quotes', () => {
      const loopBlock: SerializedBlock = {
        id: 'loop-1',
        position: { x: 0, y: 0 },
        config: { tool: BlockType.LOOP, params: {} },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.LOOP, name: 'Test Loop' },
        enabled: true,
      }

      const functionBlock: SerializedBlock = {
        id: 'function-1',
        position: { x: 0, y: 0 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            index: '<loop.index>',
          },
        },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.FUNCTION, name: 'Process Index' },
        enabled: true,
      }

      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [loopBlock, functionBlock],
        connections: [],
        loops: {
          'loop-1': {
            id: 'loop-1',
            nodes: ['function-1'],
            iterations: 5,
            loopType: 'for',
          },
        },
      }

      const resolver = new InputResolver(workflow, {})
      const context: ExecutionContext = {
        workflowId: 'test',
        blockStates: new Map(),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map([['loop-1', 3]]), // Iteration 3 (corresponds to 0-based index 2)
        loopItems: new Map(),
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['function-1']),
        workflow,
      }

      const resolvedInputs = resolver.resolveInputs(functionBlock, context)

      expect(resolvedInputs.index).toBe(2) // Index 2 (adjusted from iteration 3)
    })

    it('should resolve direct loop.items reference for forEach loops', () => {
      const loopBlock: SerializedBlock = {
        id: 'loop-1',
        position: { x: 0, y: 0 },
        config: { tool: BlockType.LOOP, params: {} },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.LOOP, name: 'Test Loop' },
        enabled: true,
      }

      const functionBlock: SerializedBlock = {
        id: 'function-1',
        position: { x: 0, y: 0 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            allItems: '<loop.items>', // Direct reference to all items
          },
        },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.FUNCTION, name: 'Process All Items' },
        enabled: true,
      }

      const items = ['item1', 'item2', 'item3']
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [loopBlock, functionBlock],
        connections: [],
        loops: {
          'loop-1': {
            id: 'loop-1',
            nodes: ['function-1'],
            iterations: 3,
            loopType: 'forEach',
            forEachItems: items,
          },
        },
      }

      const resolver = new InputResolver(workflow, {})
      const loopItemsMap = new Map<string, any>()
      loopItemsMap.set('loop-1', 'item1')
      loopItemsMap.set('loop-1_items', items)

      const context: ExecutionContext = {
        workflowId: 'test',
        blockStates: new Map(),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map([['loop-1', 1]]),
        loopItems: loopItemsMap,
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['function-1']),
        workflow,
      }

      const resolvedInputs = resolver.resolveInputs(functionBlock, context)

      expect(resolvedInputs.allItems).toEqual(items) // Direct array, not stringified
    })

    it('should handle missing loop-1_items gracefully', () => {
      const loopBlock: SerializedBlock = {
        id: 'loop-1',
        position: { x: 0, y: 0 },
        config: { tool: BlockType.LOOP, params: {} },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.LOOP, name: 'Test Loop' },
        enabled: true,
      }

      const functionBlock: SerializedBlock = {
        id: 'function-1',
        position: { x: 0, y: 0 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            allItems: '<loop.items>', // Direct reference to all items
          },
        },
        inputs: {},
        outputs: {},
        metadata: { id: BlockType.FUNCTION, name: 'Process All Items' },
        enabled: true,
      }

      const items = ['item1', 'item2', 'item3']
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [loopBlock, functionBlock],
        connections: [],
        loops: {
          'loop-1': {
            id: 'loop-1',
            nodes: ['function-1'],
            iterations: 3,
            loopType: 'forEach',
            forEachItems: items,
          },
        },
      }

      const resolver = new InputResolver(workflow, {})
      const loopItemsMap = new Map<string, any>()
      loopItemsMap.set('loop-1', 'item1')
      // Note: loop-1_items is NOT set to test fallback behavior

      const context: ExecutionContext = {
        workflowId: 'test',
        blockStates: new Map(),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map([['loop-1', 1]]),
        loopItems: loopItemsMap,
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['function-1']),
        workflow,
      }

      const resolvedInputs = resolver.resolveInputs(functionBlock, context)

      // Should fall back to the items from the loop configuration
      expect(resolvedInputs.allItems).toEqual(items)
    })
  })

  describe('parallel references', () => {
    it('should resolve parallel references when block is inside a parallel', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          {
            id: 'parallel-1',
            position: { x: 0, y: 0 },
            config: { tool: BlockType.PARALLEL, params: {} },
            inputs: {},
            outputs: {},
            metadata: { id: BlockType.PARALLEL, name: 'Parallel 1' },
            enabled: true,
          },
          {
            id: 'function-1',
            position: { x: 0, y: 0 },
            config: { tool: BlockType.FUNCTION, params: { code: '<parallel.currentItem>' } },
            inputs: {},
            outputs: {},
            metadata: { id: BlockType.FUNCTION, name: 'Function 1' },
            enabled: true,
          },
        ],
        connections: [],
        loops: {},
        parallels: {
          'parallel-1': {
            id: 'parallel-1',
            nodes: ['function-1'],
            distribution: ['item1', 'item2'],
          },
        },
      }

      const resolver = new InputResolver(workflow, {})
      const context: ExecutionContext = {
        workflowId: 'test',
        blockStates: new Map(),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map(),
        loopItems: new Map([['parallel-1', ['test-item']]]),
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['function-1']),
        workflow,
      }

      const block = workflow.blocks[1]
      const result = resolver.resolveInputs(block, context)

      expect(result.code).toEqual(['test-item'])
    })

    it('should resolve parallel references by block name when multiple parallels exist', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          {
            id: 'parallel-1',
            position: { x: 0, y: 0 },
            config: { tool: BlockType.PARALLEL, params: {} },
            inputs: {},
            outputs: {},
            metadata: { id: BlockType.PARALLEL, name: 'Parallel 1' },
            enabled: true,
          },
          {
            id: 'parallel-2',
            position: { x: 0, y: 0 },
            config: { tool: BlockType.PARALLEL, params: {} },
            inputs: {},
            outputs: {},
            metadata: { id: BlockType.PARALLEL, name: 'Parallel 2' },
            enabled: true,
          },
          {
            id: 'function-1',
            position: { x: 0, y: 0 },
            config: { tool: BlockType.FUNCTION, params: { code: '<Parallel1.results>' } },
            inputs: {},
            outputs: {},
            metadata: { id: BlockType.FUNCTION, name: 'Function 1' },
            enabled: true,
          },
        ],
        connections: [],
        loops: {},
        parallels: {
          'parallel-1': {
            id: 'parallel-1',
            nodes: [],
          },
          'parallel-2': {
            id: 'parallel-2',
            nodes: [],
          },
        },
      }

      // Create accessibility map
      const accessibilityMap = new Map<string, Set<string>>()
      const allBlockIds = workflow.blocks.map((b) => b.id)
      const testBlockIds = ['test-block', 'function-1']
      const allIds = [...allBlockIds, ...testBlockIds]

      workflow.blocks.forEach((block) => {
        const accessibleBlocks = new Set(allIds)
        accessibilityMap.set(block.id, accessibleBlocks)
      })

      // Set up accessibility for test blocks
      testBlockIds.forEach((testId) => {
        const accessibleBlocks = new Set(allIds)
        accessibilityMap.set(testId, accessibleBlocks)
      })

      const resolver = new InputResolver(workflow, {}, {}, undefined, accessibilityMap)
      const context: ExecutionContext = {
        workflowId: 'test',
        blockStates: new Map([
          [
            'parallel-1',
            {
              output: { results: ['result1', 'result2'] },
              executed: true,
              executionTime: 0,
            },
          ],
          [
            'parallel-2',
            {
              output: { results: ['result3', 'result4'] },
              executed: true,
              executionTime: 0,
            },
          ],
        ]),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map(),
        loopItems: new Map(),
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['parallel-1', 'parallel-2', 'function-1']),
        workflow,
      }

      const block = workflow.blocks[2]
      const result = resolver.resolveInputs(block, context)

      // Should resolve to Parallel 1's results
      expect(result.code).toBe('["result1","result2"]')
    })

    it('should resolve parallel references by block ID when needed', () => {
      const workflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          {
            id: 'parallel-1',
            position: { x: 0, y: 0 },
            config: { tool: BlockType.PARALLEL, params: {} },
            inputs: {},
            outputs: {},
            metadata: { id: BlockType.PARALLEL, name: 'Parallel 1' },
            enabled: true,
          },
          {
            id: 'function-1',
            position: { x: 0, y: 0 },
            config: { tool: BlockType.FUNCTION, params: { code: '<parallel-1.results>' } },
            inputs: {},
            outputs: {},
            metadata: { id: BlockType.FUNCTION, name: 'Function 1' },
            enabled: true,
          },
        ],
        connections: [],
        loops: {},
        parallels: {
          'parallel-1': {
            id: 'parallel-1',
            nodes: [],
          },
        },
      }

      // Create accessibility map for second test
      const accessibilityMap = new Map<string, Set<string>>()
      const allBlockIds = workflow.blocks.map((b) => b.id)
      const testBlockIds = ['test-block', 'function-1']
      const allIds = [...allBlockIds, ...testBlockIds]

      workflow.blocks.forEach((block) => {
        const accessibleBlocks = new Set(allIds)
        accessibilityMap.set(block.id, accessibleBlocks)
      })

      // Set up accessibility for test blocks
      testBlockIds.forEach((testId) => {
        const accessibleBlocks = new Set(allIds)
        accessibilityMap.set(testId, accessibleBlocks)
      })

      const resolver = new InputResolver(workflow, {}, {}, undefined, accessibilityMap)
      const context: ExecutionContext = {
        workflowId: 'test',
        blockStates: new Map([
          [
            'parallel-1',
            {
              output: { results: ['result1', 'result2'] },
              executed: true,
              executionTime: 0,
            },
          ],
        ]),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map(),
        loopItems: new Map(),
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['parallel-1', 'function-1']),
        workflow,
      }

      const block = workflow.blocks[1]
      const result = resolver.resolveInputs(block, context)

      // Should successfully resolve the reference using block ID
      expect(result.code).toBe('["result1","result2"]')
    })
  })

  describe('Connection-Based Reference Validation', () => {
    let workflowWithConnections: SerializedWorkflow
    let connectionResolver: InputResolver
    let contextWithConnections: ExecutionContext

    beforeEach(() => {
      // Create a workflow with specific connections: Agent -> Function -> Response
      workflowWithConnections = {
        version: '1.0',
        blocks: [
          {
            id: 'starter-1',
            metadata: { id: BlockType.STARTER, name: 'Start' },
            position: { x: 0, y: 0 },
            config: { tool: BlockType.STARTER, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
          {
            id: 'agent-1',
            metadata: { id: BlockType.AGENT, name: 'Agent Block' },
            position: { x: 100, y: 100 },
            config: { tool: BlockType.AGENT, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
          {
            id: 'function-1',
            metadata: { id: BlockType.FUNCTION, name: 'Function Block' },
            position: { x: 200, y: 200 },
            config: { tool: BlockType.FUNCTION, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
          {
            id: 'isolated-block',
            metadata: { id: BlockType.AGENT, name: 'Isolated Block' },
            position: { x: 300, y: 300 },
            config: { tool: BlockType.AGENT, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
        ],
        connections: [
          { source: 'starter-1', target: 'agent-1' },
          { source: 'agent-1', target: 'function-1' },
          // Note: isolated-block has no connections
        ],
        loops: {},
      }

      // Create accessibility map based on connections
      const accessibleBlocksMap = new Map<string, Set<string>>()
      const testBlockIds = ['test-block', 'test-block-2', 'test-response-block', 'generic-block']

      workflowWithConnections.blocks.forEach((block) => {
        const accessibleBlocks = new Set<string>()
        // Add directly connected blocks (sources that connect to this block)
        workflowWithConnections.connections.forEach((conn) => {
          if (conn.target === block.id) {
            accessibleBlocks.add(conn.source)
          }
        })
        // Always allow starter block access
        const starterBlock = workflowWithConnections.blocks.find(
          (b) => b.metadata?.id === BlockType.STARTER
        )
        if (starterBlock) {
          accessibleBlocks.add(starterBlock.id)
        }
        accessibleBlocksMap.set(block.id, accessibleBlocks)
      })

      // Set up accessibility for test blocks - they should only reference specific connected blocks
      // For "test-block" - it should have connection from function-1, so it can reference function-1 and start
      workflowWithConnections.connections.push({ source: 'function-1', target: 'test-block' })

      testBlockIds.forEach((testId) => {
        const accessibleBlocks = new Set<string>()
        // Add directly connected blocks (sources that connect to this test block)
        workflowWithConnections.connections.forEach((conn) => {
          if (conn.target === testId) {
            accessibleBlocks.add(conn.source)
          }
        })
        // Always allow starter block access
        const starterBlock = workflowWithConnections.blocks.find(
          (b) => b.metadata?.id === BlockType.STARTER
        )
        if (starterBlock) {
          accessibleBlocks.add(starterBlock.id)
        }
        accessibleBlocksMap.set(testId, accessibleBlocks)
      })

      connectionResolver = new InputResolver(
        workflowWithConnections,
        {},
        {},
        undefined,
        accessibleBlocksMap
      )
      contextWithConnections = {
        workflowId: 'test-workflow',
        blockStates: new Map([
          ['starter-1', { output: { input: 'Hello World' }, executed: true, executionTime: 0 }],
          ['agent-1', { output: { content: 'Agent response' }, executed: true, executionTime: 0 }],
          [
            'function-1',
            { output: { result: 'Function result' }, executed: true, executionTime: 0 },
          ],
          [
            'isolated-block',
            { output: { content: 'Isolated content' }, executed: true, executionTime: 0 },
          ],
        ]),
        blockLogs: [],
        metadata: { duration: 0 },
        environmentVariables: {},
        decisions: { router: new Map(), condition: new Map() },
        loopIterations: new Map(),
        loopItems: new Map(),
        completedLoops: new Set(),
        executedBlocks: new Set(),
        activeExecutionPath: new Set(['starter-1', 'agent-1', 'function-1', 'isolated-block']),
        workflow: workflowWithConnections,
      }
    })

    it('should allow references to directly connected blocks', () => {
      const functionBlock = workflowWithConnections.blocks[2] // function-1
      const testBlock: SerializedBlock = {
        ...functionBlock,
        config: {
          tool: BlockType.FUNCTION,
          params: {
            code: 'return <agent-1.content>', // function-1 can reference agent-1 (connected)
          },
        },
      }

      const result = connectionResolver.resolveInputs(testBlock, contextWithConnections)
      expect(result.code).toBe('return "Agent response"')
    })

    it('should reject references to unconnected blocks', () => {
      // Create a new block that is added to the workflow but not connected to isolated-block
      workflowWithConnections.blocks.push({
        id: 'test-block',
        metadata: { id: BlockType.FUNCTION, name: 'Test Block' },
        position: { x: 500, y: 500 },
        config: { tool: BlockType.FUNCTION, params: {} },
        inputs: {},
        outputs: {},
        enabled: true,
      })

      // Add a connection so test-block can reference agent-1 but not isolated-block
      workflowWithConnections.connections.push({ source: 'agent-1', target: 'test-block' })

      // Update the accessibility map for test-block to include the new connection
      const testBlockAccessible = new Set<string>()
      workflowWithConnections.connections.forEach((conn) => {
        if (conn.target === 'test-block') {
          testBlockAccessible.add(conn.source)
        }
      })
      // Always allow starter block access
      const starterBlock = workflowWithConnections.blocks.find(
        (b) => b.metadata?.id === BlockType.STARTER
      )
      if (starterBlock) {
        testBlockAccessible.add(starterBlock.id)
      }
      connectionResolver.accessibleBlocksMap?.set('test-block', testBlockAccessible)

      const testBlock: SerializedBlock = {
        id: 'test-block',
        metadata: { id: BlockType.FUNCTION, name: 'Test Block' },
        position: { x: 500, y: 500 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            code: 'return <isolated-block.content>', // test-block cannot reference isolated-block (not connected)
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      expect(() => connectionResolver.resolveInputs(testBlock, contextWithConnections)).toThrow(
        /Block "isolated-block" is not connected to this block/
      )
    })

    it('should always allow references to starter block', () => {
      const functionBlock = workflowWithConnections.blocks[2] // function-1
      const testBlock: SerializedBlock = {
        ...functionBlock,
        config: {
          tool: BlockType.FUNCTION,
          params: {
            code: 'return <start.input>', // Any block can reference start
          },
        },
      }

      const result = connectionResolver.resolveInputs(testBlock, contextWithConnections)
      expect(result.code).toBe('return "Hello World"') // Should be quoted for function blocks
    })

    it('should format start.input properly for different block types', () => {
      // Test function block - should quote strings
      const functionBlock: SerializedBlock = {
        id: 'test-function',
        metadata: { id: BlockType.FUNCTION, name: 'Test Function' },
        position: { x: 100, y: 100 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            code: 'return <start.input>',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      // Test condition block - should quote strings
      const conditionBlock: SerializedBlock = {
        id: 'test-condition',
        metadata: { id: BlockType.CONDITION, name: 'Test Condition' },
        position: { x: 200, y: 100 },
        config: {
          tool: BlockType.CONDITION,
          params: {
            conditions: JSON.stringify([
              { id: 'cond1', title: 'if', value: '<start.input> === "Hello World"' },
            ]),
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      // Test response block - should use raw string
      const responseBlock: SerializedBlock = {
        id: 'test-response',
        metadata: { id: BlockType.RESPONSE, name: 'Test Response' },
        position: { x: 300, y: 100 },
        config: {
          tool: BlockType.RESPONSE,
          params: {
            content: '<start.input>',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const functionResult = connectionResolver.resolveInputs(functionBlock, contextWithConnections)
      expect(functionResult.code).toBe('return "Hello World"') // Quoted for function

      const conditionResult = connectionResolver.resolveInputs(
        conditionBlock,
        contextWithConnections
      )
      expect(conditionResult.conditions).toBe(
        '[{"id":"cond1","title":"if","value":"<start.input> === \\"Hello World\\""}]'
      ) // Conditions not resolved at input level

      const responseResult = connectionResolver.resolveInputs(responseBlock, contextWithConnections)
      expect(responseResult.content).toBe('Hello World') // Raw string for response
    })

    it('should properly format start.input when resolved directly via resolveBlockReferences', () => {
      // Test that start.input gets proper formatting for different block types
      const functionBlock: SerializedBlock = {
        id: 'test-function',
        metadata: { id: BlockType.FUNCTION, name: 'Test Function' },
        position: { x: 100, y: 100 },
        config: { tool: BlockType.FUNCTION, params: {} },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const conditionBlock: SerializedBlock = {
        id: 'test-condition',
        metadata: { id: BlockType.CONDITION, name: 'Test Condition' },
        position: { x: 200, y: 100 },
        config: { tool: BlockType.CONDITION, params: {} },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      // Test function block - should quote strings
      const functionResult = connectionResolver.resolveBlockReferences(
        'return <start.input>',
        contextWithConnections,
        functionBlock
      )
      expect(functionResult).toBe('return "Hello World"')

      // Test condition block - should quote strings
      const conditionResult = connectionResolver.resolveBlockReferences(
        '<start.input> === "test"',
        contextWithConnections,
        conditionBlock
      )
      expect(conditionResult).toBe('"Hello World" === "test"')

      // Test other block types - should use raw string
      const otherBlock: SerializedBlock = {
        id: 'test-other',
        metadata: { id: 'other', name: 'Other Block' },
        position: { x: 300, y: 100 },
        config: { tool: 'other', params: {} },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const otherResult = connectionResolver.resolveBlockReferences(
        'content: <start.input>',
        contextWithConnections,
        otherBlock
      )
      expect(otherResult).toBe('content: Hello World')
    })

    it('should provide helpful error messages for unconnected blocks', () => {
      // Create a test block in the workflow first
      workflowWithConnections.blocks.push({
        id: 'test-block-2',
        metadata: { id: BlockType.FUNCTION, name: 'Test Block 2' },
        position: { x: 600, y: 600 },
        config: { tool: BlockType.FUNCTION, params: {} },
        inputs: {},
        outputs: {},
        enabled: true,
      })

      // Add a connection so test-block-2 can reference agent-1
      workflowWithConnections.connections.push({ source: 'agent-1', target: 'test-block-2' })

      // Update the accessibility map for test-block-2 to include the new connection
      const testBlock2Accessible = new Set<string>()
      workflowWithConnections.connections.forEach((conn) => {
        if (conn.target === 'test-block-2') {
          testBlock2Accessible.add(conn.source)
        }
      })
      // Always allow starter block access
      const starterBlock = workflowWithConnections.blocks.find(
        (b) => b.metadata?.id === BlockType.STARTER
      )
      if (starterBlock) {
        testBlock2Accessible.add(starterBlock.id)
      }
      connectionResolver.accessibleBlocksMap?.set('test-block-2', testBlock2Accessible)

      const testBlock: SerializedBlock = {
        id: 'test-block-2',
        metadata: { id: BlockType.FUNCTION, name: 'Test Block 2' },
        position: { x: 600, y: 600 },
        config: {
          tool: BlockType.FUNCTION,
          params: {
            code: 'return <nonexistent.value>',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      expect(() => connectionResolver.resolveInputs(testBlock, contextWithConnections)).toThrow(
        /Available connected blocks:.*Agent Block.*Start/
      )
    })

    it('should work with block names and normalized names', () => {
      const functionBlock = workflowWithConnections.blocks[2] // function-1
      const testBlock: SerializedBlock = {
        ...functionBlock,
        config: {
          tool: BlockType.FUNCTION,
          params: {
            nameRef: '<Agent Block.content>', // Reference by actual name
            normalizedRef: '<agentblock.content>', // Reference by normalized name
            idRef: '<agent-1.content>', // Reference by ID
          },
        },
      }

      const result = connectionResolver.resolveInputs(testBlock, contextWithConnections)
      expect(result.nameRef).toBe('"Agent response"') // Should be quoted for function blocks
      expect(result.normalizedRef).toBe('"Agent response"') // Should be quoted for function blocks
      expect(result.idRef).toBe('"Agent response"') // Should be quoted for function blocks
    })

    it('should handle complex connection graphs', () => {
      // Add a new block connected to function-1
      const extendedWorkflow = {
        ...workflowWithConnections,
        blocks: [
          ...workflowWithConnections.blocks,
          {
            id: 'response-1',
            metadata: { id: BlockType.RESPONSE, name: 'Response Block' },
            position: { x: 400, y: 400 },
            config: { tool: BlockType.RESPONSE, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
        ],
        connections: [
          ...workflowWithConnections.connections,
          { source: 'function-1', target: 'response-1' },
        ],
      }

      // Create accessibility map for extended workflow
      const extendedAccessibilityMap = new Map<string, Set<string>>()
      const extendedTestBlockIds = [
        'test-response-block',
        'test-block',
        'test-block-2',
        'generic-block',
      ]

      extendedWorkflow.blocks.forEach((block) => {
        const accessibleBlocks = new Set<string>()
        // Add directly connected blocks (sources that connect to this block)
        extendedWorkflow.connections.forEach((conn) => {
          if (conn.target === block.id) {
            accessibleBlocks.add(conn.source)
          }
        })
        // Always allow starter block access
        const starterBlock = extendedWorkflow.blocks.find(
          (b) => b.metadata?.id === BlockType.STARTER
        )
        if (starterBlock) {
          accessibleBlocks.add(starterBlock.id)
        }
        extendedAccessibilityMap.set(block.id, accessibleBlocks)
      })

      // Set up accessibility for test blocks
      extendedTestBlockIds.forEach((testId) => {
        const accessibleBlocks = new Set<string>()
        // Add directly connected blocks
        extendedWorkflow.connections.forEach((conn) => {
          if (conn.target === testId) {
            accessibleBlocks.add(conn.source)
          }
        })
        // Always allow starter block access
        const starterBlock = extendedWorkflow.blocks.find(
          (b) => b.metadata?.id === BlockType.STARTER
        )
        if (starterBlock) {
          accessibleBlocks.add(starterBlock.id)
        }
        extendedAccessibilityMap.set(testId, accessibleBlocks)
      })

      const extendedResolver = new InputResolver(
        extendedWorkflow,
        {},
        {},
        undefined,
        extendedAccessibilityMap
      )
      const responseBlock = extendedWorkflow.blocks[4] // response-1
      const testBlock: SerializedBlock = {
        ...responseBlock,
        config: {
          tool: BlockType.RESPONSE,
          params: {
            canReferenceFunction: '<function-1.result>', // Can reference directly connected function-1
            cannotReferenceAgent: '<agent-1.content>', // Cannot reference agent-1 (not directly connected)
          },
        },
      }

      const extendedContext = {
        ...contextWithConnections,
        workflow: extendedWorkflow,
        blockStates: new Map([
          ...contextWithConnections.blockStates,
          [
            'response-1',
            { output: { message: 'Final response' }, executed: true, executionTime: 0 },
          ],
        ]),
      }

      // Should work for direct connection
      expect(() => {
        const block1 = {
          ...testBlock,
          config: { tool: BlockType.RESPONSE, params: { test: '<function-1.result>' } },
        }
        extendedResolver.resolveInputs(block1, extendedContext)
      }).not.toThrow()

      // Should fail for indirect connection
      expect(() => {
        // Add the response block to the workflow so it can be validated properly
        extendedWorkflow.blocks.push({
          id: 'test-response-block',
          metadata: { id: BlockType.RESPONSE, name: 'Test Response Block' },
          position: { x: 500, y: 500 },
          config: { tool: BlockType.RESPONSE, params: {} },
          inputs: {},
          outputs: {},
          enabled: true,
        })
        extendedWorkflow.connections.push({ source: 'function-1', target: 'test-response-block' })

        const block2 = {
          id: 'test-response-block',
          metadata: { id: BlockType.RESPONSE, name: 'Test Response Block' },
          position: { x: 500, y: 500 },
          config: { tool: BlockType.RESPONSE, params: { test: '<agent-1.content>' } },
          inputs: {},
          outputs: {},
          enabled: true,
        }
        extendedResolver.resolveInputs(block2, extendedContext)
      }).toThrow(/Block "agent-1" is not connected to this block/)
    })

    it('should handle blocks in same loop referencing each other', () => {
      const loopWorkflow: SerializedWorkflow = {
        version: '1.0',
        blocks: [
          {
            id: 'starter-1',
            metadata: { id: BlockType.STARTER, name: 'Start' },
            position: { x: 0, y: 0 },
            config: { tool: BlockType.STARTER, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
          {
            id: 'loop-1',
            metadata: { id: BlockType.LOOP, name: 'Loop' },
            position: { x: 100, y: 100 },
            config: { tool: '', params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
          {
            id: 'function-1',
            metadata: { id: BlockType.FUNCTION, name: 'Function 1' },
            position: { x: 200, y: 200 },
            config: { tool: BlockType.FUNCTION, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
          {
            id: 'function-2',
            metadata: { id: BlockType.FUNCTION, name: 'Function 2' },
            position: { x: 300, y: 300 },
            config: { tool: BlockType.FUNCTION, params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
        ],
        connections: [{ source: 'starter-1', target: 'loop-1' }],
        loops: {
          'loop-1': {
            id: 'loop-1',
            nodes: ['function-1', 'function-2'], // Both functions in same loop
            iterations: 3,
            loopType: 'for',
          },
        },
      }

      // Create accessibility map for loop workflow
      const loopAccessibilityMap = new Map<string, Set<string>>()
      const loopTestBlockIds = ['test-block', 'test-block-2', 'generic-block']

      loopWorkflow.blocks.forEach((block) => {
        const accessibleBlocks = new Set<string>()
        // Add directly connected blocks
        loopWorkflow.connections.forEach((conn) => {
          if (conn.target === block.id) {
            accessibleBlocks.add(conn.source)
          }
        })
        // Always allow starter block access
        const starterBlock = loopWorkflow.blocks.find((b) => b.metadata?.id === BlockType.STARTER)
        if (starterBlock) {
          accessibleBlocks.add(starterBlock.id)
        }
        // Allow blocks in same loop to reference each other
        const blockLoop = Object.values(loopWorkflow.loops || {}).find((loop) =>
          loop.nodes.includes(block.id)
        )
        if (blockLoop) {
          blockLoop.nodes.forEach((nodeId) => accessibleBlocks.add(nodeId))
        }
        loopAccessibilityMap.set(block.id, accessibleBlocks)
      })

      // Set up accessibility for test blocks
      loopTestBlockIds.forEach((testId) => {
        const accessibleBlocks = new Set<string>()
        // Add directly connected blocks
        loopWorkflow.connections.forEach((conn) => {
          if (conn.target === testId) {
            accessibleBlocks.add(conn.source)
          }
        })
        // Always allow starter block access
        const starterBlock = loopWorkflow.blocks.find((b) => b.metadata?.id === BlockType.STARTER)
        if (starterBlock) {
          accessibleBlocks.add(starterBlock.id)
        }
        loopAccessibilityMap.set(testId, accessibleBlocks)
      })

      const loopResolver = new InputResolver(loopWorkflow, {}, {}, undefined, loopAccessibilityMap)
      const testBlock: SerializedBlock = {
        ...loopWorkflow.blocks[2],
        config: {
          tool: BlockType.FUNCTION,
          params: {
            code: 'return <function-2.result>', // function-1 can reference function-2 (same loop)
          },
        },
      }

      const loopContext = {
        ...contextWithConnections,
        workflow: loopWorkflow,
        blockStates: new Map([
          ['starter-1', { output: { input: 'Hello' }, executed: true, executionTime: 0 }],
          ['function-1', { output: { result: 'Result 1' }, executed: true, executionTime: 0 }],
          ['function-2', { output: { result: 'Result 2' }, executed: true, executionTime: 0 }],
        ]),
      }

      expect(() => loopResolver.resolveInputs(testBlock, loopContext)).not.toThrow()
    })
  })

  describe('Conditional Input Filtering', () => {
    const mockGetBlock = getBlock as ReturnType<typeof vi.fn>

    afterEach(() => {
      mockGetBlock.mockReset()
    })

    it('should filter inputs based on operation conditions for Knowledge block', () => {
      // Mock the Knowledge block configuration
      mockGetBlock.mockReturnValue({
        type: 'knowledge',
        subBlocks: [
          {
            id: 'operation',
            type: 'dropdown',
            options: [
              { label: 'Search', id: 'search' },
              { label: 'Upload Chunk', id: 'upload_chunk' },
            ],
          },
          {
            id: 'query',
            type: 'short-input',
            condition: { field: 'operation', value: 'search' },
          },
          {
            id: 'knowledgeBaseIds',
            type: 'knowledge-base-selector',
            condition: { field: 'operation', value: 'search' },
          },
          {
            id: 'documentId',
            type: 'document-selector',
            condition: { field: 'operation', value: 'upload_chunk' },
          },
          {
            id: 'content',
            type: 'long-input',
            condition: { field: 'operation', value: 'upload_chunk' },
          },
        ],
      })

      // Create a Knowledge block with upload_chunk operation
      const knowledgeBlock: SerializedBlock = {
        id: 'knowledge-block',
        metadata: { id: 'knowledge', name: 'Knowledge Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'knowledge',
          params: {
            operation: 'upload_chunk',
            query: '<start.docName>', // This should be filtered out
            knowledgeBaseIds: 'kb-1', // This should be filtered out
            documentId: 'doc-1', // This should be included
            content: 'chunk content', // This should be included
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(knowledgeBlock, mockContext)

      // Should only include inputs for upload_chunk operation
      expect(result).toHaveProperty('operation', 'upload_chunk')
      expect(result).toHaveProperty('documentId', 'doc-1')
      expect(result).toHaveProperty('content', 'chunk content')

      // Should NOT include inputs for search operation
      expect(result).not.toHaveProperty('query')
      expect(result).not.toHaveProperty('knowledgeBaseIds')
    })

    it('should filter inputs based on operation conditions for Knowledge block search operation', () => {
      // Mock the Knowledge block configuration
      mockGetBlock.mockReturnValue({
        type: 'knowledge',
        subBlocks: [
          {
            id: 'operation',
            type: 'dropdown',
            options: [
              { label: 'Search', id: 'search' },
              { label: 'Upload Chunk', id: 'upload_chunk' },
            ],
          },
          {
            id: 'query',
            type: 'short-input',
            condition: { field: 'operation', value: 'search' },
          },
          {
            id: 'knowledgeBaseIds',
            type: 'knowledge-base-selector',
            condition: { field: 'operation', value: 'search' },
          },
          {
            id: 'documentId',
            type: 'document-selector',
            condition: { field: 'operation', value: 'upload_chunk' },
          },
          {
            id: 'content',
            type: 'long-input',
            condition: { field: 'operation', value: 'upload_chunk' },
          },
        ],
      })

      // Create a Knowledge block with search operation
      const knowledgeBlock: SerializedBlock = {
        id: 'knowledge-block',
        metadata: { id: 'knowledge', name: 'Knowledge Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'knowledge',
          params: {
            operation: 'search',
            query: 'search query',
            knowledgeBaseIds: 'kb-1',
            documentId: 'doc-1', // This should be filtered out
            content: 'chunk content', // This should be filtered out
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(knowledgeBlock, mockContext)

      // Should only include inputs for search operation
      expect(result).toHaveProperty('operation', 'search')
      expect(result).toHaveProperty('query', 'search query')
      expect(result).toHaveProperty('knowledgeBaseIds', 'kb-1')

      // Should NOT include inputs for upload_chunk operation
      expect(result).not.toHaveProperty('documentId')
      expect(result).not.toHaveProperty('content')
    })

    it('should handle array conditions correctly', () => {
      // Mock a block with array condition
      mockGetBlock.mockReturnValue({
        type: 'test-block',
        subBlocks: [
          {
            id: 'operation',
            type: 'dropdown',
            options: [
              { label: 'Create', id: 'create' },
              { label: 'Update', id: 'update' },
              { label: 'Delete', id: 'delete' },
            ],
          },
          {
            id: 'data',
            type: 'long-input',
            condition: { field: 'operation', value: ['create', 'update'] },
          },
          {
            id: 'id',
            type: 'short-input',
            condition: { field: 'operation', value: ['update', 'delete'] },
          },
        ],
      })

      const testBlock: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'test-block', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'test-block',
          params: {
            operation: 'update',
            data: 'some data',
            id: 'item-1',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(testBlock, mockContext)

      // Should include inputs for update operation (both data and id)
      expect(result).toHaveProperty('operation', 'update')
      expect(result).toHaveProperty('data', 'some data')
      expect(result).toHaveProperty('id', 'item-1')
    })

    it('should include all inputs when no conditions are present', () => {
      // Mock a block with no conditions
      mockGetBlock.mockReturnValue({
        type: 'simple-block',
        subBlocks: [
          {
            id: 'param1',
            type: 'short-input',
          },
          {
            id: 'param2',
            type: 'long-input',
          },
        ],
      })

      const simpleBlock: SerializedBlock = {
        id: 'simple-block',
        metadata: { id: 'simple-block', name: 'Simple Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'simple-block',
          params: {
            param1: 'value1',
            param2: 'value2',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(simpleBlock, mockContext)

      // Should include all inputs
      expect(result).toHaveProperty('param1', 'value1')
      expect(result).toHaveProperty('param2', 'value2')
    })

    it('should return all inputs when block config is not found', () => {
      // Mock getBlock to return undefined
      mockGetBlock.mockReturnValue(undefined)

      const unknownBlock: SerializedBlock = {
        id: 'unknown-block',
        metadata: { id: 'unknown-type', name: 'Unknown Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'unknown-type',
          params: {
            param1: 'value1',
            param2: 'value2',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(unknownBlock, mockContext)

      // Should include all inputs when block config is not found
      expect(result).toHaveProperty('param1', 'value1')
      expect(result).toHaveProperty('param2', 'value2')
    })

    it('should handle negated conditions correctly', () => {
      // Mock a block with negated condition
      mockGetBlock.mockReturnValue({
        type: 'test-block',
        subBlocks: [
          {
            id: 'operation',
            type: 'dropdown',
            options: [
              { label: 'Create', id: 'create' },
              { label: 'Delete', id: 'delete' },
            ],
          },
          {
            id: 'confirmationField',
            type: 'short-input',
            condition: { field: 'operation', value: 'create', not: true },
          },
        ],
      })

      const testBlock: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'test-block', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'test-block',
          params: {
            operation: 'delete',
            confirmationField: 'confirmed',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(testBlock, mockContext)

      // Should include confirmationField because operation is NOT 'create'
      expect(result).toHaveProperty('operation', 'delete')
      expect(result).toHaveProperty('confirmationField', 'confirmed')
    })

    it('should handle compound AND conditions correctly', () => {
      // Mock a block with compound AND condition
      mockGetBlock.mockReturnValue({
        type: 'test-block',
        subBlocks: [
          {
            id: 'operation',
            type: 'dropdown',
            options: [
              { label: 'Create', id: 'create' },
              { label: 'Update', id: 'update' },
            ],
          },
          {
            id: 'enabled',
            type: 'switch',
          },
          {
            id: 'specialField',
            type: 'short-input',
            condition: {
              field: 'operation',
              value: 'update',
              and: { field: 'enabled', value: true },
            },
          },
        ],
      })

      const testBlock: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'test-block', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'test-block',
          params: {
            operation: 'update',
            enabled: true,
            specialField: 'special value',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(testBlock, mockContext)

      // Should include specialField because operation is 'update' AND enabled is true
      expect(result).toHaveProperty('operation', 'update')
      expect(result).toHaveProperty('enabled', true)
      expect(result).toHaveProperty('specialField', 'special value')
    })

    it('should always include inputs without conditions', () => {
      // Mock a block with mixed conditions
      mockGetBlock.mockReturnValue({
        type: 'test-block',
        subBlocks: [
          {
            id: 'operation',
            type: 'dropdown',
            // No condition - should always be included
          },
          {
            id: 'alwaysVisible',
            type: 'short-input',
            // No condition - should always be included
          },
          {
            id: 'conditionalField',
            type: 'short-input',
            condition: { field: 'operation', value: 'search' },
          },
        ],
      })

      const testBlock: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'test-block', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'test-block',
          params: {
            operation: 'upload',
            alwaysVisible: 'always here',
            conditionalField: 'should be filtered out',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(testBlock, mockContext)

      // Should include inputs without conditions
      expect(result).toHaveProperty('operation', 'upload')
      expect(result).toHaveProperty('alwaysVisible', 'always here')

      // Should NOT include conditional field that doesn't match
      expect(result).not.toHaveProperty('conditionalField')
    })

    it('should handle duplicate field names with different conditions (Knowledge block case)', () => {
      // Mock Knowledge block with duplicate content fields
      mockGetBlock.mockReturnValue({
        type: 'knowledge',
        subBlocks: [
          {
            id: 'operation',
            type: 'dropdown',
          },
          {
            id: 'content',
            title: 'Chunk Content',
            type: 'long-input',
            condition: { field: 'operation', value: 'upload_chunk' },
          },
          {
            id: 'content',
            title: 'Document Content',
            type: 'long-input',
            condition: { field: 'operation', value: 'create_document' },
          },
        ],
      })

      // Test upload_chunk operation
      const uploadChunkBlock: SerializedBlock = {
        id: 'knowledge-block',
        metadata: { id: 'knowledge', name: 'Knowledge Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'knowledge',
          params: {
            operation: 'upload_chunk',
            content: 'chunk content here',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result1 = resolver.resolveInputs(uploadChunkBlock, mockContext)
      expect(result1).toHaveProperty('operation', 'upload_chunk')
      expect(result1).toHaveProperty('content', 'chunk content here')

      // Test create_document operation
      const createDocBlock: SerializedBlock = {
        id: 'knowledge-block',
        metadata: { id: 'knowledge', name: 'Knowledge Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'knowledge',
          params: {
            operation: 'create_document',
            content: 'document content here',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result2 = resolver.resolveInputs(createDocBlock, mockContext)
      expect(result2).toHaveProperty('operation', 'create_document')
      expect(result2).toHaveProperty('content', 'document content here')

      // Test search operation (should NOT include content)
      const searchBlock: SerializedBlock = {
        id: 'knowledge-block',
        metadata: { id: 'knowledge', name: 'Knowledge Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'knowledge',
          params: {
            operation: 'search',
            content: 'should be filtered out',
          },
        },
        inputs: {},
        outputs: {},
        enabled: true,
      }

      const result3 = resolver.resolveInputs(searchBlock, mockContext)
      expect(result3).toHaveProperty('operation', 'search')
      expect(result3).not.toHaveProperty('content')
    })
  })

  describe('Variable Reference Validation', () => {
    it('should allow block references without dots like <start>', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            content: 'Value from <start> block',
          },
        },
        inputs: {
          content: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.content).not.toBe('Value from <start> block')
    })

    it('should allow other block references without dots', () => {
      const testAccessibility = new Map<string, Set<string>>()
      const allIds = [
        'starter-block',
        'function-block',
        'condition-block',
        'api-block',
        'testblock',
      ]
      allIds.forEach((id) => {
        testAccessibility.set(id, new Set(allIds))
      })
      testAccessibility.set('test-block', new Set(allIds))

      const testResolver = new InputResolver(
        sampleWorkflow,
        mockEnvironmentVars,
        mockWorkflowVars,
        undefined,
        testAccessibility
      )

      const extendedWorkflow = {
        ...sampleWorkflow,
        blocks: [
          ...sampleWorkflow.blocks,
          {
            id: 'testblock',
            metadata: { id: 'generic', name: 'TestBlock' },
            position: { x: 500, y: 100 },
            config: { tool: 'generic', params: {} },
            inputs: {},
            outputs: {},
            enabled: true,
          },
        ],
      }

      const extendedContext = {
        ...mockContext,
        workflow: extendedWorkflow,
        blockStates: new Map([
          ...mockContext.blockStates,
          ['testblock', { output: { result: 'test result' } }],
        ]),
        activeExecutionPath: new Set([...mockContext.activeExecutionPath, 'testblock']),
      }

      const testResolverWithExtended = new InputResolver(
        extendedWorkflow,
        mockEnvironmentVars,
        mockWorkflowVars,
        undefined,
        testAccessibility
      )

      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            content: 'Value from <testblock> is here',
          },
        },
        inputs: {
          content: 'string',
        },
        outputs: {},
        enabled: true,
      }

      expect(() => testResolverWithExtended.resolveInputs(block, extendedContext)).not.toThrow()
    })

    it('should reject operator expressions that look like comparisons', () => {
      const block: SerializedBlock = {
        id: 'condition-block',
        metadata: { id: BlockType.CONDITION, name: 'Condition Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'condition',
          params: {
            conditions: 'x < 5 && 8 > b',
          },
        },
        inputs: {
          conditions: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.conditions).toBe('x < 5 && 8 > b')
    })

    it('should still allow regular dotted references', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            starterInput: '<start.input>',
            functionResult: '<function-block.result>',
            variableRef: '<variable.stringVar>',
          },
        },
        inputs: {
          starterInput: 'string',
          functionResult: 'string',
          variableRef: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.starterInput).toBe('Hello World')
      expect(result.functionResult).toBe('42')
      expect(result.variableRef).toBe('Hello')
    })

    it('should handle complex expressions with both valid references and operators', () => {
      const block: SerializedBlock = {
        id: 'condition-block',
        metadata: { id: BlockType.CONDITION, name: 'Condition Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'condition',
          params: {
            conditions:
              '<start.input> === "Hello" && x < 5 && 8 > y && <function-block.result> !== null',
          },
        },
        inputs: {
          conditions: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.conditions).toBe(
        '<start.input> === "Hello" && x < 5 && 8 > y && <function-block.result> !== null'
      )
    })

    it('should reject numeric patterns that look like arithmetic', () => {
      const block: SerializedBlock = {
        id: 'test-block',
        metadata: { id: 'generic', name: 'Test Block' },
        position: { x: 0, y: 0 },
        config: {
          tool: 'generic',
          params: {
            content1: 'value < 5 is true',
            content2: 'check 8 > x condition',
            content3: 'result = 10 + 5',
          },
        },
        inputs: {
          content1: 'string',
          content2: 'string',
          content3: 'string',
        },
        outputs: {},
        enabled: true,
      }

      const result = resolver.resolveInputs(block, mockContext)

      expect(result.content1).toBe('value < 5 is true')
      expect(result.content2).toBe('check 8 > x condition')
      expect(result.content3).toBe('result = 10 + 5')
    })
  })
})
