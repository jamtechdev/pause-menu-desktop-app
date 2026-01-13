// Test helpers for Calendar and Focus Mode
// Use these functions in browser console: window.testCalendar() or window.testFocus()

import { api } from '../services/api';

export const testCalendar = async () => {
  console.log('=== Testing Calendar Integration ===\n');
  
  try {
    // Step 1: Get OAuth URL
    console.log('1. Getting Google OAuth URL...');
    const authUrl = await api.getGoogleAuthUrl();
    console.log('✓ OAuth URL:', authUrl);
    console.log('→ Copy this URL and open it in your browser to authenticate\n');
    
    // Step 2: Check current events (will be empty until authenticated)
    console.log('2. Getting calendar events...');
    const events = await api.getCalendarEvents();
    console.log('✓ Events found:', events.length);
    if (events.length > 0) {
      console.log('   Events:', events);
    } else {
      console.log('   No events yet. Authenticate first.\n');
    }
    
    // Step 3: Get next meeting
    console.log('3. Getting next meeting...');
    const nextMeeting = await api.getNextMeeting();
    if (nextMeeting) {
      console.log('✓ Next meeting:', nextMeeting);
    } else {
      console.log('   No upcoming meetings\n');
    }
    
    // Step 4: Time until next meeting
    console.log('4. Time until next meeting...');
    const timeUntil = await api.timeUntilNextMeeting();
    if (timeUntil) {
      const minutes = Math.floor(timeUntil / 60);
      const seconds = timeUntil % 60;
      console.log(`✓ Meeting in ${minutes}m ${seconds}s\n`);
    } else {
      console.log('   No upcoming meetings\n');
    }
    
    console.log('=== Calendar Test Complete ===');
    console.log('\nTo complete OAuth:');
    console.log('1. Open the OAuth URL above');
    console.log('2. Sign in and authorize');
    console.log('3. Copy the "code" parameter from the redirect URL');
    console.log('4. Run: await api.handleOAuthCallback("google", "YOUR_CODE")');
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    if (error.includes('not configured')) {
      console.log('\n⚠ Make sure .env file has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }
  }
};

export const testFocusMode = async () => {
  console.log('=== Testing Focus Mode ===\n');
  
  try {
    // Step 1: Check current status
    console.log('1. Checking focus status...');
    const isActive = await api.isFocusActive();
    console.log(`✓ Focus active: ${isActive}\n`);
    
    if (isActive) {
      const session = await api.getCurrentFocusSession();
      const remaining = await api.getFocusRemainingSeconds();
      if (session && remaining) {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        console.log(`   Current session: ${session.mode.name}`);
        console.log(`   Time remaining: ${mins}m ${secs}s\n`);
      }
    }
    
    // Step 2: Start a test focus session (15 minutes)
    if (!isActive) {
      console.log('2. Starting focus session (15 minutes)...');
      const session = await api.startFocusMode('focus15');
      console.log('✓ Focus session started!');
      console.log('   Mode:', session.mode.name);
      console.log('   Duration:', session.duration_minutes, 'minutes');
      console.log('   End time:', new Date(session.end_time).toLocaleString());
      console.log('\n⚠ Focus Assist should be enabled now');
      console.log('⚠ Notifications should be muted\n');
    }
    
    // Step 3: Monitor countdown
    console.log('3. Monitoring countdown (will update every second)...');
    let count = 0;
    const interval = setInterval(async () => {
      count++;
      const remaining = await api.getFocusRemainingSeconds();
      if (remaining) {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        console.log(`   ${mins}:${secs.toString().padStart(2, '0')} remaining`);
      } else {
        console.log('   Focus session ended!');
        clearInterval(interval);
      }
      
      if (count >= 5) {
        clearInterval(interval);
        console.log('\n✓ Countdown working! (stopped after 5 updates)');
      }
    }, 1000);
    
    // Step 4: Test stop (uncomment to test)
    // console.log('\n4. Testing stop...');
    // await api.stopFocusMode();
    // console.log('✓ Focus mode stopped\n');
    
    console.log('\n=== Focus Mode Test Complete ===');
    console.log('\nTo stop focus mode:');
    console.log('await api.stopFocusMode()');
    
  } catch (error: any) {
    console.error('❌ Error:', error);
  }
};

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testCalendar = testCalendar;
  (window as any).testFocus = testFocusMode;
}

