# US-034: Manual Notes Implementation Plan

## User Story

**Jako** Individual User
**Chci** přidat poznámku ke kontaktu po jakékoliv interakci
**Abych** zachytil důležité informace a kontext

## Acceptance Criteria (z DEF.md)

- [x] ~~Basic notes field exists~~ (current state - jednoduchý text field)
- [ ] Rich text editor pro poznámky
- [ ] Timestamping - kdy byla poznámka přidána
- [ ] Možnost připnout důležitou poznámku
- [ ] @mentions pro propojení s jinými kontakty
- [ ] Attachments (dokumenty, obrázky)
- [ ] Historie změn poznámky

---

## Analýza současného stavu

### Co existuje:
1. **Database**: `Contact.notes` - jediné textové pole (String?)
2. **Backend DTO**: `CreateContactDto.notes` - max 5000 znaků
3. **Frontend**: Textarea v `/contacts/new` pro jednu poznámku
4. **Contact Detail**: Poznámky se nezobrazují vůbec!

### Co chybí:
- Podpora pro více poznámek
- Timestamping a historie změn
- Rich text formatting
- Pinned notes
- @mentions s propojením na kontakty
- File attachments

---

## Architektura řešení

### Možnost A: Simple Notes (MVP) ⭐ Doporučeno
- Nový model `ContactNote` pro více poznámek
- Basic rich text editor (Tiptap)
- Pinned notes podpora
- @mentions (bez complex linking)
- Attachments jako URLs v metadata

### Možnost B: Full Notes System
- Kompletní block-based editor (Notion-like)
- Real-time collaboration
- Full audit log
- File storage (S3/GCS)
- Více komplexní, více času

**Doporučení:** Začít s Možností A, rozšířit později.

---

## Implementační plán

### Fáze 1: Database Schema (Backend)
**Estimated time: 1-2 hod**

#### 1.1 Nový Prisma model `ContactNote`

```prisma
model ContactNote {
  id          String    @id @default(cuid())
  contactId   String
  userId      String    // Kdo poznámku vytvořil

  // Content
  content     String    @db.Text    // Rich text jako HTML nebo JSON
  contentType String    @default("html") // "html" | "markdown" | "json"
  plainText   String?   @db.Text    // Stripped text pro full-text search

  // Features
  isPinned    Boolean   @default(false)
  mentions    String[]  @default([])  // Array of contact IDs mentioned

  // Attachments jako JSON array
  attachments Json?     // [{name, url, type, size}]

  // Timestamps
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  contact     Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id])

  @@index([contactId])
  @@index([userId])
  @@index([isPinned])
  @@map("contact_notes")
}
```

#### 1.2 Aktualizace Contact modelu

```prisma
model Contact {
  // ... existing fields ...

  // Přidat relaci
  notes_entries ContactNote[] @relation("ContactNotes")

  // Legacy notes field můžeme zachovat pro zpětnou kompatibilitu
  // nebo migrovat do nového systému
}
```

#### 1.3 Migrace

```bash
npx prisma migrate dev --name add_contact_notes_table
```

---

### Fáze 2: Backend API (NestJS)
**Estimated time: 3-4 hod**

#### 2.1 DTOs

**File:** `backend/src/modules/contacts/dto/contact-note.dto.ts`

```typescript
// CreateContactNoteDto
export class CreateContactNoteDto {
  @IsString()
  @MaxLength(50000)
  content: string;

  @IsOptional()
  @IsEnum(['html', 'markdown', 'json'])
  contentType?: 'html' | 'markdown' | 'json' = 'html';

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[]; // Contact IDs

  @IsOptional()
  attachments?: AttachmentDto[];
}

// UpdateContactNoteDto
export class UpdateContactNoteDto extends PartialType(CreateContactNoteDto) {}

// AttachmentDto
export class AttachmentDto {
  @IsString()
  name: string;

  @IsUrl()
  url: string;

  @IsString()
  type: string; // MIME type

  @IsNumber()
  size: number; // bytes
}
```

#### 2.2 Notes Controller

**File:** `backend/src/modules/contacts/notes.controller.ts`

```typescript
@Controller('contacts/:contactId/notes')
@UseGuards(AuthGuard)
export class ContactNotesController {

  @Post()
  async createNote(
    @Param('contactId') contactId: string,
    @Body() dto: CreateContactNoteDto,
    @CurrentUser() user: User
  ) {}

  @Get()
  async getNotes(
    @Param('contactId') contactId: string,
    @Query() query: GetNotesQueryDto
  ) {}

  @Get(':noteId')
  async getNote(
    @Param('contactId') contactId: string,
    @Param('noteId') noteId: string
  ) {}

  @Patch(':noteId')
  async updateNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateContactNoteDto
  ) {}

  @Delete(':noteId')
  async deleteNote(@Param('noteId') noteId: string) {}

  @Patch(':noteId/pin')
  async togglePin(@Param('noteId') noteId: string) {}
}
```

#### 2.3 Notes Service

**File:** `backend/src/modules/contacts/notes.service.ts`

