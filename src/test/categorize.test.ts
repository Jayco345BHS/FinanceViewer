import { describe, expect, it } from 'vitest';
import { categorize, DEFAULT_RULES } from '../lib/categorize';

describe('categorize', () => {
  const cases: Array<[string, string]> = [
    ['SOBEYS 4154 ORLEANS ON', 'groceries'],
    ['FOOD BASICS 100822 OTTAWA ON', 'groceries'],
    ['TIM HORTONS #7366 ORLEANS ON', 'dining'],
    ['SUBWAY 7534-0 OTTAWA ON', 'dining'],
    ['SQ *MANHATTANS INTERNATIOOttawa ON', 'dining'],
    ['OCT*L6P2MZRM43994R OTTAWA ON', 'transit'],
    ['UBER EATS TORONTO ON', 'dining'],
    ['UBER TRIP TORONTO ON', 'transit'],
    ['ESSO CIRCLE K ORLEANS ON', 'auto'],
    ['PET VALU #2293 WINCHESTER ON', 'pets'],
    ['ORLEANS VETERINARY HOS ORLEANS ON', 'pets'],
    ['SHOPPERS DRUG MART #12 ORLEANS ON', 'health'],
    ["APPLE'S PORTOBELLO DENTALORLEANS ON", 'health'],
    ['OPENAI *CHATGPT SUBSCR OPENAI.COM CA', 'subscriptions'],
    ['GITHUB, INC. GITHUB.COM CA', 'subscriptions'],
    ['GRAMMARLY CO*ORLHCTB GRAMMARLY.COMCA', 'subscriptions'],
    ['CAA INSURANCE COMPANY THORNHILL ON', 'insurance'],
    ['ANNUAL FEE', 'fees'],
    ['PAYMENT FROM - *****01*9586', 'transfers'],
    ['Amazon.ca*598X178K0 866-216-1072 ON', 'shopping'],
    ['CANADIAN TIRE #422 ORLEANS ON', 'shopping'],
    ['SOME RANDOM PLACE', 'other'],
  ];

  it.each(cases)('%s → %s', (desc, expected) => {
    expect(categorize(desc, DEFAULT_RULES)).toBe(expected);
  });
});
