import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setActiveCampaign as setActiveCampaignAction } from '../../store/campaignSlice'
import type { AppDispatch } from '../../store'
import type { RootState } from '../../types'

const TREASURE_LEDGER_STORAGE_KEY = 'dnd-tracker-treasure-ledger-v1'

type TreasureItem = {
  id: string
  isClaimed: boolean
  treasure: string
  location: string
  goldValue: string
}

type TreasureList = {
  id: string
  header: string
  items: TreasureItem[]
}

const createEmptyItem = (): TreasureItem => ({
  id: crypto.randomUUID(),
  isClaimed: false,
  treasure: '',
  location: '',
  goldValue: '',
})

export const TreasureLedgerView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)

  const [header, setHeader] = useState('')
  const [items, setItems] = useState<TreasureItem[]>([createEmptyItem()])
  const [status, setStatus] = useState('')
  const [listsByCampaign, setListsByCampaign] = useState<Record<string, TreasureList[]>>({})
  const [pendingDeleteListId, setPendingDeleteListId] = useState<string | null>(null)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const hasHydratedRef = useRef(false)

  useEffect(() => {
    const savedLists = localStorage.getItem(TREASURE_LEDGER_STORAGE_KEY)
    if (!savedLists) {
      hasHydratedRef.current = true
      return
    }

    try {
      const parsedLists = JSON.parse(savedLists) as Record<string, TreasureList[]>
      setListsByCampaign(parsedLists)
    } catch {
      localStorage.removeItem(TREASURE_LEDGER_STORAGE_KEY)
    } finally {
      hasHydratedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return
    }

    localStorage.setItem(TREASURE_LEDGER_STORAGE_KEY, JSON.stringify(listsByCampaign))
  }, [listsByCampaign])

  const activeCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === activeCampaignId) || null, [campaigns, activeCampaignId])
  const sortedCampaigns = useMemo(() => [...campaigns].sort((a, b) => a.name.localeCompare(b.name)), [campaigns])

  const activeLists = useMemo(() => {
    if (!activeCampaignId) {
      return []
    }
    return listsByCampaign[activeCampaignId] || []
  }, [listsByCampaign, activeCampaignId])

  const updateItem = (id: string, key: keyof TreasureItem, value: string | boolean) => {
    setItems((previous) => previous.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }

  const toggleClaimedStatus = (listId: string, itemId: string, isClaimed: boolean) => {
    if (!activeCampaignId) {
      return
    }

    setListsByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      return {
        ...previous,
        [activeCampaignId]: existing.map((list) =>
          list.id === listId
            ? {
                ...list,
                items: list.items.map((item) => (item.id === itemId ? { ...item, isClaimed } : item)),
              }
            : list
        ),
      }
    })
  }

  const addItemRow = () => setItems((previous) => [...previous, createEmptyItem()])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeCampaignId) {
      return
    }

    const trimmedHeader = header.trim()
    const cleanedItems = items
      .map((item) => ({ ...item, treasure: item.treasure.trim(), location: item.location.trim(), goldValue: item.goldValue.trim() }))
      .filter((item) => item.treasure || item.location || item.goldValue)

    if (!trimmedHeader) {
      setStatus('Add a header for this treasure list')
      setTimeout(() => setStatus(''), 2500)
      return
    }

    if (cleanedItems.length === 0) {
      setStatus('Add at least one treasure line item')
      setTimeout(() => setStatus(''), 2500)
      return
    }

    setListsByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      const nextList: TreasureList = {
        id: editingListId || crypto.randomUUID(),
        header: trimmedHeader,
        items: cleanedItems,
      }

      const nextLists = editingListId
        ? existing.map((list) => (list.id === editingListId ? nextList : list))
        : [nextList, ...existing]

      return {
        ...previous,
        [activeCampaignId]: nextLists,
      }
    })

    setHeader('')
    setItems([createEmptyItem()])
    setEditingListId(null)
    setStatus(editingListId ? 'Treasure list updated' : 'Treasure list confirmed')
    setTimeout(() => setStatus(''), 2500)
  }

  const handleEditList = (list: TreasureList) => {
    setHeader(list.header)
    setItems(list.items.map((item) => ({ ...item })))
    setEditingListId(list.id)
  }

  const confirmDeleteList = (id: string) => {
    if (!activeCampaignId) {
      return
    }

    setListsByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      return {
        ...previous,
        [activeCampaignId]: existing.filter((list) => list.id !== id),
      }
    })
    setPendingDeleteListId(null)
  }

  return (
    <section className="quest-log">
      <header className="quest-log__header">
        <div>
          <p className="eyebrow">Campaign rewards</p>
          <h2>Treasure Ledger</h2>
        </div>
      </header>

      <section className="campaign-panel">
        <h3 className="campaign-panel__title">Campaigns</h3>
        {sortedCampaigns.length > 0 ? (
          <label>
            <span>Campaign</span>
            <select value={activeCampaign ? activeCampaign.id : ''} onChange={(event) => dispatch(setActiveCampaignAction(event.target.value))}>
              <option value="" disabled>Select campaign</option>
              {sortedCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="quest-log__empty">No campaigns available yet. Create one in Campaign Manager first.</p>
        )}
        {activeCampaign && <p className="quest-log__status">Showing treasure lists for: {activeCampaign.name}</p>}
      </section>

      <form className="quest-log__form" onSubmit={handleSubmit}>
        <div className="quest-log__scroll" aria-label="Treasure ledger editor">
          <label className="quest-log__label" htmlFor="treasure-header">Header</label>
          <input id="treasure-header" className="quest-log__input" placeholder="e.g. Tomb of Glass haul" value={header} onChange={(event) => setHeader(event.target.value)} />

          {items.map((item) => (
            <div key={item.id} className="treasure-ledger__row">
              <input className="quest-log__input" placeholder="Treasure" value={item.treasure} onChange={(event) => updateItem(item.id, 'treasure', event.target.value)} />
              <input className="quest-log__input" placeholder="Location" value={item.location} onChange={(event) => updateItem(item.id, 'location', event.target.value)} />
              <input className="quest-log__input" placeholder="Gold value" value={item.goldValue} onChange={(event) => updateItem(item.id, 'goldValue', event.target.value)} />
            </div>
          ))}

          <button type="button" className="primary-button treasure-ledger__add-button" onClick={addItemRow}>Add treasure line</button>
        </div>
        <div className="quest-log__actions">
          <button type="submit" className="primary-button">{editingListId ? 'Update list' : 'Confirm list'}</button>
          {status && <span className="quest-log__status">{status}</span>}
        </div>
      </form>

      <div className="quest-log__entries" aria-live="polite">
        {activeLists.length > 0 ? (
          activeLists.map((list) => (
            <article key={list.id} className="quest-log__entry">
              {pendingDeleteListId === list.id ? (
                <div className="quest-log__inline-confirm">
                  <button type="button" className="primary-button" onClick={() => confirmDeleteList(list.id)}>Yes</button>
                  <button type="button" className="ghost-button" onClick={() => setPendingDeleteListId(null)}>No</button>
                </div>
              ) : (
                <button type="button" className="quest-log__delete-button" aria-label="Delete treasure list" onClick={() => setPendingDeleteListId(list.id)}>×</button>
              )}
              <div className="quest-log__entry-body">
                <div className="treasure-ledger__entry-top">
                  <h3 className="quest-log__entry-title">{list.header}</h3>
                  <button type="button" className="secondary-button" onClick={() => handleEditList(list)}>Edit list</button>
                </div>
                <ul className="treasure-ledger__list">
                  {list.items.map((item) => (
                    <li key={item.id} className="treasure-ledger__list-item">
                      <input
                        type="checkbox"
                        checked={item.isClaimed}
                        onChange={(event) => toggleClaimedStatus(list.id, item.id, event.target.checked)}
                        aria-label={`Mark ${item.treasure || 'treasure'} as claimed`}
                      />
                      <span>{item.treasure || '—'}</span>
                      <span>{item.location || '—'}</span>
                      <span>{item.goldValue || '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))
        ) : (
          <p className="quest-log__empty">No treasure lists confirmed yet.</p>
        )}
      </div>
    </section>
  )
}