```typescript
@Injectable()
export class ContactNotesService {
  constructor(private prisma: PrismaService) {}

  async createNote(contactId: string, userId: string, dto: CreateContactNoteDto) {
    // Validate contact ownership
    // Strip HTML for plainText search
    // Create note
  }

  async getNotes(contactId: string, options?: GetNotesOptions) {
    // Get notes with optional filtering
    // Pinned notes first
    // Pagination support
  }

  async updateNote(noteId: string, userId: string, dto: UpdateContactNoteDto) {
    // Verify ownership
    // Update note
    // Track edit history (optional)
  }

  async deleteNote(noteId: string, userId: string) {
    // Soft delete or hard delete
  }

  async togglePin(noteId: string, userId: string) {
    // Toggle isPinned flag
  }
}
```

---

### Fáze 3: Frontend - Notes Section UI
**Estimated time: 4-5 hod**

#### 3.1 Instalace závislostí

```bash
# Rich text editor
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-mention @tiptap/extension-link @tiptap/extension-placeholder

# Mention suggestions
npm install @tiptap/suggestion
```

#### 3.2 Types

**File:** `frontend/src/types/note.ts`

```typescript
export interface ContactNote {
  id: string;
  contactId: string;
  userId: string;
  content: string;
  contentType: 'html' | 'markdown' | 'json';
  plainText?: string;
  isPinned: boolean;
  mentions: string[];
  attachments?: NoteAttachment[];
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface NoteAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface CreateNoteInput {
  content: string;
  contentType?: 'html' | 'markdown';
  isPinned?: boolean;
  mentions?: string[];
  attachments?: NoteAttachment[];
}
```

#### 3.3 API Hooks

**File:** `frontend/src/hooks/use-notes.ts`

```typescript
export function useContactNotes(contactId: string) {
  return useQuery({
    queryKey: ['contact-notes', contactId],
    queryFn: () => notesService.getNotes(contactId),
  });
}

export function useCreateNote() {
  return useMutation({
    mutationFn: ({ contactId, data }) => notesService.createNote(contactId, data),
    onSuccess: () => queryClient.invalidateQueries(['contact-notes']),
  });
}

export function useUpdateNote() { ... }
export function useDeleteNote() { ... }
export function useToggleNotePin() { ... }
```

#### 3.4 Rich Text Editor Component

**File:** `frontend/src/components/notes/RichTextEditor.tsx`

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
  content?: string;
  onChange: (content: string) => void;
  placeholder?: string;
  contacts?: Contact[]; // For @mentions suggestions
}

export function RichTextEditor({ content, onChange, placeholder, contacts }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link,
      Placeholder.configure({ placeholder: placeholder || 'Write your note...' }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }) => contacts?.filter(c =>
            c.firstName.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 5) || [],
          render: () => ({
            // Mention dropdown UI
          }),
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <div className="rich-text-editor">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

#### 3.5 Notes List Component

**File:** `frontend/src/components/notes/NotesList.tsx`

