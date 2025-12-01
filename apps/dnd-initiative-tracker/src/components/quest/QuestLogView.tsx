import { FormEvent, useState } from 'react'

export const QuestLogView: React.FC = () => {
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('Quest log updated')
    setTimeout(() => setStatus(''), 2500)
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
    </section>
  )
}
