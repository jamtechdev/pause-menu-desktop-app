# Phase 2.3: Window Tracking & Enumeration - Test Checklist

## ✅ Implementation Status
- [x] Window enumeration using `EnumWindows` API
- [x] Window tracking service (`WindowTracker`)
- [x] Tauri commands for window operations
- [x] Window data model (`WindowInfo`)
- [x] Focus change tracking
- [x] Window open/close detection
- [x] Polling mechanism (2-second intervals)

## 🧪 Testing Checklist

### 1. Basic Window Enumeration
**Test:** Get all open windows
```javascript
// In browser console or React component
const windows = await window.__TAURI_INVOKE__('get_windows');
console.log('All windows:', windows);
```

**Expected:**
- [ ] Returns array of window objects
- [ ] Each window has: `id`, `title`, `process_name`, `icon` (optional)
- [ ] Only visible windows with titles are included
- [ ] No empty titles or system windows

**Test:** Get detailed window info
```javascript
const windowsInfo = await window.__TAURI_INVOKE__('get_windows_info');
console.log('Detailed windows:', windowsInfo);
```

**Expected:**
- [ ] Returns array of `WindowInfo` objects
- [ ] Each window has: `handle`, `title`, `process_name`, `executable_path`, `last_active`, `is_visible`
- [ ] `handle` is a numeric ID (isize)
- [ ] `last_active` is a valid DateTime string
- [ ] `is_visible` is boolean

---

### 2. Visible Windows Filtering
**Test:** Get only visible windows
```javascript
const visibleWindows = await window.__TAURI_INVOKE__('get_visible_windows');
console.log('Visible windows:', visibleWindows);
```

**Expected:**
- [ ] Returns only windows where `is_visible === true`
- [ ] Count should be ≤ total windows
- [ ] All returned windows should have `is_visible: true`

**Manual Test:**
1. Open multiple applications (Chrome, VS Code, Notepad, etc.)
2. Minimize some windows
3. Call `get_visible_windows()`
4. Verify only non-minimized windows are returned

---

### 3. Active Window Detection
**Test:** Get currently active (foreground) window
```javascript
const activeWindow = await window.__TAURI_INVOKE__('get_active_window');
console.log('Active window:', activeWindow);
```

**Expected:**
- [ ] Returns `WindowInfo` object or `null`
- [ ] Window title matches the currently focused application
- [ ] Process name is correct (e.g., "chrome.exe", "Code.exe")

**Manual Test:**
1. Focus on Chrome → Call `get_active_window()` → Should return Chrome window
2. Switch to VS Code → Call `get_active_window()` → Should return VS Code window
3. Switch to Notepad → Call `get_active_window()` → Should return Notepad window

---

### 4. Window Titles List
**Test:** Get all window titles
```javascript
const titles = await window.__TAURI_INVOKE__('get_window_titles');
console.log('Window titles:', titles);
```

**Expected:**
- [ ] Returns array of strings
- [ ] Each string is a window title
- [ ] No empty strings
- [ ] Titles match actual window titles

---

### 5. Process Names List
**Test:** Get unique process names
```javascript
const processNames = await window.__TAURI_INVOKE__('get_process_names');
console.log('Process names:', processNames);
```

**Expected:**
- [ ] Returns array of unique strings
- [ ] Sorted alphabetically
- [ ] No duplicates
- [ ] Contains process names like "chrome.exe", "Code.exe", "notepad.exe"

**Note:** Currently returns placeholder format `Process_{id}` or `C:\Process_{id}.exe` because `get_executable_path` is not fully implemented.

---

### 6. Focus Change Tracking
**Test:** Monitor focus changes
- Check terminal logs when switching between windows
- Look for: `"Focus changed to: {title} ({process_name})"`

**Manual Test:**
1. Open multiple applications
2. Switch between them (Alt+Tab or clicking)
3. Check terminal/console for focus change logs
4. Verify logs show correct window title and process name

