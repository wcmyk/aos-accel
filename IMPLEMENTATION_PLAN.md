# Implementation Plan - MVP v2

## Overview
This document outlines the implementation of Priority 1-3 features plus the Node Map module.

## Phase 1: Version History ✅ (Week 1-3)

### Architecture
```typescript
interface VersionSnapshot {
  id: string;
  timestamp: number;
  description?: string;
  author?: string;
  cells: Map<string, Cell>;  // Serialized cell state
  graphs: Map<string, GraphDefinition>;
  parameters: Map<string, Parameter>;
}

interface VersionState {
  snapshots: VersionSnapshot[];
  currentIndex: number;
  autoSaveEnabled: boolean;
  lastAutoSave: number;
}
```

### Features
- ✅ Auto-save every 5 minutes
- ✅ Manual snapshots with descriptions
- ✅ Timeline UI with slider
- ✅ Restore to any version
- ✅ Compare versions side-by-side
- ✅ Branch/merge for scenarios

### Implementation
1. Add version state to store
2. Create snapshot on every significant change
3. Use Immer's structural sharing (efficient!)
4. IndexedDB for persistence
5. Timeline component in sidebar

### Performance
- Store deltas, not full copies
- Limit to 100 snapshots (configurable)
- Background serialization
- Lazy loading of old versions

---

## Phase 2: AI Copilot 🤖 (Week 4-9)

### Architecture
```typescript
interface AICopilotState {
  isOpen: boolean;
  query: string;
  response: string | null;
  isLoading: boolean;
  suggestions: FormulaSuggestion[];
  history: AIQuery[];
}

interface FormulaSuggestion {
  formula: string;
  explanation: string;
  confidence: number;
}
```

### Features
- ✅ Natural language → Formula
- ✅ Formula explainer (hover tooltip)
- ✅ Error fixer
- ✅ Synthetic data generator
- ✅ Chat interface
- ✅ Suggestion pills

### Implementation
1. AI panel component (slide-out drawer)
2. OpenAI API integration (backend proxy)
3. Context builder (send nearby cells)
4. Streaming responses
5. Cache layer (Redis/memory)
6. Formula parser integration

### API Structure
```typescript
POST /api/ai/query
{
  prompt: "average of A1:A100 excluding zeros",
  context: {
    selectedCell: "B1",
    nearbyCells: [...],
    currentFormula: "..."
  }
}

Response:
{
  formula: "=AVERAGEIF(A1:A100, \"<>0\")",
  explanation: "...",
  alternatives: [...]
}
```

### Performance
- Debounce input (500ms)
- Cache common queries
- Stream tokens for fast UX
- Background API calls

---

## Phase 3: Real-Time Collaboration 🤝 (Week 10-17)

### Architecture (CRDT-based)
```typescript
interface CollaborationState {
  roomId: string;
  users: Map<string, UserPresence>;
  isConnected: boolean;
  myUserId: string;
  cursors: Map<string, CursorPosition>;
  awareness: AwarenessData;
}

interface UserPresence {
  userId: string;
  name: string;
  email: string;
  color: string;  // Unique per user
  cursor: { row: number; col: number } | null;
  selection: SelectionRange | null;
  lastActive: number;
}

interface AwarenessData {
  editingCell: { row: number; col: number } | null;
  selectedRange: SelectionRange | null;
}
```

### Tech Stack
- **Yjs** - CRDT library (handles concurrent edits)
- **y-websocket** - WebSocket provider
- **Socket.io** - Real-time server
- **y-indexeddb** - Offline persistence

### Features
- ✅ Live cursor tracking
- ✅ Presence indicators (avatars)
- ✅ Concurrent editing
- ✅ Conflict-free merging
- ✅ Offline support
- ✅ Share links (view/edit/comment)
- ✅ Permissions system

### Backend (Node.js + Express)
```typescript
// server.ts
import { WebSocketServer } from 'ws'
import * as Y from 'yjs'

const wss = new WebSocketServer({ port: 1234 })
const rooms = new Map<string, Y.Doc>()

wss.on('connection', (conn, req) => {
  const roomId = req.url.split('/').pop()
  let doc = rooms.get(roomId)

  if (!doc) {
    doc = new Y.Doc()
    rooms.set(roomId, doc)
  }

  // Sync doc with client
  setupWSConnection(conn, doc)
})
```

### Client Integration
```typescript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  'room-id',
  ydoc
)

// Bind to store
const yCells = ydoc.getMap('cells')
yCells.observe((event) => {
  // Update React state
})
```

### Performance
- Only sync deltas (not full doc)
- Optimistic updates (instant local)
- Batch updates (every 50ms)
- Lazy loading for large docs
- Connection pooling

---

## Phase 4: Node Map / Decision Tree 🌳 (Week 18-22)

