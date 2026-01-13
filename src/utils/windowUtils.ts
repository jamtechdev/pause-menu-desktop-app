// Window utility functions

export const formatWindowTitle = (title: string, maxLength: number = 50): string => {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
};

/**
 * Get emoji icon for a process based on its name
 */
export const getProcessIcon = (processName: string): string => {
  const name = processName.toLowerCase();
  
  // Browser icons
  if (name.includes('chrome') || name.includes('msedge') || name.includes('firefox')) {
    return '🌐';
  }
  if (name.includes('brave')) return '🦁';
  if (name.includes('opera')) return '🎭';
  
  // Code editors
  if (name.includes('cursor') || name.includes('code') || name.includes('vscode')) {
    return '💻';
  }
  if (name.includes('notepad')) return '📝';
  if (name.includes('sublime')) return '✨';
  
  // File managers
  if (name.includes('explorer') || name.includes('files')) {
    return '📁';
  }
  
  // System
  if (name.includes('settings') || name.includes('control')) {
    return '⚙️';
  }
  if (name.includes('taskmgr') || name.includes('task manager')) {
    return '📊';
  }
  
  // Media
  if (name.includes('vlc') || name.includes('media')) {
    return '🎬';
  }
  if (name.includes('spotify') || name.includes('music')) {
    return '🎵';
  }
  
  // Communication
  if (name.includes('discord') || name.includes('slack') || name.includes('teams')) {
    return '💬';
  }
  if (name.includes('outlook') || name.includes('mail')) {
    return '📧';
  }
  
  // Development tools
  if (name.includes('git') || name.includes('github')) {
    return '🔀';
  }
  if (name.includes('docker')) return '🐳';
  if (name.includes('node')) return '🟢';
  
  // Database tools
  if (name.includes('datagrip') || name.includes('dbeaver') || name.includes('sql')) {
    return '🗄️';
  }
  
  // Default window icon
  return '🪟';
};

/**
 * Clean and format process name for display
 * Removes underscores, normalizes dashes, capitalizes properly
 */
export const cleanProcessName = (processName: string): string => {
  if (!processName) return 'Unknown';
  
  // Remove .exe extension
  let cleaned = processName.replace(/\.exe$/i, '');
  
  // Replace underscores with spaces
  cleaned = cleaned.replace(/_/g, ' ');
  
  // Normalize multiple dashes to single dash
  cleaned = cleaned.replace(/-+/g, '-');
  
  // Remove "Process_" prefix if present
  cleaned = cleaned.replace(/^Process\s*\d+/i, '');
  
  // Capitalize first letter of each word
  cleaned = cleaned
    .split(/[\s-]+/)
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || processName;
};

/**
 * Clean and format window title for display
 */
export const cleanWindowTitle = (title: string): string => {
  if (!title) return '(No Title)';
  
  // Remove common separators and normalize
  let cleaned = title
    .replace(/\s*-\s*/g, ' • ')  // Replace dashes with bullet
    .replace(/\s*_\s*/g, ' ')     // Replace underscores with space
    .replace(/\s+/g, ' ')          // Normalize spaces
    .trim();
  
  return cleaned;
};

export const groupWindowsByProcess = <T extends { process_name: string }>(
  windows: T[]
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  
  windows.forEach(window => {
    const processName = window.process_name;
    if (!grouped.has(processName)) {
      grouped.set(processName, []);
    }
    grouped.get(processName)!.push(window);
  });
  
  return grouped;
};
