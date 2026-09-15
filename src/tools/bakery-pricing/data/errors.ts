export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

export interface ReferencingRecipe {
  id: string
  name: string
}

// Thrown when deleting a reusable ingredient that is still referenced by at
// least one saved recipe. Carries enough detail for the (future) UI to show
// how many recipes use it and identify them by name, per the PRD.
//
// Uses explicit field declarations + constructor-body assignment rather
// than TypeScript's constructor-parameter-property shorthand: Node's
// --experimental-strip-types mode only strips type syntax, it does not
// transform code, and parameter properties require code generation
// (assigning `this.x = x`) that strip-only mode cannot perform.
export class IngredientInUseError extends Error {
  ingredientId: string
  referencingRecipes: ReferencingRecipe[]

  constructor(ingredientId: string, referencingRecipes: ReferencingRecipe[]) {
    super(
      `Ingredient is used in ${referencingRecipes.length} recipe(s): ${referencingRecipes
        .map((r) => r.name)
        .join(', ')}`,
    )
    this.name = 'IngredientInUseError'
    this.ingredientId = ingredientId
    this.referencingRecipes = referencingRecipes
  }
}

export interface AffectedUsage {
  usageId: string
  recipeId: string
}

// Thrown when changing a shared ingredient's package unit to a different
// measurement type would make an existing recipe usage incompatible.
export class IncompatibleMeasurementTypeError extends Error {
  ingredientId: string
  affectedUsages: AffectedUsage[]

  constructor(ingredientId: string, affectedUsages: AffectedUsage[]) {
    super(
      `Changing this ingredient's measurement type would break ${affectedUsages.length} existing recipe usage(s).`,
    )
    this.name = 'IncompatibleMeasurementTypeError'
    this.ingredientId = ingredientId
    this.affectedUsages = affectedUsages
  }
}

// --- Import/export errors -------------------------------------------------
// One typed error per distinct way an import file can be rejected, thrown
// by data/exportImport.ts's validation pass — before anything ever reaches
// IndexedDB. Each carries enough structured detail for a future UI to
// explain, in plain language, exactly what was wrong and where.

// The file is not valid JSON, or is valid JSON that does not have the
// shape of a Bakery Pricing Planner export at all (wrong/missing top-level
// fields, wrong application identifier, collections that are not arrays).
export class ImportFormatError extends Error {
  reason: string

  constructor(reason: string) {
    super(`This file cannot be imported: ${reason}`)
    this.name = 'ImportFormatError'
    this.reason = reason
  }
}

// The file is well-formed but declares an export-format or schema version
// this build does not know how to read. There is no migration path yet for
// older or newer versions — the import is rejected rather than guessed at.
export class UnsupportedImportVersionError extends Error {
  field: 'exportFormatVersion' | 'schemaVersion'
  found: number
  supported: number

  constructor(field: 'exportFormatVersion' | 'schemaVersion', found: number, supported: number) {
    super(`Unsupported ${field}: ${found} (this version of the tool supports ${supported}).`)
    this.name = 'UnsupportedImportVersionError'
    this.field = field
    this.found = found
    this.supported = supported
  }
}

// A field that must be an exact decimal string (per the DecimalString
// contract every price/quantity/percentage field uses) is missing, not a
// string, or not a value decimal.js can parse.
export class InvalidDecimalStringError extends Error {
  entity: string
  id: string
  field: string
  value: unknown

  constructor(entity: string, id: string, field: string, value: unknown) {
    super(`${entity} ${id}: field "${field}" is not a valid decimal string (got ${JSON.stringify(value)}).`)
    this.name = 'InvalidDecimalStringError'
    this.entity = entity
    this.id = id
    this.field = field
    this.value = value
  }
}

// A unit field is not one of the calc engine's known units at all.
export class InvalidUnitError extends Error {
  entity: string
  id: string
  field: string
  value: unknown

  constructor(entity: string, id: string, field: string, value: unknown) {
    super(`${entity} ${id}: field "${field}" is not a recognized unit (got ${JSON.stringify(value)}).`)
    this.name = 'InvalidUnitError'
    this.entity = entity
    this.id = id
    this.field = field
    this.value = value
  }
}

// A recipe-ingredient usage's amount unit is a recognized unit, but a
// different measurement type than the ingredient it names within the same
// import file — the cross-domain mismatch v1 always blocks.
export class IncompatibleUnitError extends Error {
  usageId: string
  ingredientId: string

  constructor(usageId: string, ingredientId: string) {
    super(
      `Recipe ingredient usage ${usageId} uses a unit whose measurement type does not match ingredient ${ingredientId}'s package unit.`,
    )
    this.name = 'IncompatibleUnitError'
    this.usageId = usageId
    this.ingredientId = ingredientId
  }
}

// A recipe-ingredient usage names an ingredientId or recipeId that is not
// present anywhere in the import file's own ingredient/recipe collections.
export class MissingReferenceError extends Error {
  usageId: string
  field: 'ingredientId' | 'recipeId'
  missingId: string

  constructor(usageId: string, field: 'ingredientId' | 'recipeId', missingId: string) {
    super(`Recipe ingredient usage ${usageId} references a ${field} that does not exist in this file: ${missingId}.`)
    this.name = 'MissingReferenceError'
    this.usageId = usageId
    this.field = field
    this.missingId = missingId
  }
}

// The same id appears more than once within one collection (ingredients,
// recipes, or usages) in the import file.
export class DuplicateIdentifierError extends Error {
  entity: string
  id: string

  constructor(entity: string, id: string) {
    super(`Duplicate ${entity} id in import file: ${id}.`)
    this.name = 'DuplicateIdentifierError'
    this.entity = entity
    this.id = id
  }
}

// importAndReplaceAll() refuses to run without an explicit confirmation
// flag — replacing the entire local database is destructive and must never
// happen as a side effect of merely validating or previewing a file.
export class ImportNotConfirmedError extends Error {
  constructor() {
    super('Import requires explicit confirmation before replacing existing data.')
    this.name = 'ImportNotConfirmedError'
  }
}