```typescript
export function NotesList({ contactId }: { contactId: string }) {
  const { data: notes, isLoading } = useContactNotes(contactId);
  const togglePin = useToggleNotePin();
  const deleteNote = useDeleteNote();

  // Separate pinned notes
  const pinnedNotes = notes?.filter(n => n.isPinned) || [];
  const regularNotes = notes?.filter(n => !n.isPinned) || [];

  return (
    <div className="space-y-4">
      {pinnedNotes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Pin className="h-4 w-4" />
            Pinned Notes
          </h4>
          {pinnedNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onTogglePin={() => togglePin.mutate(note.id)}
              onDelete={() => deleteNote.mutate(note.id)}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {regularNotes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            onTogglePin={() => togglePin.mutate(note.id)}
            onDelete={() => deleteNote.mutate(note.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

#### 3.6 Note Card Component

**File:** `frontend/src/components/notes/NoteCard.tsx`

```typescript
export function NoteCard({ note, onTogglePin, onDelete }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Card className={cn(note.isPinned && "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20")}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <NoteEditForm note={note} onCancel={() => setIsEditing(false)} />
            ) : (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: note.content }}
              />
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onTogglePin}>
                <Pin className="h-4 w-4 mr-2" />
                {note.isPinned ? 'Unpin' : 'Pin'} Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Attachments */}
        {note.attachments && note.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {note.attachments.map((att, idx) => (
              <AttachmentBadge key={idx} attachment={att} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
          <span>{note.user?.name || 'Unknown'}</span>
          <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 3.7 Integrace do Contact Detail Page

**File:** `frontend/src/app/(app)/[orgSlug]/contacts/[id]/page.tsx`

Přidat novou tab "Notes":

```typescript
<TabsList className="grid w-full grid-cols-3">
  <TabsTrigger value="timeline">...</TabsTrigger>
  <TabsTrigger value="ai-summary">...</TabsTrigger>
  <TabsTrigger value="notes" className="flex items-center gap-2">
    <FileText className="h-4 w-4" />
    Notes
  </TabsTrigger>
</TabsList>

<TabsContent value="notes" className="mt-4">
  <NotesSection contactId={contactId} />
</TabsContent>
```

---

### Fáze 4: Attachments (Optional - Phase 2)
**Estimated time: 3-4 hod**

#### 4.1 File Upload Endpoint

Pro MVP lze využít:
- **Signed URLs** - upload přímo na cloud storage
- **Local storage** - `uploads/` folder pro development
- **External service** - Cloudinary, Uploadcare

```typescript
// Backend endpoint
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadAttachment(
  @UploadedFile() file: Express.Multer.File
): Promise<{ url: string; name: string; type: string; size: number }> {
  // Upload to S3/GCS/local
  // Return file metadata
}
```

#### 4.2 Frontend File Upload

```typescript
function AttachmentUpload({ onUpload }: { onUpload: (att: NoteAttachment) => void }) {
  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const result = await api.post('/attachments/upload', formData);
    onUpload(result.data);
  };

  return (
    <div className="flex items-center gap-2">
      <Input type="file" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
    </div>
  );
}
```

---

### Fáze 5: @Mentions Enhancement
**Estimated time: 2-3 hod**

#### 5.1 Mentions API

```typescript
// GET /contacts/search?q=john&limit=5
// Returns contacts for mention suggestions

// Mention storage
mentions: ['contact-id-1', 'contact-id-2']
```

#### 5.2 Mentions Display

```typescript
// Render @mentions as links to contact profiles
<span
  className="mention text-primary cursor-pointer hover:underline"
  onClick={() => router.push(`/contacts/${mentionId}`)}
>
  @John Doe
</span>
```

---

## Task Breakdown

| # | Task | Est. | Priority | Dependencies |
|---|------|------|----------|--------------|
| 1 | Create Prisma schema for ContactNote | 1h | P0 | - |
| 2 | Run database migration | 0.5h | P0 | Task 1 |
| 3 | Create Backend DTOs | 1h | P0 | - |
| 4 | Implement ContactNotesService | 2h | P0 | Task 1, 3 |
| 5 | Create ContactNotesController | 1.5h | P0 | Task 4 |
| 6 | Write backend unit tests | 1.5h | P1 | Task 4, 5 |
| 7 | Install frontend dependencies (Tiptap) | 0.5h | P0 | - |
| 8 | Create Note types | 0.5h | P0 | - |
| 9 | Create notes API service | 1h | P0 | Task 5, 8 |
| 10 | Create React Query hooks | 1h | P0 | Task 9 |
| 11 | Build RichTextEditor component | 2h | P0 | Task 7 |
| 12 | Build NoteCard component | 1.5h | P0 | Task 8 |
| 13 | Build NotesList component | 1h | P0 | Task 12 |
| 14 | Build NotesSection (create + list) | 1.5h | P0 | Task 11, 13 |
| 15 | Integrate into Contact Detail page | 1h | P0 | Task 14 |
| 16 | Add @mentions suggestion | 2h | P1 | Task 11 |
| 17 | Implement file upload (backend) | 2h | P2 | - |
| 18 | Implement attachments UI | 2h | P2 | Task 17 |
| 19 | E2E tests | 2h | P1 | All above |

**Total estimated time:** ~22-25 hodin

---

## File Structure After Implementation

```
backend/src/modules/contacts/
├── dto/
│   ├── contact-note.dto.ts          # NEW
│   └── ...
├── notes.controller.ts              # NEW
├── notes.service.ts                 # NEW
├── notes.service.spec.ts            # NEW
└── ...

frontend/src/
├── components/
│   └── notes/                       # NEW folder
│       ├── RichTextEditor.tsx
│       ├── EditorToolbar.tsx
│       ├── NoteCard.tsx
│       ├── NotesList.tsx
│       ├── NotesSection.tsx
│       ├── CreateNoteForm.tsx
│       └── index.ts
├── hooks/
│   └── use-notes.ts                 # NEW
├── lib/api/services/
│   └── notes.service.ts             # NEW
└── types/
    └── note.ts                      # NEW
```

---

## Rizika a mitigace

| Riziko | Impact | Pravděpodobnost | Mitigace |
|--------|--------|-----------------|----------|
| Tiptap performance s velkým obsahem | Medium | Low | Lazy loading, virtualizace |
| XSS při renderování HTML | High | Medium | Sanitize HTML (DOMPurify) |
| File upload size limits | Medium | Medium | Max 10MB, validace MIME |
| Migration existing notes | Low | Medium | Backward compatibility |

---

## Testing Strategy

### Unit Tests (Backend)
- NotesService CRUD operations
- Authorization checks
- Input validation

### Integration Tests (Backend)
- Notes API endpoints
- Database constraints

### Component Tests (Frontend)
- RichTextEditor rendering
- NoteCard interactions
- @mentions functionality

### E2E Tests
- Create note flow
- Edit note flow
- Pin/unpin note
- Delete note

---

## Definition of Done

- [ ] All acceptance criteria from DEF.md met
- [ ] Backend API implemented with tests
- [ ] Frontend UI complete with responsive design
- [ ] @mentions working with contact linking
- [ ] Pinned notes displayed first
- [ ] Timestamps shown on all notes
- [ ] No console errors or warnings
- [ ] Documentation updated

