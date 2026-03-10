import React from 'react';
import { TEMPORARILY_DISABLE_CLERK } from '../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  if (TEMPORARILY_DISABLE_CLERK) return null;
  return null;
};
