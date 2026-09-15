import { useEffect, useState } from 'react'
import './bakeryPricing.css'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { openAppDatabase } from './data/schema.ts'
import { BakeryPricingCalculator } from './BakeryPricingCalculator'
import { SavedRecipesScreen } from './SavedRecipesScreen'
import { IngredientLibraryScreen } from './IngredientLibraryScreen'

type View = 'guided' | 'saved-recipes' | 'ingredient-library'

// The app's top-level shell: opens the shared IndexedDB connection once,
// owns navigation between the guided pricing flow and the two saved-data
// screens, and renders the site chrome + disclaimer common to all three.
//
// If IndexedDB can't be opened (for example, a browser's private-browsing
// mode that blocks local storage outright), the calculator still works —
// it degrades to exactly M3's unsaved, in-session-only behavior, and the
// two saved-data screens (which have nothing to show without it) are
// simply not offered.
export function BakeryPricingApp() {
  const [db, setDb] = useState<IDBDatabase | null | 'loading'>('loading')
  const [view, setView] = useState<View>('guided')
  const [editingRecipeId, setEditingRecipeId] = useState<string | undefined>(undefined)
  const [sessionKey, setSessionKey] = useState(0)
  const [guidedDirty, setGuidedDirty] = useState(false)
  const [pendingNav, setPendingNav] = useState<View | null>(null)

  useEffect(() => {
    let cancelled = false
    openAppDatabase()
      .then((opened) => {
        if (!cancelled) setDb(opened)
      })
      .catch(() => {
        if (!cancelled) setDb(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function requestNav(target: View) {
    if (view === 'guided' && guidedDirty && target !== 'guided') {
      setPendingNav(target)
      return
    }
    setView(target)
  }

  function confirmPendingNav() {
    if (pendingNav) setView(pendingNav)
    setPendingNav(null)
  }

  function openNewRecipe() {
    setEditingRecipeId(undefined)
    setSessionKey((k) => k + 1)
    setGuidedDirty(false)
    setView('guided')
  }

  function openRecipeForEdit(id: string) {
    setEditingRecipeId(id)
    setSessionKey((k) => k + 1)
    setGuidedDirty(false)
    setView('guided')
  }

  function handleSaved() {
    setGuidedDirty(false)
    setView('saved-recipes')
  }

  function handleDiscardEdit() {
    setGuidedDirty(false)
    setView('saved-recipes')
  }

  const dbReady = db !== 'loading' && db !== null
  const [showFullDisclaimer, setShowFullDisclaimer] = useState(false)

  return (
    <div className="tool-page">
      <header className="tool-header">
        <span className="tool-header-title">Bakery Pricing Calculator</span>
      </header>

      <main className="bakery-pricing-calculator">
        <h1 className="bp-page-heading">
          <span className="bp-page-heading-icon" aria-hidden="true">🥖</span> Free Home Bakery Pricing Calculator
        </h1>

        <nav className="bp-app-nav" aria-label="Bakery Pricing Calculator sections">
          <button
            type="button"
            className={`bp-app-nav-btn${view === 'guided' ? ' is-active' : ''}`}
            onClick={() => requestNav('guided')}
          >
            🥖 Calculator
          </button>
          {dbReady && (
            <>
              <button
                type="button"
                className={`bp-app-nav-btn${view === 'saved-recipes' ? ' is-active' : ''}`}
                onClick={() => requestNav('saved-recipes')}
              >
                📖 Saved Recipes
              </button>
              <button
                type="button"
                className={`bp-app-nav-btn${view === 'ingredient-library' ? ' is-active' : ''}`}
                onClick={() => requestNav('ingredient-library')}
              >
                🧺 Ingredient Library
              </button>
            </>
          )}
        </nav>

        {db === 'loading' ? (
          <p className="bp-helper">Loading…</p>
        ) : (
          <>
            {view === 'guided' && (
              <BakeryPricingCalculator
                key={sessionKey}
                db={dbReady ? (db as IDBDatabase) : null}
                recipeIdToEdit={editingRecipeId}
                onSaved={handleSaved}
                onDiscardEdit={handleDiscardEdit}
                onDirtyChange={setGuidedDirty}
              />
            )}
            {view === 'saved-recipes' && dbReady && (
              <SavedRecipesScreen db={db as IDBDatabase} onOpen={openRecipeForEdit} onNew={openNewRecipe} />
            )}
            {view === 'ingredient-library' && dbReady && <IngredientLibraryScreen db={db as IDBDatabase} />}
          </>
        )}
      </main>

      <div className="tool-disclaimer bp-disclaimer-compact" role="note">
        <p className="bp-disclaimer-summary">
          Planning estimates only, not financial advice. Calculations stay on your device and are never
          transmitted anywhere.
        </p>
        <details onToggle={(e) => setShowFullDisclaimer(e.currentTarget.open)}>
          <summary>{showFullDisclaimer ? 'Hide full disclaimer' : 'Read the full disclaimer'}</summary>
          <p>
            These figures are planning estimates based on what you entered. Bakery Pricing Planner is not
            accounting, tax, or financial advice, does not guarantee a profit, and does not replace your own
            judgment about your costs, local rules, and final pricing. All calculations happen on your device —
            what you enter here is never transmitted anywhere.
          </p>
        </details>
      </div>

      <ConfirmDialog
        open={!!pendingNav}
        title="Leave this recipe?"
        body="You have unsaved changes. Leaving now will discard them."
        confirmLabel="Leave Without Saving"
        cancelLabel="Stay"
        onConfirm={confirmPendingNav}
        onCancel={() => setPendingNav(null)}
      />
    </div>
  )
}
