import React, { useState, useRef } from 'react';
import { ChatSession, CRM_STAGE_LABELS } from '../types';
import { useCRM } from '../contexts/CRMContext';
import { sendMessageToGemini } from '../services/geminiService';

interface CRMDetailProps {
  card: any; // intencionalmente flexível para permitir campos adicionais do CRM
  sessions: ChatSession[];
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onMoveStage: (stage: string) => void;
  onCreateSessionFromCard: () => void;
  isDarkMode: boolean;
}

// ... (resto do arquivo igual ao [cite:50], com apenas estas mudanças na coluna direita):
// - No bloco "Sessoes de investigacao vinculadas", o header agora tem um botão "+ Nova investigação" que chama onCreateSessionFromCard
// - O rodapé segue o mesmo, mantendo Excluir e Fechar
