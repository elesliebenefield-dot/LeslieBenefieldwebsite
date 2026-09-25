import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { deleteRecipe, duplicateRecipe, getRecipeWithUsages, listRecipes } from './data/recipeRepository.ts'
import { computeRecipeCostSummary, resolveRecipeIngredientLines } from './bakeryPricingRecipeSummary.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { EmptyState } from './EmptyState.tsx'
import { SectionIcon } from './SectionIcon.tsx'
import { BackupRestoreSection } from './BackupRestoreSection.tsx'
import type { StoredRecipe } from './data/types.ts'

interface Props {
  db: IDBDatabase
  onOpen: (recipeId: string) => void
  onNew: () => void
}

interface Row {
  recipe: StoredRecipe
  suggestedPerItemPrice: string | null
}

// A list/open/duplicate/delete screen for saved recipes. Each row's
// suggested price is recomputed live from the recipe's current ingredients
// and costs (never a cached figure), so an ingredient-price edit made in
// the Ingredient Library is reflected here automatically.
export function SavedRecipesScreen({ db, onOpen, onNew }: Props) {
  const [rows, setRows] = useState<Row[] | 'loading'>('loading')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function refresh() {
    const recipes = await listRecipes(db)
    recipes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const withSummaries = await Promise.all(
      recipes.map(async (recipe) => {
        const withUsages = await getRecipeWithUsages(db, recipe.id)
        const lines = await resolveRecipeIngredientLines(db, withUsages)
        const summary = computeRecipeCostSummary(recipe, lines, recipe.supplyItems)
        return { recipe, suggestedPerItemPrice: summary?.suggestedPerItemPrice ?? null }
      }),
    )
    setRows(withSummaries)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  async function handleDuplicate(recipe: StoredRecipe) {
    setBusyId(recipe.id)
    await duplicateRecipe(db, recipe.id, `${recipe.name} (Copy)`)
    setBusyId(null)
    await refresh()
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return
    await deleteRecipe(db, deleteTarget.id)
    setDeleteTarget(null)
    await refresh()
  }

  return (
    <div className="bp-step">
      <h2 className="bp-h2">
        <SectionIcon symbol="📖" tone="gold" /> Saved Recipes
      </h2>
      <p className="bp-helper bp-saved-recipes-storage-note">
        Your recipes are saved only in this browser on this device. Clearing your browser data or using a
        private window can erase them, so use Download Backup below to keep a copy.
      </p>

      <button type="button" className="bp-btn bp-btn-primary bp-saved-recipes-new" onClick={onNew}>
        + Price a New Recipe
      </button>

      {rows === 'loading' ? (
        <p className="bp-helper">Loading your saved recipes…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="📖">
          You haven't saved any recipes yet. Price one out and save it to start building your recipe box.
        </EmptyState>
      ) : (
        <ul className="bp-ingredient-list">
          {rows.map(({ recipe, suggestedPerItemPrice }) => (
            <li key={recipe.id} className="bp-ingredient-row bp-saved-row">
              <span>
                <button type="button" className="bp-link-btn bp-saved-recipe-name" onClick={() => onOpen(recipe.id)}>
                  {recipe.name}
                </button>{' '}
                <span className="bp-ingredient-amount">
                  ({recipe.yield} {recipe.yield === 1 ? 'item' : 'items'})
                </span>
              </span>
              <span className="bp-ingredient-cost">
                {suggestedPerItemPrice ? `${formatMoney(suggestedPerItemPrice)} / item` : 'Can’t be priced right now'}
              </span>
              <span className="bp-row-actions">
                <button type="button" className="bp-link-btn" disabled={busyId === recipe.id} onClick={() => handleDuplicate(recipe)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="bp-remove-btn"
                  onClick={() => setDeleteTarget({ id: recipe.id, name: recipe.name })}
                  aria-label={`Delete ${recipe.name}`}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this recipe?"
        body={deleteTarget ? `Delete "${deleteTarget.name}"? This can't be undone.` : ''}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />

      <BackupRestoreSection db={db} />
    </div>
  )
}
