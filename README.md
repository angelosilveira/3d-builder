# Obra3D — gestão de obras com visualização 3D

Plataforma para **prefeituras** e **construtoras** acompanharem uma ou várias obras
a partir de um **modelo 3D animado**. O cliente vê, de forma visual, o que já está
pronto e o que falta, junto com o percentual de conclusão, o consumo de materiais e a
mão de obra (pedreiro, ajudante e servente).

> Status: MVP funcional (front-end). Os dados ficam no `localStorage` do navegador,
> e a camada de estado foi pensada para ser trocada por uma API.

## Funcionalidades

| Área | O que já faz |
| --- | --- |
| **Multi-obras** | Painel com todas as obras, filtro por gestor (prefeitura/construtora), KPIs consolidados e pré-visualização 3D girando. |
| **Cadastro da planta** | 3 caminhos: **modelo padrão** por tipologia, **questionário** (quartos, suítes, banheiros, garagem, padrão etc.) ou **importação de PDF**. Os três resultam em uma lista editável de cômodos com medidas. |
| **Tipologias** | Casa (térrea/sobrado), apartamento, prédio (N pavimentos × M aptos/andar) e condomínio (N casas em quadras). |
| **Modelo 3D** | Gerado automaticamente a partir dos cômodos. Cada etapa da obra é uma camada animada: fundação → pilares e laje → alvenaria → instalações (hidráulica/elétrica) → cobertura (telhado de 2 águas ou laje) → acabamento (piso, pintura, esquadrias). |
| **Andamento** | Progresso por etapa (com pesos), progresso geral, comparação com o cronograma (adiantada/no prazo/atrasada). Em prédios e condomínios, o avanço é distribuído andar por andar / casa por casa. |
| **Status por cômodo** | Modo de visualização que pinta cada cômodo (vermelho → amarelo → verde). Clique no cômodo no 3D para ver os detalhes e atualizar o acabamento. |
| **Replay da obra** | Botão "Reproduzir evolução" anima a obra desde o terreno vazio até o estado atual. |
| **Materiais** | Quantitativo previsto (cimento, areia, brita, aço, tijolo, telha, piso, tinta), consumo **esperado** para o avanço atual, lançamentos reais e **desvio** (alerta de desperdício). |
| **Mão de obra** | Horas previstas × apontadas por função (pedreiro, ajudante, servente), diárias e custo. |

## Canteiro ao vivo (gêmeo digital) — `/canteiro`

Tela cheia para o engenheiro e o mestre de obras responderem *"como está a obra agora e o
que precisa da minha atenção?"*.

- **Cena isométrica low-poly** (câmera ortográfica + `CameraControls`): prédio de 8
  pavimentos (concluídos, atual com pilares/vigas/fôrmas, futuros em fantasma), grua com
  lança girando e carga, 3 betoneiras (uma na bomba, uma na fila, uma na rua), bomba com
  lança, escavadeira, retroescavadeira, elevador de cremalheira, estoque, vergalhões,
  contêineres, andaimes, tapumes, rua e árvores. Pilares, vigas, paletes, vergalhões,
  árvores e trabalhadores usam `InstancedMesh`.
- **Interação**: hover com contorno, clique com voo de câmera, controles (zoom, girar 90°,
  recentralizar) e **pins** de alerta (concretagem atrasada, equipamento parado, NC,
  tempo de mistura > 150 min).
- **HUD**: busca global (`/`), seletor de obra, relógio ao vivo, notificações, KPIs,
  card de detalhe por tipo (pilar/laje, betoneira, equipamento, equipe, concretagem ou
  visão da obra), rastreamento da concretagem e tabela com abas sincronizada com a cena.
- **Cronograma 4D**: arraste (ou use o teclado) para o prédio crescer ou regredir
  pavimento por pavimento, com plano de corte animado; o modo *Previsto x Executado*
  pinta os pavimentos por desvio.
- **Ao vivo**: a simulação descarrega a betoneira, enche a laje L6 em 3D, anda a fila de
  caminhões e atualiza KPIs a cada 3 s.

Arquitetura em `src/features/canteiro/`: `data/` (tipos, mocks consistentes, lógica 4D
pura, simulação, `useObraData`), `state/` (store de UI com seletores finos), `scene/`
(R3F; troque geometrias por GLTF em `scene/ModelSlot.tsx`) e `hud/` (React puro).

## Stack

