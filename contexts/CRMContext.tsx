import React, { createContext, useContext, useEffect, useState } from 'react';
import { get, set } from 'idb-keyval';
import { ChatSession, CRMCard, CRMStage, DealHealth } from '../types';

const LOCAL_KEY = 'scout360_crm_cards_v1';

interface CRMContextValue {
  cards: CRMCard[];
  createCardFromSession: (session: ChatSession) => Promise<CRMCard>;
  updateCard: (card: CRMCard) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  moveCardToStage: (cardId: string, stage: CRMStage) => Promise<void>;
}

const CRMContext = createContext<CRMContextValue | undefined>(undefined);

function computeHealth(_card: CRMCard): DealHealth {
  return 'green';
}

function extractCompanyNameFromSession(session: ChatSession): string {
  if (session.empresaAlvo && session.empresaAlvo.trim().length > 0) return session.empresaAlvo.trim();
  if (session.title && session.title.trim().length > 0) return session.title.replace(/\.\.\.$/, '').trim();
  return 'Empresa sem nome';
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cards, setCards] = useState<CRMCard[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const parsed: CRMCard[] = JSON.parse(raw);
      setCards(parsed);
    } catch (err) {
      console.error('Erro ao carregar CRM do localStorage', err);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(cards));
    } catch (err) {
      console.error('Erro ao salvar CRM no localStorage', err);
    }
  }, [cards]);

  const saveFull = async (card: CRMCard) => {
    await set(`crm_card_${card.id}`, card);
  };

  const createCardFromSession = async (session: ChatSession): Promise<CRMCard> => {
    const now = new Date().toISOString();
    const id = `crm_${session.id}`;
    const base: CRMCard = {
      id,
      companyName: extractCompanyNameFromSession(session),
      cnpj: session.cnpj,
      linkedSessionIds: [session.id],
      stage: 'prospeccao',
      createdAt: now,
      updatedAt: now,
      movedToStageAt: { prospeccao: now },
      stages: {},
      latestScorePorta: session.scoreOportunidade || undefined,
      health: 'green',
      newsRadarEnabled: false,
    };
    setCards(prev => [base, ...prev]);
    await saveFull(base);
    return base;
  };

  const updateCard = async (card: CRMCard) => {
    const updated: CRMCard = { ...card, updatedAt: new Date().toISOString(), health: computeHealth(card) };
    setCards(prev => prev.map(c => (c.id === card.id ? updated : c)));
    await saveFull(updated);
  };

  const deleteCard = async (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
    await set(`crm_card_${cardId}`, undefined as any);
  };

  const moveCardToStage = async (cardId: string, stage: CRMStage) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const now = new Date().toISOString();
    const updated: CRMCard = {
      ...card,
      stage,
      movedToStageAt: { ...card.movedToStageAt, [stage]: now },
      updatedAt: now,
    };
    await updateCard(updated);
  };

  const value: CRMContextValue = {
    cards,
    createCardFromSession,
    updateCard,
    deleteCard,
    moveCardToStage,
  };

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
};

export const useCRM = (): CRMContextValue => {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used within CRMProvider');
  return ctx;
};
