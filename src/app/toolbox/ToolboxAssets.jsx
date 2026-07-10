import { useRef, useState } from 'react'
import { getCurrentTeams } from '../../project/projectUtils'
import {
  clean,
  createSponsorLogo,
  ensureAssetSettings,
  fileToDataUrl,
  getTeamShort,
  isVideoSource
} from './toolboxModel'
import styles from './ToolboxWorkspace.module.css'

function AssetPreview({ label, source, sourceType, variant = 'wide' }) {
  const isVideo = isVideoSource(source, sourceType)
  const isLogo = variant === 'logo'

  return (
    <div className={`${styles.assetPreview} ${isLogo ? styles.assetPreviewLogo : ''}`}>
      {source ? (
        isVideo
          ? <video src={source} muted controls />
          : <img src={source} alt="" />
      ) : (
        <span>{label}</span>
      )}
    </div>
  )
}

function AssetPathField({
  accept = 'image/*',
  allowUpload = true,
  label,
  placeholder,
  previewVariant = 'wide',
  sourceType = '',
  text,
  value,
  onChange,
  onClear,
  onUpload
}) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const isLogoPreview = previewVariant === 'logo'

  const applyFile = async file => {
    if (!allowUpload || !file) return
    const dataUrl = await fileToDataUrl(file)
    onUpload(dataUrl, file)
  }

  return (
    <div
      className={[
        styles.assetPathField,
        isLogoPreview ? styles.assetPathFieldLogo : '',
        isDragging ? styles.assetPathFieldDragging : ''
      ].filter(Boolean).join(' ')}
      onDragOver={event => {
        if (!allowUpload) return
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => allowUpload && setIsDragging(false)}
      onDrop={event => {
        if (!allowUpload) return
        event.preventDefault()
        setIsDragging(false)
        applyFile(event.dataTransfer.files?.[0])
      }}
    >
      <div className={styles.assetFieldHeader}>
        <span>{label}</span>
        <strong>{value ? text.ready : text.empty}</strong>
      </div>
      <div className={isLogoPreview ? styles.assetLogoFieldBody : styles.assetWideFieldBody}>
        {isLogoPreview && (
          <AssetPreview label={label} source={value} sourceType={sourceType} variant={previewVariant} />
        )}
        <div className={`${styles.assetInputRow} ${!allowUpload ? styles.assetInputRowPathOnly : ''}`}>
          <input value={value || ''} placeholder={placeholder || ''} onChange={event => onChange(event.target.value)} />
          {allowUpload && <button type="button" onClick={() => inputRef.current?.click()}>{text.loadFile}</button>}
          <button type="button" disabled={!value} onClick={onClear}>{text.clear}</button>
        </div>
        {!isLogoPreview && (
          <AssetPreview label={label} source={value} sourceType={sourceType} variant={previewVariant} />
        )}
      </div>
      {allowUpload && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={event => {
            applyFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      )}
    </div>
  )
}

function CompactAssetPathField({
  actionLabel,
  actionDisabled = false,
  label,
  placeholder,
  text,
  value,
  onAction,
  onChange,
  onClear
}) {
  const isReady = Boolean(clean(value))

  return (
    <div className={styles.compactAssetPathField}>
      <div className={styles.compactAssetLabel}>
        <span>{label}</span>
        <strong className={isReady ? styles.compactStatusReady : styles.compactStatusEmpty}>
          {isReady ? text.ready : text.empty}
        </strong>
      </div>
      <div className={styles.compactAssetControl}>
        <input
          aria-label={label}
          value={value || ''}
          placeholder={placeholder || ''}
          onChange={event => onChange(event.target.value)}
        />
        {actionLabel && (
          <button
            type="button"
            className={styles.compactPrimaryAction}
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
        <button type="button" disabled={!value} onClick={onClear}>
          {text.clear}
        </button>
      </div>
    </div>
  )
}

function SponsorAssetsTable({ sponsors, text, onUpdateSponsor, onRemoveSponsor }) {
  if (!sponsors.length) {
    return <div className={styles.emptyToolSettings}>{text.empty}</div>
  }

  return (
    <div className={styles.sponsorAssetTable}>
      <div className={styles.sponsorAssetHeader}>
        <span>{text.enabled}</span>
        <span>{text.sponsorName}</span>
        <span>{text.sourcePath}</span>
        <span>{text.status}</span>
        <span>{text.action}</span>
      </div>
      <div className={styles.sponsorAssetRows}>
        {sponsors.map((slot, index) => {
          const isEnabled = slot.enabled !== false
          const hasLogo = Boolean(clean(slot.logo))
          const rowKey = slot.id || `sponsor-${index}`

          return (
            <div className={styles.sponsorAssetRow} key={rowKey}>
              <button
                type="button"
                aria-pressed={isEnabled}
                className={`${styles.sponsorEnableButton} ${isEnabled ? styles.sponsorEnableButtonActive : ''}`}
                onClick={() => onUpdateSponsor(slot.id, index, { enabled: !isEnabled })}
              >
                {isEnabled ? text.enabledOn : text.enabledOff}
              </button>
              <input
                aria-label={`${text.sponsorName} ${index + 1}`}
                value={slot.name}
                placeholder={text.sponsorDefaultName(index)}
                onChange={event => onUpdateSponsor(slot.id, index, { name: event.target.value })}
              />
              <SponsorLogoPathCell
                slot={slot}
                index={index}
                text={text}
                onUpdateSponsor={onUpdateSponsor}
              />
              <span className={hasLogo ? styles.sponsorStatusReady : styles.sponsorStatusEmpty}>
                {hasLogo ? text.ready : text.empty}
              </span>
              <button
                type="button"
                className={styles.sponsorRemoveButton}
                onClick={() => onRemoveSponsor(slot.id, index)}
              >
                {text.remove}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SponsorLogoPathCell({ slot, index, text, onUpdateSponsor }) {
  const inputRef = useRef(null)

  const loadLogo = async file => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    onUpdateSponsor(slot.id, index, { logo: dataUrl })
  }

  return (
    <div className={styles.sponsorPathCell}>
      <input
        aria-label={`${text.sponsorLogo} ${index + 1}`}
        value={slot.logo}
        placeholder="/sponsors/logo.png"
        onChange={event => onUpdateSponsor(slot.id, index, { logo: event.target.value })}
      />
      <button type="button" onClick={() => inputRef.current?.click()}>
        {text.loadFile}
      </button>
      <button
        type="button"
        disabled={!slot.logo}
        onClick={() => onUpdateSponsor(slot.id, index, { logo: '' })}
      >
        {text.clear}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={event => {
          loadLogo(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </div>
  )
}

function ColorAssetField({ label, value, fallback, onChange }) {
  const colorValue = clean(value || fallback || '#4CD3B5')

  return (
    <label className={styles.assetColorField}>
      <span>{label}</span>
      <div>
        <input type="color" value={colorValue} onChange={event => onChange(event.target.value)} />
        <input value={value || ''} placeholder={fallback || '#4CD3B5'} onChange={event => onChange(event.target.value)} />
      </div>
    </label>
  )
}

function CollapsibleAssetSection({ children, eyebrow, open, text, title, onToggle }) {
  const handleHeaderKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <section className={styles.assetPanel}>
      <header
        className={styles.assetPanelHeader}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleHeaderKeyDown}
      >
        <div>
          <span>{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <button
          type="button"
          onClick={event => {
            event.stopPropagation()
            onToggle()
          }}
        >
          {open ? text.collapse : text.expand}
        </button>
      </header>
      {open && children}
    </section>
  )
}

function TeamAssetLibrary({ project, text, themePrimary, onUpdateTeamField }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const searchNeedle = search.trim().toLowerCase()
  const teams = project.teams || []
  const currentTeamIds = new Set([
    project.currentMatch?.teamAId,
    project.currentMatch?.teamBId
  ].filter(Boolean))
  const selectedTeam = teams.find(team => team.id === selectedTeamId) || teams.find(team => currentTeamIds.has(team.id)) || teams[0] || null
  const visibleTeams = teams.filter(team => {
    const searchText = [team.name, team.shortName, team.id].join(' ').toLowerCase()
    const matchesSearch = searchNeedle ? searchText.includes(searchNeedle) : true
    const hasLogo = Boolean(clean(team.logo))
    const matchesFilter = (
      filter === 'missing' ? !hasLogo :
        filter === 'ready' ? hasLogo :
          filter === 'current' ? currentTeamIds.has(team.id) :
            true
    )

    return matchesSearch && matchesFilter
  })
  const missingLogoCount = teams.filter(team => !clean(team.logo)).length
  const readyLogoCount = teams.length - missingLogoCount
  const filterOptions = [
    { id: 'all', label: text.allTeams },
    { id: 'missing', label: text.missingLogo },
    { id: 'ready', label: text.hasLogo },
    { id: 'current', label: text.currentMatch }
  ]

  return (
    <div className={styles.teamAssetLibrary}>
      <div className={styles.teamAssetToolbar}>
        <div className={styles.teamAssetMetrics}>
          <div>
            <span>{text.teamCount}</span>
            <strong>{teams.length}</strong>
          </div>
          <div>
            <span>{text.missingLogo}</span>
            <strong>{missingLogoCount}</strong>
          </div>
          <div>
            <span>{text.hasLogo}</span>
            <strong>{readyLogoCount}</strong>
          </div>
        </div>

        <label className={styles.assetSearchField}>
          <span>{text.searchTeams}</span>
          <input value={search} placeholder={text.searchTeamsPlaceholder} onChange={event => setSearch(event.target.value)} />
        </label>

        <div className={styles.teamAssetFilters}>
          {filterOptions.map(option => (
            <button
              type="button"
              className={filter === option.id ? styles.teamAssetFilterActive : ''}
              key={option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.teamAssetManager}>
        <section className={styles.teamAssetTable}>
          <div className={styles.teamAssetTableHeader}>
            <span>{text.team}</span>
            <span>{text.logo}</span>
            <span>{text.color}</span>
            <span>{text.status}</span>
          </div>
          <div className={styles.teamAssetRows}>
            {visibleTeams.map(team => {
              const hasLogo = Boolean(clean(team.logo))
              const isSelected = selectedTeam?.id === team.id
              const isCurrent = currentTeamIds.has(team.id)
              const color = clean(team.primaryColor || themePrimary)

              return (
                <button
                  type="button"
                  className={[
                    styles.teamAssetRow,
                    isSelected ? styles.teamAssetRowSelected : '',
                    isCurrent ? styles.teamAssetRowCurrent : ''
                  ].filter(Boolean).join(' ')}
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <div>
                    <strong>{team.shortName || team.id}</strong>
                    <span>{team.name || team.shortName || team.id}</span>
                  </div>
                  <span className={styles.teamAssetLogoThumb}>
                    {hasLogo ? <img src={team.logo} alt="" /> : <em>{getTeamShort(team)}</em>}
                  </span>
                  <span className={styles.teamAssetColorSwatch} style={{ '--team-asset-color': color }} />
                  <span className={hasLogo ? styles.teamAssetStatusReady : styles.teamAssetStatusMissing}>
                    {hasLogo ? text.ready : text.missingLogo}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className={styles.teamAssetDetail}>
          {selectedTeam ? (
            <>
              <header>
                <div>
                  <span>{text.selectedTeam}</span>
                  <strong>{selectedTeam.shortName || selectedTeam.id}</strong>
                  <em>{selectedTeam.name || selectedTeam.shortName || selectedTeam.id}</em>
                </div>
                <AssetPreview label={selectedTeam.shortName || 'TM'} source={selectedTeam.logo || ''} variant="logo" />
              </header>
              <AssetPathField
                allowUpload={false}
                label={text.teamLogo}
                previewVariant="logo"
                value={selectedTeam.logo || ''}
                placeholder="/teams/logo.png"
                text={text}
                onChange={value => onUpdateTeamField(selectedTeam.id, { logo: value })}
                onClear={() => onUpdateTeamField(selectedTeam.id, { logo: '' })}
              />
              <ColorAssetField
                label={text.teamColor}
                value={selectedTeam.primaryColor || ''}
                fallback={themePrimary}
                onChange={value => onUpdateTeamField(selectedTeam.id, { primaryColor: value })}
              />
            </>
          ) : (
            <div className={styles.emptyToolSettings}>{text.noTeamSelected}</div>
          )}
        </section>
      </div>
    </div>
  )
}

export function AssetsWorkspace({ assetSettings, project, text, onUpdateProject }) {
  const { teamA, teamB } = getCurrentTeams(project)
  const sponsorLogos = assetSettings.sponsors.logos
  const themePrimary = project.theme?.primary || '#4CD3B5'
  const [showEventAssets, setShowEventAssets] = useState(false)
  const [showMatchAssets, setShowMatchAssets] = useState(true)
  const [showSponsorTools, setShowSponsorTools] = useState(false)
  const [showTeamLibrary, setShowTeamLibrary] = useState(false)

  const updateEventField = (field, value) => {
    onUpdateProject(draft => {
      draft.event[field] = value
    })
  }

  const updateThemeField = (field, value) => {
    onUpdateProject(draft => {
      draft.theme[field] = value
    })
  }

  const updateTeamField = (teamId, patch) => {
    if (!teamId) return

    onUpdateProject(draft => {
      const team = draft.teams.find(item => item.id === teamId)
      if (team) Object.assign(team, patch)
    })
  }

  const updateSponsorSettings = patch => {
    onUpdateProject(draft => {
      Object.assign(ensureAssetSettings(draft).sponsors, patch)
    })
  }

  const addSponsorLogo = () => {
    onUpdateProject(draft => {
      const assets = ensureAssetSettings(draft)
      assets.sponsors.logos.push(createSponsorLogo())
    })
  }

  const updateSponsorLogo = (sponsorId, index, patch) => {
    onUpdateProject(draft => {
      const assets = ensureAssetSettings(draft)
      const target = assets.sponsors.logos.find(slot => slot.id === sponsorId) || assets.sponsors.logos[index]
      if (target) Object.assign(target, patch)
    })
  }

  const removeSponsorLogo = (sponsorId, index) => {
    onUpdateProject(draft => {
      const assets = ensureAssetSettings(draft)
      assets.sponsors.logos = assets.sponsors.logos.filter((slot, slotIndex) => (
        sponsorId ? slot.id !== sponsorId : slotIndex !== index
      ))
    })
  }

  const applySponsorVideoToMedia = () => {
    onUpdateProject(draft => {
      const assets = ensureAssetSettings(draft)
      if (!draft.scenes) draft.scenes = {}
      if (!draft.scenes.settings) draft.scenes.settings = {}
      if (!draft.scenes.settings.media) draft.scenes.settings.media = {}

      Object.assign(draft.scenes.settings.media, {
        mode: 'VIDEO',
        sourceUrl: assets.sponsors.videoAdUrl || '',
        sourceName: assets.sponsors.videoAdName || '',
        sourceType: assets.sponsors.videoAdType || '',
        activeVideoPath: assets.sponsors.videoAdUrl || '',
        fitMode: 'contain',
        autoPlay: true,
        loop: true,
        muted: true
      })
    })
  }

  return (
    <div className={styles.assetsWorkspace}>
      <CollapsibleAssetSection
        eyebrow={text.assetSettings}
        open={showEventAssets}
        text={text}
        title={text.eventPackage}
        onToggle={() => setShowEventAssets(value => !value)}
      >
        <div className={styles.assetGrid}>
          <AssetPathField
            label={text.eventLogo}
            previewVariant="logo"
            value={project.event?.logo || ''}
            placeholder="/OW.svg"
            text={text}
            onChange={value => updateEventField('logo', value)}
            onClear={() => updateEventField('logo', '')}
            onUpload={(value) => updateEventField('logo', value)}
          />
          <AssetPathField
            label={text.organizerLogo}
            previewVariant="logo"
            value={project.event?.organizerLogo || ''}
            placeholder="/organizer.svg"
            text={text}
            onChange={value => updateEventField('organizerLogo', value)}
            onClear={() => updateEventField('organizerLogo', '')}
            onUpload={(value) => updateEventField('organizerLogo', value)}
          />
          <AssetPathField
            label={text.backgroundImage}
            value={project.theme?.backgroundImage || ''}
            placeholder="/backgrounds/event.jpg"
            text={text}
            onChange={value => updateThemeField('backgroundImage', value)}
            onClear={() => updateThemeField('backgroundImage', '')}
            onUpload={(value) => updateThemeField('backgroundImage', value)}
          />
        </div>
      </CollapsibleAssetSection>

      <CollapsibleAssetSection
        eyebrow={text.currentMatch}
        open={showMatchAssets}
        text={text}
        title={text.currentMatchAssets}
        onToggle={() => setShowMatchAssets(value => !value)}
      >
        <div className={styles.assetTeamGrid}>
          <div className={styles.assetTeamBlock}>
            <strong>{teamA?.shortName || text.teamA}</strong>
            <AssetPathField
              label={text.teamALogo}
              previewVariant="logo"
              value={teamA?.logo || ''}
              placeholder="/team-a.png"
              text={text}
              onChange={value => updateTeamField(teamA?.id, { logo: value })}
              onClear={() => updateTeamField(teamA?.id, { logo: '' })}
              onUpload={(value) => updateTeamField(teamA?.id, { logo: value })}
            />
            <ColorAssetField
              label={text.teamAColor}
              value={teamA?.primaryColor || ''}
              fallback={themePrimary}
              onChange={value => updateTeamField(teamA?.id, { primaryColor: value })}
            />
          </div>
          <div className={styles.assetTeamBlock}>
            <strong>{teamB?.shortName || text.teamB}</strong>
            <AssetPathField
              label={text.teamBLogo}
              previewVariant="logo"
              value={teamB?.logo || ''}
              placeholder="/team-b.png"
              text={text}
              onChange={value => updateTeamField(teamB?.id, { logo: value })}
              onClear={() => updateTeamField(teamB?.id, { logo: '' })}
              onUpload={(value) => updateTeamField(teamB?.id, { logo: value })}
            />
            <ColorAssetField
              label={text.teamBColor}
              value={teamB?.primaryColor || ''}
              fallback={themePrimary}
              onChange={value => updateTeamField(teamB?.id, { primaryColor: value })}
            />
          </div>
        </div>
      </CollapsibleAssetSection>

      <CollapsibleAssetSection
        eyebrow={text.basicAssets}
        open={showSponsorTools}
        text={text}
        title={text.sponsorPackage}
        onToggle={() => setShowSponsorTools(value => !value)}
      >
        <div className={styles.sponsorDenseGrid}>
          <label className={styles.sponsorTickerField}>
            <div className={styles.compactAssetLabel}>
              <span>{text.sponsorTicker}</span>
              <strong className={assetSettings.sponsors.tickerText ? styles.compactStatusReady : styles.compactStatusEmpty}>
                {assetSettings.sponsors.tickerText ? text.ready : text.empty}
              </strong>
            </div>
            <input
              value={assetSettings.sponsors.tickerText}
              placeholder={text.sponsorTickerPlaceholder}
              onChange={event => updateSponsorSettings({ tickerText: event.target.value })}
            />
          </label>
          <CompactAssetPathField
            actionLabel={text.applyToMedia}
            actionDisabled={!assetSettings.sponsors.videoAdUrl}
            label={text.sponsorVideo}
            value={assetSettings.sponsors.videoAdUrl}
            placeholder="/sponsors/ad.mp4"
            text={text}
            onAction={applySponsorVideoToMedia}
            onChange={value => updateSponsorSettings({ videoAdUrl: value, videoAdName: '', videoAdType: '' })}
            onClear={() => updateSponsorSettings({ videoAdUrl: '', videoAdName: '', videoAdType: '' })}
          />
        </div>

        <div className={styles.assetSectionToolbar}>
          <span>{text.logos}</span>
          <button type="button" onClick={addSponsorLogo}>{text.addSponsor}</button>
        </div>

        <SponsorAssetsTable
          sponsors={sponsorLogos}
          text={text}
          onUpdateSponsor={updateSponsorLogo}
          onRemoveSponsor={removeSponsorLogo}
        />
      </CollapsibleAssetSection>

      <CollapsibleAssetSection
        eyebrow={text.advancedStudio}
        open={showTeamLibrary}
        text={text}
        title={text.teamAssetLibrary}
        onToggle={() => setShowTeamLibrary(value => !value)}
      >
        <TeamAssetLibrary
          project={project}
          text={text}
          themePrimary={themePrimary}
          onUpdateTeamField={updateTeamField}
        />
      </CollapsibleAssetSection>
    </div>
  )
}

export function AssetsSummaryPanel({ assetSettings, project, text }) {
  const { teamA, teamB } = getCurrentTeams(project)
  const sponsorLogos = assetSettings.sponsors.logos.filter(slot => slot.enabled !== false && (clean(slot.logo) || clean(slot.name)))
  const sponsorVideoReady = Boolean(assetSettings.sponsors.videoAdUrl)

  return (
    <>
      <section className={styles.toolboxPanel}>
        <div className={styles.panelTitle}>{text.assetSummary}</div>
        <div className={styles.infoRows}>
          <span>{text.eventLogo}</span>
          <strong>{project.event?.logo ? text.ready : text.empty}</strong>
          <span>{text.organizerLogo}</span>
          <strong>{project.event?.organizerLogo ? text.ready : text.empty}</strong>
          <span>{text.backgroundImage}</span>
          <strong>{project.theme?.backgroundImage ? text.ready : text.empty}</strong>
          <span>{text.logos}</span>
          <strong>{sponsorLogos.length}</strong>
          <span>{text.video}</span>
          <strong>{sponsorVideoReady ? text.ready : text.empty}</strong>
        </div>
      </section>

      <section className={styles.toolboxPanel}>
        <div className={styles.panelTitle}>{text.matchAssets}</div>
        <div className={styles.assetMatchPreview}>
          <div>
            <AssetPreview label={teamA?.shortName || 'A'} source={teamA?.logo || ''} variant="logo" />
            <strong>{teamA?.shortName || 'TMA'}</strong>
          </div>
          <div>
            <AssetPreview label={teamB?.shortName || 'B'} source={teamB?.logo || ''} variant="logo" />
            <strong>{teamB?.shortName || 'TMB'}</strong>
          </div>
        </div>
      </section>

      <section className={styles.toolboxPanel}>
        <div className={styles.panelTitle}>{text.sponsorTicker}</div>
        <div className={styles.sponsorTickerPreview}>
          <span>{assetSettings.sponsors.tickerText || text.sponsorTickerFallback}</span>
        </div>
        <div className={styles.sponsorLogoPreview}>
          {sponsorLogos.length ? sponsorLogos.map((slot, index) => (
            <div key={slot.id || `summary-sponsor-${index}`}>
              {slot.logo ? <img src={slot.logo} alt="" /> : <span>{clean(slot.name).slice(0, 3).toUpperCase()}</span>}
              <strong>{slot.name || text.sponsorDefaultName(index)}</strong>
            </div>
          )) : (
            <div>
              <span>SP</span>
              <strong>{text.empty}</strong>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
