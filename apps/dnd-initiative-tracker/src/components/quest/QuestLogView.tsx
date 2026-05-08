import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setActiveCampaign as setActiveCampaignAction } from '../../store/campaignSlice'
import type { AppDispatch } from '../../store'
import type { RootState } from '../../types'

const QUEST_LOG_STORAGE_KEY = 'dnd-tracker-quest-logs-v1'
const QUEST_LOG_DRAFT_STORAGE_KEY = 'dnd-tracker-quest-log-drafts-v1'
const QUEST_LOG_MEMORY_FILE_STORAGE_KEY = 'dnd-tracker-quest-log-memory-file-v1'
const QUEST_LOG_UNASSIGNED_DRAFT_KEY = '__unassigned__'

type QuestEntry = {
  id: string
  title: string
  text: string
  status: 'pending' | 'completed' | 'failed'
}

type QuestLogMemoryFile = {
  version: 1
  savedAtIso: string
  entriesByCampaign: Record<string, QuestEntry[]>
}

export const QuestLogView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [entriesByCampaign, setEntriesByCampaign] = useState<Record<string, QuestEntry[]>>({})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [draftsByCampaign, setDraftsByCampaign] = useState<Record<string, { title: string; notes: string }>>({})
  const hasHydratedRef = useRef(false)

  useEffect(() => {
    const savedEntries = localStorage.getItem(QUEST_LOG_STORAGE_KEY)
    const savedDrafts = localStorage.getItem(QUEST_LOG_DRAFT_STORAGE_KEY)
    const savedMemoryFile = localStorage.getItem(QUEST_LOG_MEMORY_FILE_STORAGE_KEY)

    if (!savedEntries && !savedDrafts && !savedMemoryFile) {
      hasHydratedRef.current = true
      return
    }

    try {
      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries) as Record<string, QuestEntry[]>
        setEntriesByCampaign(parsedEntries)
      } else if (savedMemoryFile) {
        const parsedMemoryFile = JSON.parse(savedMemoryFile) as QuestLogMemoryFile
        setEntriesByCampaign(parsedMemoryFile.entriesByCampaign ?? {})
      }

      if (savedDrafts) {
        const parsedDrafts = JSON.parse(savedDrafts) as Record<string, { title: string; notes: string }>
        setDraftsByCampaign(parsedDrafts)
      }
    } catch {
      localStorage.removeItem(QUEST_LOG_STORAGE_KEY)
      localStorage.removeItem(QUEST_LOG_DRAFT_STORAGE_KEY)
      localStorage.removeItem(QUEST_LOG_MEMORY_FILE_STORAGE_KEY)
    } finally {
      hasHydratedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return
    }

    localStorage.setItem(QUEST_LOG_STORAGE_KEY, JSON.stringify(entriesByCampaign))
    const memoryFile: QuestLogMemoryFile = {
      version: 1,
      savedAtIso: new Date().toISOString(),
      entriesByCampaign,
    }
    localStorage.setItem(QUEST_LOG_MEMORY_FILE_STORAGE_KEY, JSON.stringify(memoryFile))
  }, [entriesByCampaign])

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return
    }

    localStorage.setItem(QUEST_LOG_DRAFT_STORAGE_KEY, JSON.stringify(draftsByCampaign))
  }, [draftsByCampaign])


  useEffect(() => {
    const draftKey = activeCampaignId ?? QUEST_LOG_UNASSIGNED_DRAFT_KEY
    const draft = draftsByCampaign[draftKey]
    setTitle(draft?.title ?? '')
    setNotes(draft?.notes ?? '')
  }, [activeCampaignId, draftsByCampaign])
  const activeCampaign = useMemo(() => {
    return campaigns.find((campaign) => campaign.id === activeCampaignId) || null
  }, [campaigns, activeCampaignId])

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => a.name.localeCompare(b.name))
  }, [campaigns])

  const activeEntries = useMemo(() => {
    if (!activeCampaignId) {
      return []
    }
    return entriesByCampaign[activeCampaignId] || []
  }, [entriesByCampaign, activeCampaignId])

  const hasEntries = useMemo(() => activeEntries.length > 0, [activeEntries])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeCampaignId) {
      setStatus('Choose a campaign before saving quests')
      setTimeout(() => setStatus(''), 2500)
      return
    }

    const trimmedTitle = title.trim()
    const trimmedNotes = notes.trim()
    if (!trimmedNotes) {
      setStatus('Add some quest details before confirming')
      setTimeout(() => setStatus(''), 2500)
      return
    }

    setEntriesByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      return {
        ...previous,
        [activeCampaignId]: [
          {
            id: crypto.randomUUID(),
            title: trimmedTitle || 'Untitled quest',
            text: trimmedNotes,
            status: 'pending',
          },
          ...existing,
        ],
      }
    })

    const draftKey = activeCampaignId ?? QUEST_LOG_UNASSIGNED_DRAFT_KEY
    setDraftsByCampaign((previous) => ({
      ...previous,
      [draftKey]: { title: '', notes: '' },
    }))
    setTitle('')
    setNotes('')
    setStatus('Quest log updated')
    setTimeout(() => setStatus(''), 2500)
  }

  const handleStatusChange = (id: string, newStatus: QuestEntry['status']) => {
    if (!activeCampaignId) {
      return
    }

    setEntriesByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      return {
        ...previous,
        [activeCampaignId]: existing.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: newStatus,
              }
            : entry
        ),
      }
    })
  }


  const handleDeleteEntry = (id: string) => {
    if (pendingDeleteId === id) {
      return
    }
    setPendingDeleteId(id)
  }

  const confirmDeleteEntry = (id: string) => {
    if (!activeCampaignId) {
      return
    }

    setEntriesByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      return {
        ...previous,
        [activeCampaignId]: existing.filter((entry) => entry.id !== id),
      }
    })
    setPendingDeleteId(null)
  }

  const cancelDeleteEntry = () => {
    setPendingDeleteId(null)
  }

  return (
    <section className="quest-log">
      <header className="quest-log__header">
        <div>
          <p className="eyebrow">Campaign journal</p>
          <h2>Quest Logs</h2>
        </div>
        <p className="quest-log__lede">
          Chronicle your party&apos;s adventures, track objectives, and keep the tale alive between sessions.
        </p>
      </header>

      <section className="campaign-panel">
        <h3 className="campaign-panel__title">Campaigns</h3>
        {sortedCampaigns.length > 0 ? (
          <label>
            <span>Campaign</span>
            <select
              value={activeCampaign ? activeCampaign.id : ''}
              onChange={(event) => dispatch(setActiveCampaignAction(event.target.value))}
            >
              <option value="" disabled>
                Select campaign
              </option>
              {sortedCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="quest-log__empty">No campaigns available yet. Create one in Campaign Manager first.</p>
        )}
        {activeCampaign && (
          <p className="quest-log__status">Showing quests for: {activeCampaign.name}</p>
        )}
      </section>

      <form className="quest-log__form" onSubmit={handleSubmit}>
        <div className="quest-log__scroll" aria-label="Quest log editor">
          <label className="quest-log__label" htmlFor="quest-title">
            Quest header
          </label>
          <input
            id="quest-title"
            className="quest-log__input"
            placeholder="e.g. The Amber Keep Expedition"
            value={title}
            onChange={(event) => {
              const nextTitle = event.target.value
              setTitle(nextTitle)
              const draftKey = activeCampaignId ?? QUEST_LOG_UNASSIGNED_DRAFT_KEY
              setDraftsByCampaign((previous) => ({
                ...previous,
                [draftKey]: {
                  title: nextTitle,
                  notes,
                },
              }))
            }}
          />

          <label className="quest-log__label" htmlFor="quest-notes">
            Quest entry
          </label>
          <textarea
            id="quest-notes"
            className="quest-log__textarea"
            placeholder="Record rumors, objectives, and key NPC details here..."
            value={notes}
            onChange={(event) => {
              const nextNotes = event.target.value
              setNotes(nextNotes)
              const draftKey = activeCampaignId ?? QUEST_LOG_UNASSIGNED_DRAFT_KEY
              setDraftsByCampaign((previous) => ({
                ...previous,
                [draftKey]: {
                  title,
                  notes: nextNotes,
                },
              }))
            }}
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
          activeEntries.map((entry) => (
            <article
              key={entry.id}
              className={`quest-log__entry quest-log__entry--${entry.status}`}
            >
              {pendingDeleteId === entry.id ? (
                <div className="quest-log__inline-confirm">
                  <button type="button" className="primary-button" onClick={() => confirmDeleteEntry(entry.id)}>
                    Yes
                  </button>
                  <button type="button" className="ghost-button" onClick={cancelDeleteEntry}>
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="quest-log__delete-button"
                  aria-label="Delete quest"
                  onClick={() => handleDeleteEntry(entry.id)}
                >
                  ×
                </button>
              )}
              <div className="quest-log__entry-body">
                <h3 className="quest-log__entry-title">{entry.title}</h3>
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
                <div className="quest-log__entry-secondary-actions">
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleStatusChange(entry.id, 'failed')}
                  >
                    Failed
                  </button>
                </div>
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
