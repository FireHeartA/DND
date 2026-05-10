import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setActiveCampaign as setActiveCampaignAction,
  updateCampaignTreasureLists as updateCampaignTreasureListsAction,
 } from '../../store/campaignSlice'
import type { AppDispatch } from '../../store'
import type { RootState, TreasureItem, TreasureList } from '../../types'

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
  const [activeTreasureListItems, setActiveTreasureListItems] = useState<TreasureItem[]>([createEmptyItem()])
  const [validationError, setValidationError] = useState('')

  const [pendingDeleteListId, setPendingDeleteListId] = useState<string | null>(null)
  const [editingListId, setEditingListId] = useState<string | null>(null)

  const activeCampaign = useMemo(() => campaigns.find((campaign) => campaign.id === activeCampaignId) || null, [campaigns, activeCampaignId])
  const sortedCampaigns = useMemo(() => [...campaigns].sort((a, b) => a.name.localeCompare(b.name)), [campaigns])

  const activeTreasureLists = useMemo(() => {
    if (!activeCampaignId || !activeCampaign) {
      return []
    }
    return activeCampaign.treasureLists || []
  }, [activeCampaign, activeCampaignId])


  const updateItem = (id: string, key: keyof TreasureItem, value: string | boolean) => {
    setActiveTreasureListItems((previous) => previous.map((item) => (item.id === id ? { ...item, [key]: value } : item)))
  }

  const toggleClaimedStatus = (listId: string, itemId: string, isClaimed: boolean) => {
    if (!activeCampaignId) {
      return
    }
    const existingTreasureLists = activeCampaign?.treasureLists || [];
    const updatedTreasureLists = existingTreasureLists.map((list) =>
      list.id === listId
        ? {
            ...list,
            items: list.items.map((item) => (item.id === itemId ? { ...item, isClaimed } : item)),
          }
        : list
    );
    dispatch(
      updateCampaignTreasureListsAction({
        id: activeCampaignId,
        treasureLists: updatedTreasureLists,
      }),
    );
  }

  const addItemRow = () => setActiveTreasureListItems((previous) => [...previous, createEmptyItem()])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeCampaignId) {
       setValidationError('Choose a campaign before saving quests')
      setTimeout(() => setValidationError(''), 2500)
      return
    }

    const trimmedHeader = header.trim()
    const cleanedItems = activeTreasureListItems
      .map((item) => ({ ...item, treasure: item.treasure.trim(), location: item.location.trim(), goldValue: item.goldValue.trim() }))
      .filter((item) => item.treasure || item.location || item.goldValue)
    if (!trimmedHeader) {
      setValidationError('Add a header for this treasure list')
      setTimeout(() => setValidationError(''), 2500)
      return
    }
    if (cleanedItems.length === 0) {
      setValidationError('Add at least one treasure line item')
      setTimeout(() => setValidationError(''), 2500)
      return
    }
    const existingTreasureLists = activeCampaign?.treasureLists || [];
    let updatedTreasureLists: TreasureList[] = [];
    if(!editingListId) {
      const newTreasureListToAdd : TreasureList = { id: crypto.randomUUID(), header: trimmedHeader, items: cleanedItems };
      updatedTreasureLists = [...existingTreasureLists, newTreasureListToAdd];
    } else {
      updatedTreasureLists = existingTreasureLists.map((list) =>
        list.id === editingListId 
          ? {
              ...list,
              header: trimmedHeader,      
              items: cleanedItems,
            } : list
      );
    }
    dispatch(
      updateCampaignTreasureListsAction({
        id: activeCampaignId,
        treasureLists: updatedTreasureLists,
      }),
    );

    setHeader('')
    setActiveTreasureListItems([createEmptyItem()])
    setEditingListId(null)
    setValidationError(editingListId ? 'Treasure list updated' : 'Treasure list confirmed')
    setTimeout(() => setValidationError(''), 2500)
  }

  const handleEditList = (list: TreasureList) => {
    setHeader(list.header)
    setActiveTreasureListItems(list.items.map((item) => ({ ...item })))
    setEditingListId(list.id)
  }

  const confirmDeleteList = (id: string) => {
    if (!activeCampaignId) {
      return
    }
     if(pendingDeleteListId !== id) {
      // sanity check    
      return
    }
      const existingTreasureLists = activeCampaign?.treasureLists || [];
    dispatch(
      updateCampaignTreasureListsAction({
        id: activeCampaignId,        
        treasureLists: existingTreasureLists.filter((list) => list.id !== id),
      }),
    );

    setPendingDeleteListId(null)
  }

  return (
    <section className="quest-log">
      <header className="quest-log__header">
        <div>
          <h2>Treasure Ledger</h2>
        </div>
      </header>
      <form className="quest-log__form" onSubmit={handleSubmit}>
        <div className="quest-log__scroll" aria-label="Treasure ledger editor">
          <label className="quest-log__label" htmlFor="treasure-header">Header</label>
          <input id="treasure-header" className="quest-log__input" placeholder="e.g. Tomb of Glass haul" value={header} onChange={(event) => setHeader(event.target.value)} />

          {activeTreasureListItems.map((item) => (
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
          {validationError && <span className="quest-log__status">{validationError}</span>}
        </div>
      </form>

      <div className="quest-log__entries" aria-live="polite">
        {activeTreasureLists.length > 0 ? (
          activeTreasureLists.map((list) => (
            <article key={list.id} className="quest-log__entry">
              <div className="quest-log__entry-body">
                <div className="treasure-ledger__entry-top">
                  <h3 className="quest-log__entry-title">{list.header}</h3>
                  {pendingDeleteListId === list.id ? (
                    <div className="quest-log__inline-confirm">
                      <button type="button" className="primary-button" onClick={() => confirmDeleteList(list.id)}>Yes</button>
                      <button type="button" className="ghost-button" onClick={() => setPendingDeleteListId(null)}>No</button>
                    </div>
                  ) : (
                    <div>
                      <button type="button" className="primary-button" onClick={() => handleEditList(list)}>Edit list</button>
                      <button type="button" className="quest-log__delete-button" aria-label="Delete treasure list" onClick={() => setPendingDeleteListId(list.id)}>×</button>
                    </div>
                  )}
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
