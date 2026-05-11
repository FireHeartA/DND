export const NpcCreationView: React.FC = () => {
  return (
    <section className="campaign-manager">
      <header className="campaign-manager__header"><h2>NPC creation</h2></header>
      <article className="campaign-card">
        <h3>NPC - minimise</h3>
        <label>Name</label><input type="text" />
        <label>Creature Type</label><input type="text" defaultValue="Large dragon, chaotic evil" />
        <label>Armor Class</label><input type="text" />
        <label>Hit Points</label><input type="text" />
        <label>Speed</label><input type="text" defaultValue="40 ft., fly 80 ft." />
        <label>Challenge Rating</label><input type="text" defaultValue="17" />
        <label>Challenge XP</label><input type="text" defaultValue="18000" />
        <label>Senses</label><input type="text" />
        <label>Languages</label><input type="text" />
        <label>Source URL</label><input type="url" />
        <label>Tags (comma separated)</label><input type="text" />
        <label>Notes</label><textarea />
        <h4>Immunities</h4><button type="button" className="secondary-button">Add a defense</button><p>No selections yet.</p>
        <h4>Resistances</h4><button type="button" className="secondary-button">Add a defense</button><p>No selections yet.</p>
        <h4>Vulnerabilities</h4><button type="button" className="secondary-button">Add a defense</button><p>No selections yet.</p>
        <div className="row-actions"><button type="button" className="primary-button">Add NPC</button><button type="button" className="ghost-button">Clear</button></div>
      </article>
      <article className="campaign-card">
        <h3>Saved NPCs</h3>
        <button type="button" className="ghost-button">minimise</button>
      </article>
    </section>
  )
}
