import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { WindowInfo } from '../components/common/WindowItem';

export const useWindows = () => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshWindows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getWindows();
      setWindows(data as WindowInfo[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshWindows();
    // TODO: Set up polling or event listeners for window changes
  }, []);

  return { windows, loading, error, refreshWindows };
};

