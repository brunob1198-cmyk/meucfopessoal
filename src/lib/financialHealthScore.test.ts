import { describe, it, expect } from 'vitest';
import {
  scoreLiquidez, scoreControleGastos, scoreEndividamento, scoreReservaEmergencia, scoreCapacidadePoupanca,
  getClassification, SCORE_CLASSIFICATIONS,
} from './financialHealthScore';

describe('scoreLiquidez', () => {
  it('cobre as faixas de meses cobertos sem lacunas', () => {
    expect(scoreLiquidez(0)).toBe(0);
    expect(scoreLiquidez(0.9)).toBe(0);
    expect(scoreLiquidez(1)).toBe(5);
    expect(scoreLiquidez(1.9)).toBe(5);
    expect(scoreLiquidez(2)).toBe(10);
    expect(scoreLiquidez(2.9)).toBe(10);
    expect(scoreLiquidez(3)).toBe(15);
    expect(scoreLiquidez(5.9)).toBe(15);
    expect(scoreLiquidez(6)).toBe(20);
    expect(scoreLiquidez(100)).toBe(20);
  });
});

describe('scoreControleGastos', () => {
  it('cobre as faixas de taxa de gastos sem lacunas', () => {
    expect(scoreControleGastos(0)).toBe(20);
    expect(scoreControleGastos(0.49)).toBe(20);
    expect(scoreControleGastos(0.5)).toBe(15);
    expect(scoreControleGastos(0.69)).toBe(15);
    expect(scoreControleGastos(0.7)).toBe(10);
    expect(scoreControleGastos(0.89)).toBe(10);
    expect(scoreControleGastos(0.9)).toBe(5);
    expect(scoreControleGastos(0.99)).toBe(5);
    expect(scoreControleGastos(1)).toBe(0);
    expect(scoreControleGastos(1.5)).toBe(0);
  });
});

describe('scoreEndividamento', () => {
  it('cobre as faixas de comprometimento de renda sem lacunas', () => {
    expect(scoreEndividamento(0)).toBe(20);
    expect(scoreEndividamento(0.09)).toBe(20);
    expect(scoreEndividamento(0.1)).toBe(15);
    expect(scoreEndividamento(0.19)).toBe(15);
    expect(scoreEndividamento(0.2)).toBe(10);
    expect(scoreEndividamento(0.29)).toBe(10);
    expect(scoreEndividamento(0.3)).toBe(5);
    expect(scoreEndividamento(0.49)).toBe(5);
    expect(scoreEndividamento(0.5)).toBe(0);
    expect(scoreEndividamento(1)).toBe(0);
  });
});

describe('scoreReservaEmergencia', () => {
  it('cobre as faixas de meses cobertos sem lacunas', () => {
    expect(scoreReservaEmergencia(0)).toBe(0);
    expect(scoreReservaEmergencia(0.9)).toBe(0);
    expect(scoreReservaEmergencia(1)).toBe(5);
    expect(scoreReservaEmergencia(2.9)).toBe(5);
    expect(scoreReservaEmergencia(3)).toBe(10);
    expect(scoreReservaEmergencia(5.9)).toBe(10);
    expect(scoreReservaEmergencia(6)).toBe(15);
    expect(scoreReservaEmergencia(11.9)).toBe(15);
    expect(scoreReservaEmergencia(12)).toBe(20);
  });
});

describe('scoreCapacidadePoupanca', () => {
  it('cobre as faixas de taxa de poupança sem lacunas', () => {
    expect(scoreCapacidadePoupanca(0)).toBe(0);
    expect(scoreCapacidadePoupanca(0.01)).toBe(5);
    expect(scoreCapacidadePoupanca(0.049)).toBe(5);
    expect(scoreCapacidadePoupanca(0.05)).toBe(10);
    expect(scoreCapacidadePoupanca(0.099)).toBe(10);
    expect(scoreCapacidadePoupanca(0.1)).toBe(15);
    expect(scoreCapacidadePoupanca(0.199)).toBe(15);
    expect(scoreCapacidadePoupanca(0.2)).toBe(20);
    expect(scoreCapacidadePoupanca(0.5)).toBe(20);
  });
});

describe('getClassification / SCORE_CLASSIFICATIONS', () => {
  it('cobre os valores de fronteira', () => {
    expect(getClassification(0).label).toBe('Saúde financeira crítica');
    expect(getClassification(39.9).label).toBe('Saúde financeira crítica');
    expect(getClassification(40).label).toBe('Saúde financeira frágil');
    expect(getClassification(59.9).label).toBe('Saúde financeira frágil');
    expect(getClassification(60).label).toBe('Saúde financeira moderada');
    expect(getClassification(74.9).label).toBe('Saúde financeira moderada');
    expect(getClassification(75).label).toBe('Boa saúde financeira');
    expect(getClassification(89.9).label).toBe('Boa saúde financeira');
    expect(getClassification(90).label).toBe('Excelente saúde financeira');
    expect(getClassification(100).label).toBe('Excelente saúde financeira');
  });

  it('está ordenado e contíguo (max de um tier == min do próximo)', () => {
    for (let i = 0; i < SCORE_CLASSIFICATIONS.length - 1; i++) {
      expect(SCORE_CLASSIFICATIONS[i].max).toBe(SCORE_CLASSIFICATIONS[i + 1].min);
    }
  });
});
