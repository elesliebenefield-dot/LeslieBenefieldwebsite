import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { createIngredient, deleteIngredient, getReferencingRecipes, listIngredients, updateIngredient } from './data/ingredientRepository.ts'
import { IncompatibleMeasurementTypeError, IngredientInUseError, type ReferencingRecipe } from './data/errors.ts'
import { UNIT_GROUPS, defaultUnitFor } from './bakeryPricingUnitOptions.ts'
import { validatePackagePrice, validatePackageQuantity } from './calc-engine/validation.ts'
import { fieldError } from './bakeryPricingValidationDisplay.ts'
import { formatMoney } from './bakeryPricingFormat.ts'
import { EmptyState } from './EmptyState.tsx'
import { SectionIcon } from './SectionIcon.tsx'
import type { IngredientPatch, NewIngredient, StoredIngredient } from './data/types.ts'
import type { Unit } from './calc-engine/types.ts'

interface Props {
  db: IDBDatabase
}

interface Row {
  ingredient: StoredIngredient
  referencingRecipes: ReferencingRecipe[]
}

interface IngredientFormState {
  name: string
  packagePrice: string
  packageQuantity: string
  packageUnit: Unit
}

function emptyForm(): IngredientFormState {
  return { name: '', packagePrice: '', packageQuantity: '', packageUnit: defaultUnitFor('weight') }
}

function unitSelectOptions() {
  return UNIT_GROUPS.map(group => (
    <optgroup key={group.type} label={group.label}>
      {group.units.map(u => (
        <option key={u} value={u}>{u}</option>
      ))}
    </optgroup>
  ))
}

