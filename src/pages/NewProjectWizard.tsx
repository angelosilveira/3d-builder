import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RoomsEditor } from '../components/RoomsEditor'
import { BuildingScene } from '../components/viewer/BuildingScene'
import { BUILDING_TYPE_LABEL, DEFAULT_STAGES, OWNER_LABEL } from '../lib/catalog'
import { costSummary } from '../lib/estimates'
import { fmt, fmtMoney, today } from '../lib/format'
import { importPlantPdf, type PdfImportResult } from '../lib/pdfImport'
import { DEFAULT_ANSWERS, roomsFromAnswers, type QuestionnaireAnswers } from '../lib/questionnaire'
import { DEFAULT_LAYOUT, templateRooms } from '../lib/templates'
import { useProjects } from '../store/projects'
import type { BuildingType, OwnerKind, Project, ProjectDraft, Room } from '../types'

const STEPS = ['Dados da obra', 'Tipologia', 'Planta', 'Revisão'] as const
type PlantSource = ProjectDraft['source']

const TYPE_DESCRIPTION: Record<BuildingType, string> = {
  casa: 'Residência unifamiliar térrea ou sobrado, telhado de duas águas.',
  apartamento: 'Unidade autônoma — reforma ou construção de um apartamento.',
  predio: 'Edifício de múltiplos pavimentos com unidades por andar.',
  condominio: 'Conjunto de casas iguais (habitação popular, loteamento).',
}

