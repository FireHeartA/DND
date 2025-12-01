import { FormEvent, useMemo, useState } from 'react'

type QuestEntry = {
  id: string
  text: string
  status: 'pending' | 'completed' | 'failed'
}

export const QuestLogView: React.FC = () => {
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [entries, setEntries] = useState<QuestEntry[]>([])

  const hasEntries = useMemo(() => entries.length > 0, [entries])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedNotes = notes.trim()
    if (!trimmedNotes) {
      setStatus('Add some quest details before confirming')
      setTimeout(() => setStatus(''), 2500)
      return
    }

    setEntries((previous) => [
      {
        id: crypto.randomUUID(),
        text: trimmedNotes,
        status: 'pending',
      },
      ...previous,
    ])

    setNotes('')
    setStatus('Quest log updated')
    setTimeout(() => setStatus(''), 2500)
  }

  const handleStatusChange = (id: string, newStatus: QuestEntry['status']) => {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: newStatus,
            }
          : entry
      )
    )
  }

  return (
    <section className="quest-log">
      <header className="quest-log__header">
        <div>
          <p className="eyebrow">Campaign journal</p>
          <h2>Quest logs</h2>
        </div>
        <p className="quest-log__lede">
          Chronicle your party&apos;s adventures, track objectives, and keep the tale alive between sessions.
        </p>
      </header>

      <form className="quest-log__form" onSubmit={handleSubmit}>
        <div className="quest-log__scroll" aria-label="Quest log editor">
          <label className="quest-log__label" htmlFor="quest-notes">
            Quest entry
          </label>
          <textarea
            id="quest-notes"
            className="quest-log__textarea"
            placeholder="Record rumors, objectives, and key NPC details here..."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <div className="quest-log__actions">
          <button type="submit" className="primary-button">
            Confirm quest
          </button>
          {status && <span className="quest-log__status">{status}</span>}
        </div>
      </form>

      <div className="quest-log__entries" aria-live="polite">
        {hasEntries ? (
          entries.map((entry) => (
            <article
              key={entry.id}
              className={`quest-log__entry quest-log__entry--${entry.status}`}
            >
              <div className="quest-log__entry-body">
                <p className="quest-log__entry-text">{entry.text}</p>
              </div>
              <div className="quest-log__entry-footer">
                <button
                  type="button"
                  className="secondary-button quest-log__complete-button"
                  onClick={() => handleStatusChange(entry.id, 'completed')}
                >
                  Completed
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => handleStatusChange(entry.id, 'failed')}
                >
                  Failed
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="quest-log__empty">No quests confirmed yet.</p>
        )}
      </div>
    </section>
  )
}