// A standalone create/edit/delete screen for the baker's saved ingredients
// (data/ingredientRepository.ts). Every ingredient's usage count is fetched
// eagerly per row (getReferencingRecipes) so "Used in N recipes" and the
// edit-impact warning never need a separate round trip once the baker acts.
export function IngredientLibraryScreen({ db }: Props) {
  const [rows, setRows] = useState<Row[] | 'loading'>('loading')

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<IngredientFormState>(emptyForm())
  const [addError, setAddError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<IngredientFormState>(emptyForm())
  const [editError, setEditError] = useState<string | null>(null)
  const [pendingImpact, setPendingImpact] = useState<{ referencingRecipes: ReferencingRecipe[] } | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState<string | null>(null)

  async function refresh() {
    const ingredients = await listIngredients(db)
    ingredients.sort((a, b) => a.name.localeCompare(b.name))
    const withCounts = await Promise.all(
      ingredients.map(async (ingredient) => ({ ingredient, referencingRecipes: await getReferencingRecipes(db, ingredient.id) })),
    )
    setRows(withCounts)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  const addPriceError = fieldError(addForm.packagePrice, validatePackagePrice)
  const addQuantityError = fieldError(addForm.packageQuantity, validatePackageQuantity)

  async function handleAdd() {
    if (addForm.name.trim() === '') {
      setAddError('Enter an ingredient name.')
      return
    }
    if (addForm.packagePrice.trim() === '' || addForm.packageQuantity.trim() === '') {
      setAddError('Enter the package price and quantity.')
      return
    }
    if (addPriceError || addQuantityError) {
      setAddError('Fix the highlighted fields before saving.')
      return
    }
    const input: NewIngredient = {
      name: addForm.name.trim(),
      packagePrice: addForm.packagePrice,
      packageQuantity: addForm.packageQuantity,
      packageUnit: addForm.packageUnit,
    }
    await createIngredient(db, input)
    setAddForm(emptyForm())
    setAddError(null)
    setShowAddForm(false)
    await refresh()
  }

  function beginEdit(row: Row) {
    setEditingId(row.ingredient.id)
    setEditForm({
      name: row.ingredient.name,
      packagePrice: row.ingredient.packagePrice,
      packageQuantity: row.ingredient.packageQuantity,
      packageUnit: row.ingredient.packageUnit,
    })
    setEditError(null)
    setPendingImpact(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
    setPendingImpact(null)
  }

  const editPriceError = fieldError(editForm.packagePrice, validatePackagePrice)
  const editQuantityError = fieldError(editForm.packageQuantity, validatePackageQuantity)

  function currentEditPatch(): IngredientPatch {
    return {
      name: editForm.name.trim(),
      packagePrice: editForm.packagePrice,
      packageQuantity: editForm.packageQuantity,
      packageUnit: editForm.packageUnit,
    }
  }

  async function commitEdit(id: string, patch: IngredientPatch) {
    try {
      await updateIngredient(db, id, patch)
      setEditingId(null)
      setPendingImpact(null)
      setEditError(null)
      await refresh()
    } catch (err) {
      if (err instanceof IncompatibleMeasurementTypeError) {
        setPendingImpact(null)
        setEditError(
          "This new unit doesn't match how this ingredient is measured in one or more saved recipes. Update those recipes first, or keep the current unit type.",
        )
        return
      }
      throw err
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return
    if (editForm.name.trim() === '') {
      setEditError('Enter an ingredient name.')
      return
    }
    if (editPriceError || editQuantityError) {
      setEditError('Fix the highlighted fields before saving.')
      return
    }
    const referencingRecipes = await getReferencingRecipes(db, editingId)
    if (referencingRecipes.length > 0) {
      setPendingImpact({ referencingRecipes })
      return
    }
    await commitEdit(editingId, currentEditPatch())
  }

  async function confirmEditImpact() {
    if (!editingId) return
    await commitEdit(editingId, currentEditPatch())
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await deleteIngredient(db, target.id)
      setDeleteTarget(null)
      await refresh()
    } catch (err) {
      if (err instanceof IngredientInUseError) {
        const names = err.referencingRecipes.map((r) => r.name).join(', ')
        setDeleteTarget(null)
        setDeleteBlockedMessage(`Can't delete "${target.name}" — it's used in: ${names}. Remove it from those recipes first.`)
        return
      }
      throw err
    }
  }

  return (
    <div className="bp-step">
      <h2 className="bp-h2">
        <SectionIcon symbol="🧺" tone="raspberry" /> Ingredient Library
      </h2>
      <p className="bp-helper">
        Ingredients you price in a recipe are saved here automatically. Editing one updates every saved recipe that
        uses it — the price and quantity are always looked up live, never copied.
      </p>

      {deleteBlockedMessage && (
        <div className="bp-error-banner" role="alert">
          <p>{deleteBlockedMessage}</p>
          <button type="button" className="bp-link-btn" onClick={() => setDeleteBlockedMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {rows === 'loading' ? (
        <p className="bp-helper">Loading your ingredients…</p>
      ) : rows.length === 0 && !showAddForm ? (
        <EmptyState icon="🧺">
          No saved ingredients yet. Ingredients you add while pricing a recipe will show up here automatically.
        </EmptyState>
      ) : (
        <ul className="bp-ingredient-list">
          {rows.map((row) =>
            editingId === row.ingredient.id ? (
              <li key={row.ingredient.id} className="bp-ingredient-row bp-saved-row-editing">
                <div className="bp-card bp-add-ingredient-form">
                  <div className="bp-field">
                    <label htmlFor="bp-lib-edit-name">Ingredient name</label>
                    <input
                      id="bp-lib-edit-name"
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="bp-inline-fields">
                    <div className="bp-field">
                      <label htmlFor="bp-lib-edit-price">Package price</label>
                      <input
                        id="bp-lib-edit-price"
                        type="text"
                        inputMode="decimal"
                        value={editForm.packagePrice}
                        onChange={(e) => setEditForm((f) => ({ ...f, packagePrice: e.target.value }))}
                        aria-invalid={!!editPriceError}
                      />
                      {editPriceError && <p className="bp-error" role="alert">{editPriceError}</p>}
                    </div>
                    <div className="bp-field">
                      <label htmlFor="bp-lib-edit-qty">Package quantity</label>
                      <input
                        id="bp-lib-edit-qty"
                        type="text"
                        inputMode="decimal"
                        value={editForm.packageQuantity}
                        onChange={(e) => setEditForm((f) => ({ ...f, packageQuantity: e.target.value }))}
                        aria-invalid={!!editQuantityError}
                      />
                      {editQuantityError && <p className="bp-error" role="alert">{editQuantityError}</p>}
                    </div>
                    <select
                      aria-label="Package unit"
                      value={editForm.packageUnit}
                      onChange={(e) => setEditForm((f) => ({ ...f, packageUnit: e.target.value as Unit }))}
                    >
                      {unitSelectOptions()}
                    </select>
                  </div>
                  {editError && <p className="bp-error" role="alert">{editError}</p>}
                  <div className="bp-inline-fields">
                    <button type="button" className="bp-btn bp-btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button type="button" className="bp-btn bp-btn-primary" onClick={handleSaveEdit}>
                      Save Changes
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li key={row.ingredient.id} className="bp-ingredient-row bp-saved-row">
                <span>
                  {row.ingredient.name}{' '}
                  <span className="bp-ingredient-amount">
                    ({formatMoney(row.ingredient.packagePrice)} for {row.ingredient.packageQuantity} {row.ingredient.packageUnit})
                  </span>
                  {row.referencingRecipes.length > 0 && (
                    <span className="bp-helper bp-used-in-note">
                      {' '}
                      · Used in {row.referencingRecipes.length} recipe{row.referencingRecipes.length === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="bp-row-actions">
                  <button type="button" className="bp-link-btn" onClick={() => beginEdit(row)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="bp-remove-btn"
                    onClick={() => setDeleteTarget({ id: row.ingredient.id, name: row.ingredient.name })}
                    aria-label={`Delete ${row.ingredient.name}`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {!showAddForm ? (
        <button type="button" className="bp-btn bp-btn-ghost" onClick={() => setShowAddForm(true)}>
          + Add an ingredient
        </button>
      ) : (
        <div className="bp-card bp-add-ingredient-form">
          <div className="bp-field">
            <label htmlFor="bp-lib-add-name">Ingredient name</label>
            <input
              id="bp-lib-add-name"
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., All-Purpose Flour"
            />
          </div>
          <div className="bp-inline-fields">
            <div className="bp-field">
              <label htmlFor="bp-lib-add-price">Package price</label>
              <input
                id="bp-lib-add-price"
                type="text"
                inputMode="decimal"
                value={addForm.packagePrice}
                onChange={(e) => setAddForm((f) => ({ ...f, packagePrice: e.target.value }))}
                placeholder="e.g., 3.49"
                aria-invalid={!!addPriceError}
              />
              {addPriceError && <p className="bp-error" role="alert">{addPriceError}</p>}
            </div>
            <div className="bp-field">
              <label htmlFor="bp-lib-add-qty">Package quantity</label>
              <input
                id="bp-lib-add-qty"
                type="text"
                inputMode="decimal"
                value={addForm.packageQuantity}
                onChange={(e) => setAddForm((f) => ({ ...f, packageQuantity: e.target.value }))}
                placeholder="e.g., 5"
                aria-invalid={!!addQuantityError}
              />
              {addQuantityError && <p className="bp-error" role="alert">{addQuantityError}</p>}
            </div>
            <select
              aria-label="Package unit"
              value={addForm.packageUnit}
              onChange={(e) => setAddForm((f) => ({ ...f, packageUnit: e.target.value as Unit }))}
            >
              {unitSelectOptions()}
            </select>
          </div>
          {addError && <p className="bp-error" role="alert">{addError}</p>}
          <div className="bp-inline-fields">
            <button
              type="button"
              className="bp-btn bp-btn-secondary"
              onClick={() => {
                setShowAddForm(false)
                setAddForm(emptyForm())
                setAddError(null)
              }}
            >
              Cancel
            </button>
            <button type="button" className="bp-btn bp-btn-primary" onClick={handleAdd}>
              Save Ingredient
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingImpact}
        title="Update this ingredient?"
        body={
          pendingImpact
            ? `This ingredient is used in ${pendingImpact.referencingRecipes.length} saved recipe${pendingImpact.referencingRecipes.length === 1 ? '' : 's'} (${pendingImpact.referencingRecipes.map((r) => r.name).join(', ')}). Updating it will change their costs.`
            : ''
        }
        confirmLabel="Update Ingredient"
        cancelLabel="Cancel"
        onConfirm={confirmEditImpact}
        onCancel={() => setPendingImpact(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this ingredient?"
        body={deleteTarget ? `Delete "${deleteTarget.name}"? This can't be undone.` : ''}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
