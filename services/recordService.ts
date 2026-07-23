import { LearningRecord } from '../types';

const RECORDS_KEY = 'battleMathLearningRecords';

export const getRecords = (): LearningRecord[] => {
    try {
        const saved = localStorage.getItem(RECORDS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Failed to parse records from localStorage", error);
        return [];
    }
};

export const saveRecord = (record: Omit<LearningRecord, 'id' | 'date'>) => {
    const records = getRecords();
    const newRecord: LearningRecord = {
        ...record,
        id: new Date().toISOString(),
        date: new Date().toISOString(),
    };
    const updatedRecords = [...records, newRecord];
    localStorage.setItem(RECORDS_KEY, JSON.stringify(updatedRecords));
};

export const clearRecords = () => {
    localStorage.removeItem(RECORDS_KEY);
};
