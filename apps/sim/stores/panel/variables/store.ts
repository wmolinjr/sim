import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { createLogger } from '@/lib/logs/console/logger'
import type { Variable, VariablesStore } from '@/stores/panel/variables/types'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useSubBlockStore } from '@/stores/workflows/subblock/store'

const logger = createLogger('VariablesStore')

/**
 * Check if variable format is valid according to type without modifying it
 * Only provides validation feedback - does not change the value
 */
function validateVariable(variable: Variable): string | undefined {
  try {
    // We only care about the validation result, not the parsed value
    switch (variable.type) {
      case 'number':
        // Check if it's a valid number
        if (Number.isNaN(Number(variable.value))) {
          return 'Not a valid number'
        }
        break
      case 'boolean':
        // Check if it's a valid boolean
        if (!/^(true|false)$/i.test(String(variable.value).trim())) {
          return 'Expected "true" or "false"'
        }
        break
      case 'object':
        // Check if it's a valid JSON object
        try {
          // Handle both JavaScript and JSON syntax
          const valueToEvaluate = String(variable.value).trim()

          // Basic security check to prevent arbitrary code execution
          if (!valueToEvaluate.startsWith('{') || !valueToEvaluate.endsWith('}')) {
            return 'Not a valid object format'
          }

          // Use Function constructor to safely evaluate the object expression
          // This handles both JSON and JS object literal syntax
          const parsed = new Function(`return ${valueToEvaluate}`)()

          // Verify it's actually an object (not array or null)
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return 'Not a valid object'
          }

          return undefined // Valid object
        } catch (e) {
          logger.error('Object parsing error:', e)
          return 'Invalid object syntax'
        }
      case 'array':
        // Check if it's a valid JSON array
        try {
          const parsed = JSON.parse(String(variable.value))
          if (!Array.isArray(parsed)) {
            return 'Not a valid JSON array'
          }
        } catch {
          return 'Invalid JSON array syntax'
        }
        break
    }
    return undefined
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid format'
  }
}

/**
 * Migrates a variable from 'string' type to 'plain' type
 * Handles the value conversion appropriately
 */
function migrateStringToPlain(variable: Variable): Variable {
  if (variable.type !== 'string') {
    return variable
  }

  // Convert string type to plain
  const updated = {
    ...variable,
    type: 'plain' as const,
  }

  // For plain text, we want to preserve values exactly as they are,
  // including any quote characters that may be part of the text
  return updated
}

