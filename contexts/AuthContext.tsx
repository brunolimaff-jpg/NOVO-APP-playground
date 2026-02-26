// AuthContext sem Firebase - apenas senha local
const MASTER_PASSWORD = 'Senior2026!';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  isGuest: boolean;
}

// ... resto igual ao anterior