/** Dias da semana como o backend guarda em Schedule.weekdays (MON…SUN), com os nomes em português. */
export type WeekdayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface Weekday {
  code: WeekdayCode;
  short: string;
  long: string;
}

export const WEEKDAYS: readonly Weekday[] = [
  { code: 'MON', short: 'Seg', long: 'Segunda-feira' },
  { code: 'TUE', short: 'Ter', long: 'Terça-feira' },
  { code: 'WED', short: 'Qua', long: 'Quarta-feira' },
  { code: 'THU', short: 'Qui', long: 'Quinta-feira' },
  { code: 'FRI', short: 'Sex', long: 'Sexta-feira' },
  { code: 'SAT', short: 'Sáb', long: 'Sábado' },
  { code: 'SUN', short: 'Dom', long: 'Domingo' },
];

/** Atalhos do formulário de turno. */
export const WEEKDAY_PRESETS: readonly { label: string; codes: WeekdayCode[] }[] = [
  { label: 'Seg a Sex', codes: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { label: 'Seg a Sáb', codes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
  { label: 'Todos os dias', codes: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] },
];

/** Na ordem da semana, sem repetidos nem códigos desconhecidos (aceita minúsculas). */
export function sortWeekdays(codes: readonly string[] | null | undefined): WeekdayCode[] {
  const wanted = new Set((codes ?? []).map((code) => String(code).trim().toUpperCase()));
  return WEEKDAYS.filter((day) => wanted.has(day.code)).map((day) => day.code);
}

/**
 * "Seg a Sex", "Seg a Sáb", "Todos os dias", "Sáb e Dom" ou "Seg, Qua, Sex".
 * Dias seguidos (3 ou mais) viram intervalo.
 */
export function formatWeekdays(codes: readonly string[] | null | undefined): string {
  const sorted = sortWeekdays(codes);
  if (!sorted.length) return '-';
  if (sorted.length === WEEKDAYS.length) return 'Todos os dias';
  const indexes = sorted.map((code) => WEEKDAYS.findIndex((day) => day.code === code));
  const consecutive = indexes.every((index, i) => i === 0 || index === indexes[i - 1] + 1);
  const names = indexes.map((index) => WEEKDAYS[index].short);
  if (consecutive && names.length >= 3) return `${names[0]} a ${names[names.length - 1]}`;
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return names.join(', ');
}