export const useVariablesStore = create<VariablesStore>()(
  devtools((set, get) => ({
    variables: {},
    isLoading: false,
    error: null,
    isEditing: null,

    async loadForWorkflow(workflowId) {
      try {
        set({ isLoading: true, error: null })
        const res = await fetch(`/api/workflows/${workflowId}/variables`, { method: 'GET' })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Failed to load variables: ${res.statusText}`)
        }
        const data = await res.json()
        const variables = (data?.data as Record<string, Variable>) || {}
        set((state) => {
          const withoutWorkflow = Object.fromEntries(
            Object.entries(state.variables).filter(
              (entry): entry is [string, Variable] => entry[1].workflowId !== workflowId
            )
          )
          return {
            variables: { ...withoutWorkflow, ...variables },
            isLoading: false,
            error: null,
          }
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        set({ isLoading: false, error: message })
      }
    },

    addVariable: (variable, providedId?: string) => {
      const id = providedId || crypto.randomUUID()

      // Get variables for this workflow
      const workflowVariables = get().getVariablesByWorkflowId(variable.workflowId)

      // Auto-generate variable name if not provided or it's a default pattern name
      if (!variable.name || /^variable\d+$/.test(variable.name)) {
        // Find the highest existing Variable N number
        const existingNumbers = workflowVariables
          .map((v) => {
            const match = v.name.match(/^variable(\d+)$/)
            return match ? Number.parseInt(match[1]) : 0
          })
          .filter((n) => !Number.isNaN(n))

        // Set new number to max + 1, or 1 if none exist
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1

        variable.name = `variable${nextNumber}`
      }

      // Ensure name uniqueness within the workflow
      let uniqueName = variable.name
      let nameIndex = 1

      // Check if name already exists in this workflow
      while (workflowVariables.some((v) => v.name === uniqueName)) {
        uniqueName = `${variable.name} (${nameIndex})`
        nameIndex++
      }

      // Check for type conversion - only for backward compatibility
      if (variable.type === 'string') {
        variable.type = 'plain'
      }

      // Create the new variable with empty value
      const newVariable: Variable = {
        id,
        workflowId: variable.workflowId,
        name: uniqueName,
        type: variable.type,
        value: variable.value || '',
        validationError: undefined,
      }

      // Check for validation errors without modifying the value
      const validationError = validateVariable(newVariable)
      if (validationError) {
        newVariable.validationError = validationError
      }

      set((state) => ({
        variables: {
          ...state.variables,
          [id]: newVariable,
        },
      }))

      return id
    },

    updateVariable: (id, update) => {
      set((state) => {
        if (!state.variables[id]) return state

        // If name is being updated, ensure it's unique
        if (update.name !== undefined) {
          const oldVariable = state.variables[id]
          const oldVariableName = oldVariable.name
          const workflowId = oldVariable.workflowId
          const workflowVariables = Object.values(state.variables).filter(
            (v) => v.workflowId === workflowId && v.id !== id
          )

          let uniqueName = update.name
          let nameIndex = 1

          // Only check uniqueness for non-empty names
          // Empty names don't need to be unique as they're temporary states
          if (uniqueName.trim() !== '') {
            // Check if name already exists in this workflow
            while (workflowVariables.some((v) => v.name === uniqueName)) {
              uniqueName = `${update.name} (${nameIndex})`
              nameIndex++
            }
          }

          // Always update references in subblocks when name changes, even if empty
          // This ensures references are updated even when name is completely cleared
          if (uniqueName !== oldVariableName) {
            // Update references in subblock store
            const subBlockStore = useSubBlockStore.getState()
            const activeWorkflowId = useWorkflowRegistry.getState().activeWorkflowId

            if (activeWorkflowId) {
              // Get the workflow values for the active workflow
              const workflowValues = subBlockStore.workflowValues[activeWorkflowId] || {}
              const updatedWorkflowValues = { ...workflowValues }

              // Loop through blocks
              Object.entries(workflowValues).forEach(([blockId, blockValues]) => {
                // Loop through subblocks and update references
                Object.entries(blockValues as Record<string, any>).forEach(
                  ([subBlockId, value]) => {
                    const oldVarName = oldVariableName.replace(/\s+/g, '').toLowerCase()
                    const newVarName = uniqueName.replace(/\s+/g, '').toLowerCase()
                    const regex = new RegExp(`<variable\.${oldVarName}>`, 'gi')

                    // Use a recursive function to handle all object types
                    updatedWorkflowValues[blockId][subBlockId] = updateReferences(
                      value,
                      regex,
                      `<variable.${newVarName}>`
                    )

                    // Helper function to recursively update references in any data structure
                    function updateReferences(value: any, regex: RegExp, replacement: string): any {
                      // Handle string values
                      if (typeof value === 'string') {
                        return regex.test(value) ? value.replace(regex, replacement) : value
                      }

                      // Handle arrays
                      if (Array.isArray(value)) {
                        return value.map((item) => updateReferences(item, regex, replacement))
                      }

                      // Handle objects
                      if (value !== null && typeof value === 'object') {
                        const result = { ...value }
                        for (const key in result) {
                          result[key] = updateReferences(result[key], regex, replacement)
                        }
                        return result
                      }

                      // Return unchanged for other types
                      return value
                    }
                  }
                )
              })

              // Update the subblock store with the new values
              useSubBlockStore.setState({
                workflowValues: {
                  ...subBlockStore.workflowValues,
                  [activeWorkflowId]: updatedWorkflowValues,
                },
              })
            }
          }

          // Update with unique name
          update = { ...update, name: uniqueName }
        }

        // If type is being updated to 'string', convert it to 'plain' instead
        if (update.type === 'string') {
          update = { ...update, type: 'plain' }
        }

        // Create updated variable to check for validation
        const updatedVariable: Variable = {
          ...state.variables[id],
          ...update,
          validationError: undefined, // Initialize property to be updated later
        }

        // If the type or value changed, check for validation errors
        if (update.type || update.value !== undefined) {
          // Only add validation feedback - never modify the value
          updatedVariable.validationError = validateVariable(updatedVariable)
        }

        const updated = {
          ...state.variables,
          [id]: updatedVariable,
        }

        return { variables: updated }
      })
    },

    deleteVariable: (id) => {
      set((state) => {
        if (!state.variables[id]) return state

        const workflowId = state.variables[id].workflowId
        const { [id]: _, ...rest } = state.variables

        return { variables: rest }
      })
    },

    duplicateVariable: (id, providedId?: string) => {
      const state = get()
      if (!state.variables[id]) return ''

      const variable = state.variables[id]
      const newId = providedId || crypto.randomUUID()

      // Ensure the duplicated name is unique
      const workflowVariables = get().getVariablesByWorkflowId(variable.workflowId)
      const baseName = `${variable.name} (copy)`
      let uniqueName = baseName
      let nameIndex = 1

      // Check if name already exists in this workflow
      while (workflowVariables.some((v) => v.name === uniqueName)) {
        uniqueName = `${baseName} (${nameIndex})`
        nameIndex++
      }

      set((state) => ({
        variables: {
          ...state.variables,
          [newId]: {
            id: newId,
            workflowId: variable.workflowId,
            name: uniqueName,
            type: variable.type,
            value: variable.value,
          },
        },
      }))

      return newId
    },

    getVariablesByWorkflowId: (workflowId) => {
      return Object.values(get().variables).filter((variable) => variable.workflowId === workflowId)
    },
  }))
)