const addMonths = (iso: string, months: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export default function NewProjectWizard() {
  const navigate = useNavigate()
  const createProject = useProjects((s) => s.createProject)
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [owner, setOwner] = useState<OwnerKind>('construtora')
  const [client, setClient] = useState('')
  const [address, setAddress] = useState('')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(addMonths(today(), 8))

  const [type, setType] = useState<BuildingType>('casa')
  const [floors, setFloors] = useState(DEFAULT_LAYOUT.casa.floors)
  const [units, setUnits] = useState(DEFAULT_LAYOUT.casa.units)
  const [wallHeight, setWallHeight] = useState(DEFAULT_LAYOUT.casa.wallHeight)

  const [source, setSource] = useState<PlantSource>('template')
  const [rooms, setRooms] = useState<Room[]>(() => templateRooms('casa'))
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(DEFAULT_ANSWERS)
  const [pdf, setPdf] = useState<PdfImportResult & { fileName: string }>()
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'error'>('idle')

  const chooseType = (t: BuildingType) => {
    setType(t)
    setFloors(DEFAULT_LAYOUT[t].floors)
    setUnits(DEFAULT_LAYOUT[t].units)
    setWallHeight(DEFAULT_LAYOUT[t].wallHeight)
    if (source === 'template') setRooms(templateRooms(t))
  }

  const chooseSource = (s: PlantSource) => {
    setSource(s)
    if (s === 'template') setRooms(templateRooms(type))
    if (s === 'questionario') setRooms(roomsFromAnswers(answers))
    if (s === 'pdf') setRooms(pdf?.rooms ?? [])
  }

  const updateAnswers = (patch: Partial<QuestionnaireAnswers>) => {
    const next = { ...answers, ...patch }
    setAnswers(next)
    setRooms(roomsFromAnswers(next))
  }

  const onPdf = async (file: File | undefined) => {
    if (!file) return
    setPdfState('loading')
    try {
      const result = await importPlantPdf(file)
      setPdf({ ...result, fileName: file.name })
      setRooms(result.rooms)
      setPdfState('idle')
    } catch (err) {
      console.error(err)
      setPdfState('error')
    }
  }

  // Projeto "rascunho" para a pré-visualização 3D e estimativas.
  const preview: Project = useMemo(
    () => ({
      id: 'preview',
      name,
      owner,
      client,
      address,
      type,
      floors,
      units,
      wallHeight,
      rooms: rooms.map((r) => ({ ...r, progress: 100 })),
      stages: DEFAULT_STAGES.map((s) => ({ ...s, progress: 100 })),
      materialUsage: [],
      labor: [],
      startDate,
      endDate,
      createdAt: '',
      source,
    }),
    [name, owner, client, address, type, floors, units, wallHeight, rooms, startDate, endDate, source],
  )
  const costs = useMemo(() => costSummary(preview), [preview])
  const quantities = costs.quantities

  const validRooms = rooms.filter((r) => r.width > 0 && r.depth > 0)
  const canNext = [
    name.trim().length > 1 && startDate < endDate,
    floors >= 1 && units >= 1 && wallHeight >= 2.2,
    validRooms.length > 0,
    true,
  ][step]

  const finish = () => {
    const id = createProject({
      name: name.trim(),
      owner,
      client: client.trim(),
      address: address.trim(),
      type,
      floors,
      units,
      wallHeight,
      rooms: validRooms.map((r) => ({ ...r, progress: 0 })),
      startDate,
      endDate,
      source,
    })
    navigate(`/obras/${id}`)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Nova obra</h1>
          <p className="muted">Cadastre a obra e gere o modelo 3D a partir da planta.</p>
        </div>
      </div>

      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}>
            <span>{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      <div className={`wizard${step >= 2 ? ' with-preview' : ''}`}>
        <section className="card">
          {step === 0 && (
            <div className="form-grid">
              <label className="span-2">
                Nome da obra *
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: UBS Jardim das Flores" autoFocus />
              </label>
              <fieldset className="span-2">
                <legend>Gestor da obra</legend>
                <div className="segmented">
                  {(['prefeitura', 'construtora'] as OwnerKind[]).map((o) => (
                    <button key={o} type="button" className={owner === o ? 'active' : ''} onClick={() => setOwner(o)}>
                      {OWNER_LABEL[o]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                {owner === 'prefeitura' ? 'Secretaria / órgão' : 'Cliente'}
                <input value={client} onChange={(e) => setClient(e.target.value)} />
              </label>
              <label>
                Endereço
                <input value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <label>
                Início
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                Término previsto
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              {startDate >= endDate && <p className="error span-2">O término deve ser posterior ao início.</p>}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="type-grid">
                {(Object.keys(BUILDING_TYPE_LABEL) as BuildingType[]).map((t) => (
                  <button key={t} type="button" className={`type-card${type === t ? ' active' : ''}`} onClick={() => chooseType(t)}>
                    <span className={`type-icon type-icon-${t}`} aria-hidden />
                    <strong>{BUILDING_TYPE_LABEL[t]}</strong>
                    <small>{TYPE_DESCRIPTION[t]}</small>
                  </button>
                ))}
              </div>
              <div className="form-grid">
                {(type === 'predio' || type === 'casa' || type === 'condominio') && (
                  <label>
                    {type === 'predio' ? 'Pavimentos' : 'Pavimentos por casa'}
                    <input type="number" min={1} max={type === 'predio' ? 40 : 3} value={floors} onChange={(e) => setFloors(Math.max(1, Number(e.target.value)))} />
                  </label>
                )}
                {(type === 'predio' || type === 'condominio') && (
                  <label>
                    {type === 'predio' ? 'Apartamentos por andar' : 'Quantidade de casas'}
                    <input type="number" min={1} max={type === 'predio' ? 8 : 100} value={units} onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))} />
                  </label>
                )}
                <label>
                  Pé-direito (m)
                  <input type="number" min={2.2} max={6} step={0.05} value={wallHeight} onChange={(e) => setWallHeight(Number(e.target.value))} />
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="segmented wide">
                <button className={source === 'template' ? 'active' : ''} onClick={() => chooseSource('template')}>
                  Modelo padrão
                </button>
                <button className={source === 'questionario' ? 'active' : ''} onClick={() => chooseSource('questionario')}>
                  Questionário
                </button>
                <button className={source === 'pdf' ? 'active' : ''} onClick={() => chooseSource('pdf')}>
                  Importar PDF
                </button>
              </div>

              {source === 'template' && (
                <p className="muted">
                  Planta-tipo de {BUILDING_TYPE_LABEL[type].toLowerCase()}. Ajuste os cômodos abaixo se necessário.
                </p>
              )}

              {source === 'questionario' && (
                <div className="form-grid questionnaire">
                  <label>
                    Quartos
                    <input type="number" min={0} max={8} value={answers.quartos} onChange={(e) => updateAnswers({ quartos: Number(e.target.value) })} />
                  </label>
                  <label>
                    Destes, suítes
                    <input type="number" min={0} max={answers.quartos} value={answers.suites} onChange={(e) => updateAnswers({ suites: Number(e.target.value) })} />
                  </label>
                  <label>
                    Banheiros sociais
                    <input type="number" min={0} max={6} value={answers.banheirosSociais} onChange={(e) => updateAnswers({ banheirosSociais: Number(e.target.value) })} />
                  </label>
                  <label>
                    Vagas de garagem
                    <input type="number" min={0} max={4} value={answers.garagemVagas} onChange={(e) => updateAnswers({ garagemVagas: Number(e.target.value) })} />
                  </label>
                  <label>
                    Padrão dos cômodos
                    <select value={answers.padrao} onChange={(e) => updateAnswers({ padrao: e.target.value as QuestionnaireAnswers['padrao'] })}>
                      <option value="compacto">Compacto</option>
                      <option value="medio">Médio</option>
                      <option value="amplo">Amplo</option>
                    </select>
                  </label>
                  <div className="checks span-2">
                    {(
                      [
                        ['salaJantarIntegradas', 'Sala e jantar integradas'],
                        ['cozinhaAmericana', 'Cozinha americana'],
                        ['areaServico', 'Área de serviço'],
                        ['varanda', 'Varanda'],
                        ['escritorio', 'Escritório'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="check">
                        <input type="checkbox" checked={answers[key]} onChange={(e) => updateAnswers({ [key]: e.target.checked })} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {source === 'pdf' && (
                <div className="pdf-import">
                  <label className="dropzone">
                    <input type="file" accept="application/pdf" onChange={(e) => onPdf(e.target.files?.[0])} />
                    {pdfState === 'loading' ? 'Lendo planta…' : pdf ? `📄 ${pdf.fileName} — trocar arquivo` : 'Clique para selecionar a planta em PDF'}
                  </label>
                  {pdfState === 'error' && <p className="error">Não foi possível ler este PDF.</p>}
                  {pdf && (
                    <div className="pdf-result">
                      {pdf.preview && <img src={pdf.preview} alt="Pré-visualização da planta" />}
                      <div>
                        <p>
                          <strong>{pdf.rooms.length}</strong> cômodo(s) identificado(s) em {pdf.pages} página(s).
                        </p>
                        <p className="muted small">
                          Lemos os rótulos de texto da planta (ex.: “SALA 4,00 x 3,50” ou “QUARTO A=9,60m²”). Plantas
                          escaneadas ou sem texto não são reconhecidas — confira e complete a lista abaixo.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <RoomsEditor rooms={rooms} onChange={setRooms} />
            </>
          )}

          {step === 3 && (
            <div className="review">
              <h3>{name}</h3>
              <p className="muted">
                {OWNER_LABEL[owner]} · {BUILDING_TYPE_LABEL[type]} · {client || 'sem cliente'} · {address || 'sem endereço'}
              </p>
              <div className="stats">
                <div className="stat">
                  <span className="stat-label">Área construída</span>
                  <span className="stat-value">{fmt(quantities.builtArea)} m²</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Cimento</span>
                  <span className="stat-value">{fmt(quantities.materials.cimento)} sc</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Tijolos</span>
                  <span className="stat-value">{fmt(quantities.materials.tijolo)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Mão de obra (pedreiro)</span>
                  <span className="stat-value">{fmt(quantities.laborHours.pedreiro)} h</span>
                </div>
              </div>
              <p className="muted small">
                Estimativas iniciais por índices médios de consumo. Os valores reais são lançados no acompanhamento da
                obra. Custo estimado: <strong>{fmtMoney(costs.plannedTotal)}</strong> (materiais{' '}
                {fmtMoney(costs.plannedMaterials)} + mão de obra {fmtMoney(costs.plannedLabor)}).
              </p>
            </div>
          )}

          <div className="wizard-actions">
            <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Voltar
            </button>
            {step < STEPS.length - 1 ? (
              <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Continuar
              </button>
            ) : (
              <button className="btn btn-primary" onClick={finish}>
                Criar obra
              </button>
            )}
          </div>
        </section>

        {step >= 2 && (
          <aside className="card preview-3d">
            <div className="preview-canvas">
              {validRooms.length > 0 ? (
                <BuildingScene project={preview} autoRotate />
              ) : (
                <div className="empty">Adicione cômodos para ver o modelo 3D.</div>
              )}
            </div>
            <p className="muted small">Pré-visualização do modelo concluído · arraste para girar</p>
          </aside>
        )}
      </div>
    </div>
  )
}

