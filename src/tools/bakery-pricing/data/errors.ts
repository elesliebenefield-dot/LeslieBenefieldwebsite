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
