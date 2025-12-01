import React, { useCallback, useEffect, useRef, useState } from 'react'

type LocalTrack = {
  id: string
  name: string
  url: string
  sizeLabel: string
}

type ExternalLink = {
  id: string
  url: string
  title: string
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const SoundBoardView: React.FC = () => {
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([])
  const [uploadMessage, setUploadMessage] = useState('')
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [linkError, setLinkError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = useRef<string[]>([])

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    },
    [],
  )

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleUploadKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleUploadClick()
      }
    },
    [handleUploadClick],
  )

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    const mp3Files = files.filter(
      (file) => file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3'),
    )

    if (mp3Files.length === 0) {
      setUploadMessage('Please choose MP3 files to add them to your sound board.')
      event.target.value = ''
      return
    }

    const newTracks = mp3Files.map<LocalTrack>((file) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      const sizeInKb = Math.max(1, Math.round(file.size / 1024))
      return {
        id: createId(),
        name: file.name,
        url,
        sizeLabel: `${sizeInKb.toLocaleString()} KB`,
      }
    })

    const skipped = files.length - mp3Files.length
    setUploadMessage(
      skipped > 0
        ? `Added ${mp3Files.length} track${mp3Files.length === 1 ? '' : 's'} and skipped ${skipped} non-MP3 file${
            skipped === 1 ? '' : 's'
          }.`
        : `Added ${mp3Files.length} track${mp3Files.length === 1 ? '' : 's'} to your board.`,
    )

    setLocalTracks((previous) => [...previous, ...newTracks])
    event.target.value = ''
  }, [])

  const handleRemoveTrack = useCallback((id: string) => {
    setLocalTracks((previous) => {
      const track = previous.find((item) => item.id === id)
      if (track) {
        URL.revokeObjectURL(track.url)
        objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== track.url)
      }
      return previous.filter((item) => item.id !== id)
    })
  }, [])

  const handleAddExternalLink = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!linkInput.trim()) {
        setLinkError('Paste a link to add it to your sound board.')
        return
      }

      try {
        const parsed = new URL(linkInput.trim())
        const title = parsed.hostname.replace(/^www\./, '')
        const newLink: ExternalLink = {
          id: createId(),
          url: parsed.toString(),
          title,
        }

        setExternalLinks((previous) => [...previous, newLink])
        setLinkInput('')
        setLinkError('')
      } catch (error) {
        console.error('Invalid URL for sound board link', error)
        setLinkError('Please enter a valid URL (example: https://soundcloud.com/artist/track).')
      }
    },
    [linkInput],
  )

  const handleRemoveExternalLink = useCallback((id: string) => {
    setExternalLinks((previous) => previous.filter((link) => link.id !== id))
  }, [])

  return (
    <>
      <section className="main__header">
        <div>
          <h2>Sound Board</h2>
          <p>
            Organize ambient tracks, dramatic stingers, and background music so you can trigger the
            perfect audio cue at the right moment.
          </p>
        </div>
      </section>

      <section className="campaign-section">
        <header className="campaign-section__header">
          <div>
            <h3>Sound board</h3>
            <p>Upload MP3 tracks or keep quick links to your favorite streaming sources.</p>
          </div>
        </header>

        <div className="soundboard-grid">
          <div className="soundboard-card">
            <div className="soundboard-card__header">
              <div>
                <h4>Upload sound tracks</h4>
                <p>Add MP3 files to keep them handy during the session.</p>
              </div>
              <button className="primary-button" type="button" onClick={handleUploadClick}>
                Upload MP3s
              </button>
            </div>

            <div
              className="soundboard-upload"
              role="button"
              tabIndex={0}
              onClick={handleUploadClick}
              onKeyDown={handleUploadKeyDown}
            >
              <div>
                <p className="soundboard-upload__title">Drop MP3 files here or click to browse.</p>
                <p className="soundboard-upload__hint">Files stay in your browser for this session.</p>
                {uploadMessage && <p className="soundboard-upload__message">{uploadMessage}</p>}
              </div>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="audio/mpeg,.mp3"
                multiple
                onChange={handleFileInputChange}
              />
            </div>

            {localTracks.length > 0 ? (
              <ul className="soundboard-track-list">
                {localTracks.map((track) => (
                  <li key={track.id} className="soundboard-track">
                    <div className="soundboard-track__meta">
                      <div>
                        <p className="soundboard-track__name">{track.name}</p>
                        <p className="soundboard-track__details">{track.sizeLabel}</p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button ghost-button--compact"
                        onClick={() => handleRemoveTrack(track.id)}
                        aria-label={`Remove ${track.name}`}
                      >
                        Remove
                      </button>
                    </div>
                    <audio controls preload="metadata" src={track.url} className="soundboard-track__player" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="campaign-manager__empty">
                <p>No uploaded tracks yet. Add MP3 files to test levels and plan your cues.</p>
              </div>
            )}
          </div>

          <div className="soundboard-card">
            <div className="soundboard-card__header">
              <div>
                <h4>External sources</h4>
                <p>Save quick links to streams like SoundCloud, YouTube, or Spotify.</p>
              </div>
            </div>
            <form className="soundboard-link-form" onSubmit={handleAddExternalLink}>
              <label className="soundboard-link-form__label" htmlFor="external-link">
                Add a streaming link
              </label>
              <div className="soundboard-link-form__row">
                <input
                  id="external-link"
                  type="url"
                  placeholder="https://soundcloud.com/artist/track"
                  value={linkInput}
                  onChange={(event) => setLinkInput(event.target.value)}
                />
                <button className="primary-button" type="submit">
                  Save link
                </button>
              </div>
              {linkError && <p className="soundboard-link-form__error">{linkError}</p>}
            </form>

            {externalLinks.length > 0 ? (
              <ul className="soundboard-link-list">
                {externalLinks.map((link) => (
                  <li key={link.id} className="soundboard-link">
                    <div className="soundboard-link__details">
                      <p className="soundboard-link__title">{link.title}</p>
                      <a href={link.url} target="_blank" rel="noreferrer" className="soundboard-link__url">
                        {link.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      className="ghost-button ghost-button--compact"
                      onClick={() => handleRemoveExternalLink(link.id)}
                      aria-label={`Remove link ${link.title}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="campaign-manager__empty">
                <p>Keep quick links to playlists and loops you host elsewhere.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