### Architecture
```typescript
interface NodeMapState {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  selectedNode: string | null;
  viewport: { x: number; y: number; zoom: number };
}

interface Node {
  id: string;
  type: 'decision' | 'action' | 'outcome' | 'calculation';
  position: { x: number; y: number };
  data: {
    label: string;
    formula?: string;
    condition?: string;
    value?: any;
  };
  style: {
    backgroundColor: string;
    borderColor: string;
    width: number;
    height: number;
  };
}

interface Edge {
  id: string;
  source: string;  // source node id
  target: string;  // target node id
  label?: string;
  type: 'default' | 'conditional' | 'loop';
  condition?: string;
}
```

### Features
- ✅ Visual node editor
- ✅ Drag-and-drop nodes
- ✅ Connect nodes with edges
- ✅ Node types:
  - Decision (diamond)
  - Action (rectangle)
  - Outcome (rounded)
  - Calculation (spreadsheet icon)
- ✅ Conditional edges (if/else)
- ✅ Execute flow (run simulation)
- ✅ Link to spreadsheet cells
- ✅ Export as image/PDF
- ✅ Templates (SWOT, fishbone, etc.)

### Tech Stack
- **React Flow** - Node graph library
- Or **Reaflow** - Alternative
- Canvas-based rendering
- Custom node components

### Implementation
```typescript
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background
} from 'reactflow'

const NodeMapEditor = () => {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
    >
      <Controls />
      <Background />
    </ReactFlow>
  )
}
```

### Node Types
```typescript
// DecisionNode
const DecisionNode = ({ data }) => (
  <div className="decision-node">
    <div className="diamond">
      {data.label}
    </div>
    <input
      value={data.condition}
      placeholder="Condition: A1 > 100"
    />
  </div>
)

// CalculationNode
const CalculationNode = ({ data }) => (
  <div className="calc-node">
    <input
      value={data.formula}
      placeholder="=SUM(A1:A10)"
    />
    <div className="result">{data.value}</div>
  </div>
)
```

### Integration with Spreadsheet
- Reference cells: `{A1}` in node
- Execute flow: Evaluate conditions, run formulas
- Two-way binding: Update cell → update node
- Export to spreadsheet: Generate formulas from flow

---

