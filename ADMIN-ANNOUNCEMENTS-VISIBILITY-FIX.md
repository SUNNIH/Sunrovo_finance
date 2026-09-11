# Admin Announcements Visibility Controls

## Problem

The admin UI displayed announcement status ("Live" or "Hidden") but provided no way to control visibility. Admins could create announcements but couldn't hide or show them after creation.

## Solution

Added visibility toggle controls to the announcements section of the admin console.

## Implementation

### Changes to `app/admin/admin-console.tsx`

#### 1. Added State for Toggle Loading
```tsx
const [togglingAnnouncement, setTogglingAnnouncement] = React.useState<string | null>(null);
```
- Tracks which announcement is currently being toggled
- Prevents duplicate clicks while request is processing
- Shows loading indicator on the button

#### 2. Added Toggle Function
```tsx
async function toggleAnnouncementVisibility(id: string, currentIsActive: boolean) {
  setTogglingAnnouncement(id);
  try {
    await patchJson("/api/admin/announcements", { id, isActive: !currentIsActive });
    await load();
  } catch (e) {
    setError(e instanceof ApiRequestError ? e.message : "Could not update announcement visibility.");
  } finally {
    setTogglingAnnouncement(null);
  }
}
```

**Behavior**:
- Calls `PATCH /api/admin/announcements` with `{ id, isActive: !currentIsActive }`
- Reloads announcement list on success
- Shows error message using existing error UI on failure
- Clears loading state in finally block

#### 3. Updated Announcement Display
```tsx
// BEFORE
<div key={a.id} className="text-sm">
  <span className="font-medium">{a.title}</span>
  <span className="ml-2 text-text-secondary">{a.isActive ? "Live" : "Hidden"}</span>
</div>

// AFTER
<div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-2">
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium">{a.title}</p>
    <p className="text-xs text-text-secondary">{a.isActive ? "Live" : "Hidden"}</p>
  </div>
  <Button
    size="sm"
    variant="outline"
    onClick={() => toggleAnnouncementVisibility(a.id, a.isActive)}
    disabled={togglingAnnouncement === a.id}
  >
    {togglingAnnouncement === a.id ? "..." : a.isActive ? "Hide" : "Show"}
  </Button>
</div>
```

**Key improvements**:
- Each announcement in a card-style container with border and padding
- Title and status stacked vertically for better layout
- "Hide" button for active announcements
- "Show" button for inactive announcements
- Button disabled and shows "..." while processing
- Title truncates if too long (`truncate` class)

## Features

### Button Behavior
- **Active announcement**: Shows "Hide" button
- **Inactive announcement**: Shows "Show" button
- **Processing**: Button disabled, text changes to "..."
- **Error**: Shows in existing error banner at top of page
- **Success**: List reloads automatically with updated status

### UI/UX
- Clear visual separation between announcements (bordered cards)
- Status ("Live" / "Hidden") visible alongside title
- Button label matches action (Hide/Show)
- Loading state prevents duplicate clicks
- Error handling uses existing admin console error UI

### Backend Integration
- Uses existing `PATCH /api/admin/announcements` endpoint
- Backend `setAnnouncementActive()` already handles the logic
- Audit logs automatically created by backend
- No changes to API, backend, or audit behavior

## Customer Impact

When an admin hides an announcement:
- It disappears from the customer-facing announcement banner
- Remains visible in the admin console as "Hidden"
- Can be re-shown at any time

When an admin shows a previously hidden announcement:
- It reappears in the customer-facing announcement banner
- Status updates to "Live" in admin console

## Validation Results

### TypeCheck
```bash
npm run typecheck
```
**Result**: ✅ PASS — No TypeScript errors

### Lint
```bash
npm run lint
```
**Result**: ✅ PASS — No ESLint warnings or errors

## Files Modified

1. `app/admin/admin-console.tsx` - Added visibility toggle controls

**Changes**:
- Added `togglingAnnouncement` state
- Added `toggleAnnouncementVisibility()` function
- Updated announcement list display with buttons
- ~20 lines added/modified

## Preserved

✅ Existing backend API behavior  
✅ Audit logging (handled by backend)  
✅ Error handling UI  
✅ Announcement creation flow  
✅ No deletion functionality (announcements remain in database)  
✅ All other admin console features

## Summary

Added Hide/Show buttons to each announcement in the admin console. Active announcements show a "Hide" button, inactive ones show "Show". Clicking toggles the `isActive` state via the existing PATCH endpoint, reloads the list on success, and shows errors using the existing error banner. The button is disabled during processing to prevent duplicate requests. Hidden announcements disappear from customer-facing banners but remain visible to admins with "Hidden" status.
