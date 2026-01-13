// Quick test script for Calendar and Focus Mode
// Run this in browser console when app is running

const testCalendar = async () => {
  const { invoke } = window.__TAURI_INVOKE__ || (await import('@tauri-apps/api/core')).invoke;
  
  console.log('=== Testing Calendar ===');
  
  // 1. Get OAuth URL
  try {
    const authUrl = await invoke('get_google_auth_url');
    console.log('1. OAuth URL:', authUrl);
    console.log('   → Open this URL in browser to authenticate');
  } catch (e) {
    console.error('Error getting auth URL:', e);
  }
  
  // 2. Get events (will be empty until authenticated)
  try {
    const events = await invoke('get_calendar_events');
    console.log('2. Calendar events:', events);
  } catch (e) {
    console.error('Error getting events:', e);
  }
  
  // 3. Get next meeting
  try {
    const next = await invoke('get_next_meeting');
    console.log('3. Next meeting:', next);
  } catch (e) {
    console.error('Error getting next meeting:', e);
  }
};

const testFocusMode = async () => {
  const { invoke } = window.__TAURI_INVOKE__ || (await import('@tauri-apps/api/core')).invoke;
  
  console.log('=== Testing Focus Mode ===');
  
  // 1. Start focus session
  try {
    const session = await invoke('start_focus_mode', { 
      mode_str: 'focus25', 
      custom_minutes: null 
    });
    console.log('1. Focus session started:', session);
  } catch (e) {
    console.error('Error starting focus:', e);
  }
  
  // 2. Check status
  try {
    const isActive = await invoke('is_focus_active');
    console.log('2. Focus active:', isActive);
    
    const remaining = await invoke('get_focus_remaining_seconds');
    if (remaining) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      console.log(`   Time remaining: ${mins}m ${secs}s`);
    }
  } catch (e) {
    console.error('Error checking status:', e);
  }
  
  // 3. Stop focus (uncomment to test)
  // try {
  //   await invoke('stop_focus_mode');
  //   console.log('3. Focus stopped');
  // } catch (e) {
  //   console.error('Error stopping focus:', e);
  // }
};

// Run tests
console.log('Run testCalendar() or testFocusMode() in console');

