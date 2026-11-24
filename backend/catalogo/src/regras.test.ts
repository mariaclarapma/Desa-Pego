import { describe, expect, it } from "vitest";
import { lerReservaMinutos } from "./regras.js";

describe("lerReservaMinutos: tempo da reserva configurável (issue #010)", () => {
  it("sem valor ou em branco: usa o padrão de 15 minutos", () => {
    expect(lerReservaMinutos(undefined)).toBe(15);
    expect(lerReservaMinutos("")).toBe(15);
    expect(lerReservaMinutos("   ")).toBe(15);
  });

  it("aceita um número inteiro de minutos, ignorando espaços", () => {
    expect(lerReservaMinutos("30")).toBe(30);
    expect(lerReservaMinutos(" 5 ")).toBe(5);
    expect(lerReservaMinutos("1440")).toBe(1440);
  });

  it("recusa zero, negativo, fração, texto e valor acima de 24 horas", () => {
    for (const invalido of ["0", "-5", "1.5", "abc", "10min", "1441"]) {
      expect(() => lerReservaMinutos(invalido), `valor: ${invalido}`).toThrow(/RESERVA_MINUTOS/);
    }
  });
});