## Database Schema

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Workbooks
```sql
CREATE TABLE workbooks (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,  -- Entire workbook state
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Versions
```sql
CREATE TABLE versions (
  id UUID PRIMARY KEY,
  workbook_id UUID REFERENCES workbooks(id),
  snapshot JSONB NOT NULL,
  description TEXT,
  author_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_versions_workbook ON versions(workbook_id);
```

### Collaborators
```sql
CREATE TABLE collaborators (
  workbook_id UUID REFERENCES workbooks(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) NOT NULL,  -- 'owner', 'editor', 'viewer'
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (workbook_id, user_id)
);
```

### Share Links
```sql
CREATE TABLE share_links (
  id UUID PRIMARY KEY,
  workbook_id UUID REFERENCES workbooks(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  permission VARCHAR(20) NOT NULL,  -- 'view', 'edit', 'comment'
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Workbooks
```
GET    /api/workbooks              # List user's workbooks
POST   /api/workbooks              # Create new
GET    /api/workbooks/:id          # Get workbook
PUT    /api/workbooks/:id          # Update
DELETE /api/workbooks/:id          # Delete
```

### Versions
```
GET    /api/workbooks/:id/versions       # List versions
POST   /api/workbooks/:id/versions       # Create snapshot
GET    /api/workbooks/:id/versions/:vid  # Get version
POST   /api/workbooks/:id/restore/:vid   # Restore version
```

### Collaboration
```
GET    /api/workbooks/:id/collaborators  # List collaborators
POST   /api/workbooks/:id/share          # Add collaborator
DELETE /api/workbooks/:id/share/:uid     # Remove collaborator
POST   /api/workbooks/:id/links          # Create share link
```

### AI
```
POST   /api/ai/query          # Natural language query
POST   /api/ai/explain        # Explain formula
POST   /api/ai/fix            # Fix error
POST   /api/ai/generate       # Generate data
```

---

## Folder Structure

```
aos-accel/
├── src/
│   ├── components/
│   │   ├── SpreadsheetGrid.tsx
│   │   ├── GraphCanvas.tsx
│   │   ├── Ribbon.tsx
│   │   ├── VersionHistory.tsx          # NEW
│   │   ├── AICopilot.tsx               # NEW
│   │   ├── CollaborationAwareness.tsx  # NEW
│   │   ├── NodeMapEditor.tsx           # NEW
│   │   └── ShareDialog.tsx             # NEW
│   ├── store/
│   │   ├── accel-store.ts
│   │   ├── version-store.ts            # NEW
│   │   ├── collaboration-store.ts      # NEW
│   │   └── nodemap-store.ts            # NEW
│   ├── services/
│   │   ├── api.ts                      # NEW
│   │   ├── websocket.ts                # NEW
│   │   └── ai.ts                       # NEW
│   ├── hooks/
│   │   ├── useVersionHistory.ts        # NEW
│   │   ├── useCollaboration.ts         # NEW
│   │   └── useAI.ts                    # NEW
│   └── types/
│       ├── collaboration.ts            # NEW
│       ├── version.ts                  # NEW
│       └── nodemap.ts                  # NEW
├── server/                             # NEW
│   ├── index.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── workbooks.ts
│   │   ├── versions.ts
│   │   └── ai.ts
│   ├── services/
│   │   ├── database.ts
│   │   └── openai.ts
│   └── websocket/
│       └── collaboration.ts
└── package.json
```

---

## Dependencies to Add

### Frontend
```json
{
  "yjs": "^13.6.10",
  "y-websocket": "^1.5.0",
  "y-indexeddb": "^9.0.12",
  "reactflow": "^11.10.1",
  "zustand": "^4.4.7", // already have
  "immer": "^10.0.3",  // already have
  "@anthropic-ai/sdk": "^0.12.0", // Or OpenAI SDK
  "date-fns": "^3.0.6",
  "uuid": "^9.0.1"
}
```

### Backend
```json
{
  "express": "^4.18.2",
  "ws": "^8.16.0",
  "socket.io": "^4.6.1",
  "yjs": "^13.6.10",
  "y-websocket": "^1.5.0",
  "pg": "^8.11.3",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1",
  "openai": "^4.24.1",
  "dotenv": "^16.3.1",
  "cors": "^2.8.5"
}
```

---

## Environment Variables

```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/accel
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
WS_PORT=1234
API_PORT=3001
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

---

## Performance Targets

| Feature | Target | Metric |
|---------|--------|--------|
| Version restore | < 200ms | Time to restore |
| AI response | < 2s | First token |
| Collaboration sync | < 50ms | Latency |
| Node map render | 60fps | Frame rate |
| Auto-save | < 100ms | Background |

---

## Testing Strategy

### Unit Tests
- Version history snapshot/restore
- CRDT merge logic
- Node map graph algorithms

### Integration Tests
- Multi-user collaboration
- AI query flow
- Version timeline

### E2E Tests
- Complete user journeys
- Collaboration scenarios
- Performance benchmarks

---

## Deployment

### Frontend
- Vercel (automatic deployments)
- CDN for assets
- Service Worker for offline

### Backend
- Railway / Render / Heroku
- PostgreSQL database
- Redis for caching
- WebSocket server

### Infrastructure
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: accel
      POSTGRES_USER: accel
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: ./server
    environment:
      DATABASE_URL: postgres://accel:secret@postgres:5432/accel
      REDIS_URL: redis://redis:6379
    ports:
      - "3001:3001"

  ws:
    build: ./server
    command: npm run ws
    ports:
      - "1234:1234"
```

---

## Pricing Model

### Free Tier
- 3 workbooks
- Basic formulas
- 2D graphs
- 5 collaborators
- 7-day version history
- 10 AI queries/month

### Pro - $15/month
- Unlimited workbooks
- All formulas
- 3D visualizations
- Unlimited collaborators
- Unlimited version history
- 100 AI queries/month
- Node maps
- Priority support

### Team - $30/user/month
- Everything in Pro
- Real-time collaboration
- Advanced permissions
- SSO (SAML)
- Audit logs
- API access
- 1000 AI queries/user/month

---

## Success Metrics

### Week 1-4 (Version History)
- ✅ 10 snapshots per session average
- ✅ < 200ms restore time
- ✅ 90% user satisfaction

### Week 5-9 (AI Copilot)
- ✅ 50% of formulas generated by AI
- ✅ < 2s response time
- ✅ 80% formula accuracy

### Week 10-17 (Collaboration)
- ✅ 3+ users per workbook average
- ✅ < 50ms sync latency
- ✅ Zero merge conflicts

### Week 18-22 (Node Maps)
- ✅ 20% of workbooks use node maps
- ✅ 60fps rendering
- ✅ 10+ nodes average

---

## Risk Mitigation

### Technical Risks
1. **CRDT complexity** → Use battle-tested library (Yjs)
2. **AI cost** → Cache aggressively, rate limit
3. **WebSocket scaling** → Use managed service (Ably/Pusher)
4. **Performance** → Lazy loading, code splitting

### Business Risks
1. **Low adoption** → Focus on product-market fit
2. **High churn** → Onboarding, education
3. **Competition** → Unique features (sliders, node maps)

---

## Next Steps

1. **Week 1:** Set up backend infrastructure
2. **Week 2:** Implement version history
3. **Week 3:** AI copilot UI
4. **Week 4:** AI backend integration
5. **Week 5-7:** Collaboration (Yjs integration)
6. **Week 8-9:** Collaboration polish
7. **Week 10-12:** Node map editor
8. **Week 13-14:** Integration & testing
9. **Week 15-16:** Beta launch
10. **Week 17+:** Iterate based on feedback

Ready to build the future! 🚀
