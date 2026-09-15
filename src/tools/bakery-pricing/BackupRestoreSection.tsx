import { useRef, useState } from 'react'
import { ConfirmDialog } from '../core/components/ConfirmDialog'
import { buildExport, downloadExportFile, importAndReplaceAll, parseAndValidateExportFile, type ExportFile } from './data/exportImport.ts'

interface Props {
  db: IDBDatabase
}

// A minimal export/import UI for data/exportImport.ts (built in M2, never
// wired to a UI until now). Import is a full, atomic replace-all — never a
// merge — so a file is fully parsed and previewed with its exact record
// counts before the baker ever sees a destructive confirmation.
export function BackupRestoreSection({ db }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<ExportFile | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function handleDownload() {
    const file = await buildExport(db)
    downloadExportFile(file)
    setStatus('Backup downloaded.')
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const chosen = input.files?.[0]
    input.value = ''
    if (!chosen) return
    setImportError(null)
    setStatus(null)
    try {
      const text = await chosen.text()
      const file = parseAndValidateExportFile(text)
      setPendingImport(file)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'This file could not be imported.')
    }
  }

  async function confirmImport() {
    if (!pendingImport) return
    try {
      await importAndReplaceAll(db, pendingImport, { confirmed: true })
      // A full restore replaces every saved ingredient and recipe at once —
      // reloading is the simplest way to guarantee every open screen (this
      // one, the Ingredient Library, any in-progress edit) reflects it,
      // rather than trying to coordinate a reset across all of them.
      window.location.reload()
    } catch (err) {
      setPendingImport(null)
      setImportError(err instanceof Error ? err.message : 'This file could not be imported.')
    }
  }

  return (
    <div className="bp-backup-restore">
      <hr className="bp-divider" />
      <h2 className="bp-h2">Backup &amp; Restore</h2>
      <p className="bp-helper">
        Download a backup file of everything saved here, or restore from a backup you downloaded earlier. Restoring
        replaces everything currently saved with the file's contents.
      </p>
      <div className="bp-inline-fields">
        <button type="button" className="bp-btn bp-btn-secondary" onClick={handleDownload}>
          Download Backup
        </button>
        <button type="button" className="bp-btn bp-btn-secondary" onClick={() => fileInputRef.current?.click()}>
          Restore From Backup
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChosen} />
      </div>
      {status && <p className="bp-helper" role="status">{status}</p>}
      {importError && <p className="bp-error" role="alert">{importError}</p>}

      <ConfirmDialog
        open={!!pendingImport}
        title="Restore from this backup?"
        body={
          pendingImport
            ? `This will replace everything currently saved with this file's contents: ${pendingImport.data.recipes.length} recipe(s) and ${pendingImport.data.ingredients.length} ingredient(s). This can't be undone.`
            : ''
        }
        confirmLabel="Yes, Restore"
        cancelLabel="Cancel"
        onConfirm={confirmImport}
        onCancel={() => setPendingImport(null)}
      />
    </div>
  )
}
