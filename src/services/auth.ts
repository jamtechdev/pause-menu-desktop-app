// Authentication service
export interface User {
  id: string;
  email: string;
  name: string;
}

export const auth = {
  login: async (email: string, password: string): Promise<User> => {
    // TODO: Implement authentication
    throw new Error('Not implemented');
  },

  logout: async (): Promise<void> => {
    // TODO: Implement logout
    throw new Error('Not implemented');
  },

  getCurrentUser: async (): Promise<User | null> => {
    // TODO: Implement get current user
    return null;
  },
};

