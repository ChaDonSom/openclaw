/**
 * JSON Schema to Zod Converter
 * 
 * Converts OpenClaw's JSON Schema tool definitions to Zod schemas
 * required by Copilot SDK.
 */

import { z } from 'zod';

export type JSONSchema = {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  description?: string;
};

/**
 * Convert a JSON Schema property to a Zod type
 */
function convertProperty(schema: any): z.ZodTypeAny {
  if (!schema) {
    return z.any();
  }

  const type = schema.type;
  const description = schema.description || '';

  switch (type) {
    case 'string':
      let stringSchema = z.string();
      if (description) {
        stringSchema = stringSchema.describe(description);
      }
      return stringSchema;

    case 'number':
    case 'integer':
      let numberSchema = z.number();
      if (description) {
        numberSchema = numberSchema.describe(description);
      }
      return numberSchema;

    case 'boolean':
      let boolSchema = z.boolean();
      if (description) {
        boolSchema = boolSchema.describe(description);
      }
      return boolSchema;

    case 'array':
      const itemSchema = schema.items ? convertProperty(schema.items) : z.any();
      let arraySchema = z.array(itemSchema);
      if (description) {
        arraySchema = arraySchema.describe(description);
      }
      return arraySchema;

    case 'object':
      if (schema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
          shape[key] = convertProperty(prop);
        }
        let objectSchema = z.object(shape);
        if (description) {
          objectSchema = objectSchema.describe(description);
        }
        return objectSchema;
      }
      return z.record(z.string(), z.any());

    default:
      return z.any();
  }
}

/**
 * Convert a full JSON Schema to a Zod object schema
 */
export function jsonSchemaToZod(schema: JSONSchema): z.ZodObject<any> {
  if (schema.type !== 'object') {
    throw new Error('Top-level schema must be an object');
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema.required || []);

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      let zodType = convertProperty(propSchema);
      
      // Make optional if not in required array
      if (!required.has(key)) {
        zodType = zodType.optional();
      }
      
      shape[key] = zodType;
    }
  }

  return z.object(shape);
}

/**
 * Test the converter
 */
export function testConverter() {
  // Test case: exec tool schema
  const execSchema: JSONSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
      },
      workdir: {
        type: 'string',
        description: 'Working directory',
      },
    },
    required: ['command'],
  };

  const zodSchema = jsonSchemaToZod(execSchema);
  
  // Test validation
  const valid = zodSchema.safeParse({ command: 'ls -la' });
  const withOptional = zodSchema.safeParse({ 
    command: 'ls -la', 
    timeout: 5000,
    workdir: '/tmp' 
  });
  const invalid = zodSchema.safeParse({ timeout: 5000 }); // Missing required 'command'

  console.log('Valid:', valid.success); // true
  console.log('With optional:', withOptional.success); // true
  console.log('Invalid:', invalid.success); // false

  return zodSchema;
}