- **React 19** + **TypeScript** + **Vite**
- **three.js** via **@react-three/fiber** e **@react-three/drei**
- **zustand** (estado + persistência)
- **pdf.js** (leitura de plantas em PDF, carregado sob demanda)
- **Vitest** + **React Testing Library** (lógica de negócio e componentes do HUD)

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes unitários
npm run build      # typecheck + build de produção
```

Três obras de exemplo são carregadas no primeiro acesso (casa de construtora,
habitação popular da prefeitura e um edifício). Elas podem ser recarregadas pelo botão
"Carregar exemplos" quando a lista estiver vazia.

## Arquitetura

```
src/
├── types.ts                  # modelo de domínio (Project, Room, Stage, MaterialUsage, LaborEntry)
├── store/projects.ts         # estado global (zustand) — ponto único para trocar por API
├── data/seed.ts              # obras de demonstração
├── lib/                      # regras de negócio puras (testadas)
│   ├── catalog.ts            # etapas, materiais, funções, rótulos e cores
│   ├── layout.ts             # gera a planta baixa a partir dos cômodos
│   ├── progress.ts           # progresso ponderado, cronograma, distribuição por unidade, replay
│   ├── estimates.ts          # quantitativos, consumo esperado, desvios e custos
│   ├── questionnaire.ts      # questionário → cômodos
│   ├── plantParser.ts        # texto da planta → cômodos (rótulos "SALA 4,00 x 3,50", "A=9,60m²")
│   └── pdfImport.ts          # leitura do PDF com pdf.js
├── components/
│   ├── viewer/               # cena 3D
│   │   ├── geometry.ts       # paredes sem sobreposição, pilares, posicionamento de andares/casas
│   │   ├── UnitModel.tsx     # uma unidade com as camadas animadas por etapa
│   │   ├── BuildingScene.tsx # canvas, luz, câmera, grua, distribuição do progresso
│   │   └── RoomLabel.tsx     # rótulos 3D (sprites)
│   ├── project/              # painéis da obra (etapas, cômodos, materiais, mão de obra, dados)
│   └── ui/                   # componentes básicos
└── pages/                    # Dashboard, NewProjectWizard, ProjectPage
```

### Como o 3D é gerado

1. `layoutRooms` organiza os cômodos em faixas ("shelf packing") e centraliza a planta.
2. `computeWalls` transforma as bordas dos cômodos em segmentos de parede únicos
   (paredes compartilhadas viram uma só) e marca as de fachada (recebem janelas).
3. `computeReplicas` replica a planta-tipo: andares empilhados no prédio, casas em
   grade no condomínio.
4. Para cada réplica, o progresso de cada etapa é distribuído em sequência
   (`unitFraction`): 50% da alvenaria em 8 andares = 4 andares completos.
5. `UnitModel` anima a escala de cada camada até o alvo (as paredes "sobem", o telhado
   "avança", o piso "se espalha" e a cor muda de tijolo para pintura).

### Acabamento por cômodo

O acabamento é acompanhado por cômodo; a etapa **Acabamento** é a média ponderada
pela área (`withDerivedFinish`). Assim o 3D e o percentual global nunca divergem.

### Estimativas

Os quantitativos usam índices médios de consumo por m² construído e por m² de parede
(ver `lib/estimates.ts`). Servem como orçamento inicial e alerta de desvio —
**não substituem** um orçamento técnico (SINAPI/TCPO).

### Importação de PDF — limites atuais

Lemos os **textos** da planta (PDFs exportados de CAD). Nome e medida são pareados
pela posição na folha. Plantas **escaneadas** (imagem) ou sem rótulos de medida não
são reconhecidas; nesse caso o usuário completa a lista de cômodos manualmente. As
posições reais dos cômodos ainda não são extraídas — o layout é gerado.

## Roadmap sugerido

1. **Back-end e multi-tenant**: API (ex.: NestJS + PostgreSQL), autenticação, organizações
   (prefeitura/construtora), perfis (gestor, engenheiro, mestre de obras, cliente
   somente leitura) e link público para o cliente acompanhar a obra.
2. **Planta real**: extrair geometria vetorial do PDF/DXF (posição das paredes),
   importar **IFC/BIM** e OCR/IA para plantas escaneadas.
3. **Diário de obra**: fotos geolocalizadas por cômodo/etapa, clima, ocorrências.
4. **Cronograma**: Gantt por etapa com dependências e curva S (físico × financeiro).
5. **Orçamento**: composições SINAPI por região, notas fiscais e estoque no canteiro.
6. **3D avançado**: portas/janelas a partir da planta, texturas, instancing para
   condomínios grandes, exportação glTF, visualização em realidade aumentada.
7. **App mobile** (React Native) para apontamentos no canteiro, offline-first.