**Expected:**
- [ ] Logs appear when focus changes
- [ ] Correct window title is logged
- [ ] Correct process name is logged
- [ ] No false positives (logging when focus hasn't changed)

---

### 7. Window Open/Close Detection
**Test:** Detect when windows open or close
- Check terminal logs when opening/closing applications
- Look for: `"Windows opened: [...]"` and `"Windows closed: [...]"`

**Manual Test:**
1. Note current window count
2. Open a new application (e.g., Calculator)
3. Check terminal for "Windows opened" log
4. Close the application
5. Check terminal for "Windows closed" log

**Expected:**
- [ ] Opening a window logs the window title
- [ ] Closing a window logs the window handle
- [ ] No false positives
- [ ] Works for different application types

---

### 8. Polling Mechanism
**Test:** Automatic polling for changes
- The `poll()` method should be called every 2 seconds
- Should detect focus changes, window opens, and window closes

**Note:** Currently, polling is not automatically started. It needs to be called manually or integrated into the app lifecycle.

**To Test:**
1. Check if polling is integrated in `lib.rs` setup
2. If not, add a background task that calls `tracker.poll()` every 2 seconds
3. Verify it detects changes automatically

---

### 9. Window Caching
**Test:** Window cache maintains state
- First call to `enumerate_windows()` should populate cache
- Subsequent calls should update cache
- `last_active` time should be preserved for existing windows

**Expected:**
- [ ] Cache is maintained between calls
- [ ] `last_active` is preserved for windows that still exist
- [ ] New windows get current timestamp
- [ ] Closed windows are removed from cache

---

### 10. Performance Testing
**Test:** Enumeration performance
- Measure time to enumerate all windows
- Should complete in < 500ms for typical system (50-100 windows)

**Expected:**
- [ ] Enumeration completes quickly (< 500ms)
- [ ] No noticeable lag when calling commands
- [ ] Memory usage is reasonable

---

### 11. Edge Cases
**Test:** Handle edge cases gracefully

- [ ] No windows open → Returns empty array (not error)
- [ ] All windows minimized → `get_visible_windows()` returns empty array
- [ ] System windows (no title) → Skipped (not included)
- [ ] Invalid window handle → Handled gracefully
- [ ] Process terminated → Window removed from cache

---

### 12. Frontend Integration
**Test:** Use from React components

**Check if these are working:**
- [ ] `useWindows` hook works
- [ ] `api.getWindows()` returns data
- [ ] Window list displays in UI (if implemented)
- [ ] Error handling works

**To Test:**
```typescript
// In a React component
import { useWindows } from '../hooks/useWindows';

function MyComponent() {
  const { windows, loading, error, refreshWindows } = useWindows();
  
  useEffect(() => {
    console.log('Windows:', windows);
  }, [windows]);
  
  return (
    <div>
      <button onClick={refreshWindows}>Refresh</button>
      {windows.map(w => <div key={w.id}>{w.title}</div>)}
    </div>
  );
}
```

---

## 🔧 Known Issues / TODOs

1. **Executable Path:** `get_executable_path()` returns placeholder format
   - Current: `"C:\\Process_{id}.exe"`
   - TODO: Implement proper path retrieval using `QueryFullProcessImageNameW` or `psapi` crate

2. **Polling Integration:** Polling is not automatically started
   - TODO: Add background task in `lib.rs` setup to call `tracker.poll()` every 2 seconds
   - TODO: Emit events to frontend when changes detected

3. **Frontend API:** Some commands may not be exposed in `api.ts`
   - Check: `get_windows_info`, `get_visible_windows`, `get_active_window`, `get_window_titles`, `get_process_names`
   - TODO: Add missing commands to `src/services/api.ts`

4. **Error Handling:** Verify error handling for all edge cases

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

Basic Enumeration: [ ] Pass [ ] Fail - Notes: ___________
Visible Windows: [ ] Pass [ ] Fail - Notes: ___________
Active Window: [ ] Pass [ ] Fail - Notes: ___________
Window Titles: [ ] Pass [ ] Fail - Notes: ___________
Process Names: [ ] Pass [ ] Fail - Notes: ___________
Focus Tracking: [ ] Pass [ ] Fail - Notes: ___________
Open/Close Detection: [ ] Pass [ ] Fail - Notes: ___________
Polling: [ ] Pass [ ] Fail - Notes: ___________
Caching: [ ] Pass [ ] Fail - Notes: ___________
Performance: [ ] Pass [ ] Fail - Notes: ___________
Edge Cases: [ ] Pass [ ] Fail - Notes: ___________
Frontend Integration: [ ] Pass [ ] Fail - Notes: ___________

Overall Status: [ ] Ready [ ] Needs Fixes
```

---

## 🚀 Quick Test Commands

Open browser console (DevTools) and run:

```javascript
// Test all commands
(async () => {
  const { invoke } = window.__TAURI_INVOKE__ || (await import('@tauri-apps/api/core')).invoke;
  
  console.log('=== Testing Window Tracking ===');
  
  console.log('\n1. All Windows:');
  console.log(await invoke('get_windows'));
  
  console.log('\n2. Detailed Info:');
  console.log(await invoke('get_windows_info'));
  
  console.log('\n3. Visible Only:');
  console.log(await invoke('get_visible_windows'));
  
  console.log('\n4. Active Window:');
  console.log(await invoke('get_active_window'));
  
  console.log('\n5. Titles:');
  console.log(await invoke('get_window_titles'));
  
  console.log('\n6. Process Names:');
  console.log(await invoke('get_process_names'));
})();
```

