use crate::services::focus_service::{get_focus_service, FocusMode, FocusSession};

#[tauri::command]
pub async fn start_focus_mode(mode_str: String, custom_minutes: Option<u32>) -> Result<FocusSession, String> {
    let mode = match mode_str.as_str() {
        "focus1" => FocusMode::Focus1,
        "focus15" => FocusMode::Focus15,
        "focus25" => FocusMode::Focus25,
        "deepwork60" => FocusMode::DeepWork60,
        "clearinbox10" => FocusMode::ClearInbox10,
        "prepformeeting" => FocusMode::PrepForMeeting,
        "custom" => {
            let minutes = custom_minutes.ok_or("Custom mode requires minutes parameter")?;
            FocusMode::Custom(minutes)
        }
        _ => return Err(format!("Unknown focus mode: {}", mode_str)),
    };

    println!("[Focus] start_focus_mode command called with mode: {:?}", mode);
    
    let service = get_focus_service().await;
    let service = service.lock().await;
    
    println!("[Focus] Service acquired, starting focus mode...");
    
    match service.start_focus_mode(mode).await {
        Ok(session) => {
            println!("[Focus] ✓ Focus mode started successfully: {:?}", session.mode);
            Ok(session)
        },
        Err(e) => {
            eprintln!("[Focus] ✗ Failed to start focus mode: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn stop_focus_mode() -> Result<(), String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    service.stop_focus_mode().await
}

#[tauri::command]
pub async fn get_current_focus_session() -> Result<Option<FocusSession>, String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    Ok(service.get_current_session().await)
}

#[tauri::command]
pub async fn get_focus_remaining_seconds() -> Result<Option<u64>, String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    Ok(service.get_remaining_seconds().await)
}

#[tauri::command]
pub async fn is_focus_active() -> Result<bool, String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    Ok(service.is_active().await)
}

#[tauri::command]
pub async fn get_meeting_suggestions() -> Result<Vec<crate::services::focus_service::MeetingSuggestion>, String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    
    let session = service.get_current_session().await;
    if let Some(session) = session {
        service.get_meeting_suggestions(session.end_time).await
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
#[cfg(windows)]
pub async fn open_focus_assist_settings() -> Result<(), String> {
    use std::process::Command;
    
    // Open Windows Settings to Focus Assist page
    Command::new("powershell")
        .args([
            "-ExecutionPolicy",
            "Bypass",
            "-NoProfile",
            "-Command",
            "Start-Process 'ms-settings:quiethours'"
        ])
        .output()
        .map_err(|e| format!("Failed to open Focus Assist settings: {}", e))?;
    
    Ok(())
}

#[tauri::command]
#[cfg(not(windows))]
pub async fn open_focus_assist_settings() -> Result<(), String> {
    Err("Not available on this platform".to_string())
}

#[tauri::command]
pub async fn temporarily_mute_notifications(duration_minutes: Option<u32>) -> Result<(), String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    service.temporarily_mute_notifications(duration_minutes).await
}

#[tauri::command]
pub async fn unmute_notifications() -> Result<(), String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    service.unmute_notifications().await
}

#[tauri::command]
pub async fn get_temporary_mute_remaining() -> Result<Option<u64>, String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    Ok(service.get_temporary_mute_remaining().await)
}

#[tauri::command]
pub async fn is_notifications_muted() -> Result<bool, String> {
    let service = get_focus_service().await;
    let service = service.lock().await;
    Ok(service.is_notifications_muted().await)
}

#[tauri::command]
pub async fn reschedule_meeting(event_id: String, minutes_offset: i64) -> Result<crate::models::action::CalendarEvent, String> {
    use crate::services::calendar_service::get_calendar_service;
    
    println!("[Focus] Rescheduling meeting {} by {} minutes", event_id, minutes_offset);
    
    let calendar_service = get_calendar_service().await;
    let calendar_service = calendar_service.lock().await;
    
    calendar_service.reschedule_event(event_id, minutes_offset).await
}
