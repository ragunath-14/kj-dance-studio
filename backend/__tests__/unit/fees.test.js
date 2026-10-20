'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const fees   = require('../../utils/fees');

// Fixed dates (noon, local time) so results never depend on the day the tests run.
const at = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);
const karate = (extra = {}) => ({ classType: 'Karate Class', studentCategory: 'Adults', createdAt: at(2026, 7, 10), ...extra });

test.describe('monthly fee per class', () => {
  const cases = [
    ['Regular Class', 'Kids', undefined, 1000],
    ['Regular Class', 'Adults', undefined, 1300],
    ['Fitness Class', 'Adults', undefined, 2000],
    ['Fitness Class', 'Kids', undefined, 2000],
    ['Online Class', 'Kids', undefined, 1600],
    ['Online Class', 'Adults', undefined, 2000],
    ['Karate Class', 'Kids', undefined, 1300],
    ['Karate Class', 'Adults', undefined, 1300],
    ['Zumba Class', 'Adults', '5 Class', 2000],
    ['Zumba Class', 'Adults', '3 Class', 1800],
    ['Silambam Class', 'Kids', undefined, 800],
    ['Art & Craft Class', 'Kids', undefined, 1000],
    ['Dance Class', 'Adults', undefined, 1300] // legacy class type falls back to the regular fee
  ];
  for (const [cls, cat, plan, expected] of cases) {
    test(`${cls} / ${cat}${plan ? ' / ' + plan : ''} = ${expected}`, () => {
      assert.equal(fees.getMonthlyFee(cls, cat, plan), expected);
    });
  }
  test('Zumba without a plan defaults to the lower 3-class fee', () => {
    assert.equal(fees.getMonthlyFee('Zumba Class', 'Adults', undefined), 1800);
  });
});

test.describe('multi-class base fee', () => {
  test('adds every class together', () => {
    const s = karate({ extraClasses: [{ classType: 'Zumba Class', feePlan: '5 Class' }, { classType: 'Silambam Class' }] });
    assert.equal(fees.getBaseFee(s), 1300 + 2000 + 800);
  });
  test('kids fee for the regular class applies inside a multi-class bundle', () => {
    const s = { classType: 'Regular Class', studentCategory: 'Kids', extraClasses: [{ classType: 'Silambam Class' }] };
    assert.equal(fees.getBaseFee(s), 1000 + 800);
  });
  test('getClassEntries lists the main class first', () => {
    const entries = fees.getClassEntries(karate({ extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class' }] }));
    assert.deepEqual(entries.map(e => e.classType), ['Karate Class', 'Zumba Class']);
  });
});

test.describe('validateClasses', () => {
  test('a single valid class passes', () => assert.equal(fees.validateClasses('Karate Class', '', []), ''));
  test('Zumba needs a plan (main class)', () => assert.match(fees.validateClasses('Zumba Class', '', []), /Zumba plan/));
  test('Zumba needs a plan (extra class)', () => assert.match(fees.validateClasses('Karate Class', '', [{ classType: 'Zumba Class' }]), /Zumba plan/));
  test('Zumba with a plan passes', () => assert.equal(fees.validateClasses('Zumba Class', '3 Class', []), ''));
  test('an unknown plan is not accepted', () => assert.match(fees.validateClasses('Zumba Class', '9 Class', []), /Zumba plan/));
  test('the same class twice is refused', () => assert.match(fees.validateClasses('Karate Class', '', [{ classType: 'Karate Class' }]), /more than once/));
  test('an unknown class is refused', () => assert.match(fees.validateClasses('Judo Class', '', []), /not a valid class type/));
  test('no class defaults to the legacy Dance Class', () => assert.equal(fees.validateClasses(undefined, '', []), ''));
});

test.describe('parseDiscountInput', () => {
  test('empty input means no offer', () => assert.deepEqual(fees.parseDiscountInput({}), { percent: 0, amount: 0 }));
  test('accepts a percentage and an amount', () => assert.deepEqual(fees.parseDiscountInput({ discountPercent: '10', discountAmount: '100' }), { percent: 10, amount: 100 }));
  test('0 and 100 percent are the allowed limits', () => {
    assert.equal(fees.parseDiscountInput({ discountPercent: 0 }).percent, 0);
    assert.equal(fees.parseDiscountInput({ discountPercent: 100 }).percent, 100);
  });
  test('over 100 percent is refused', () => assert.match(fees.parseDiscountInput({ discountPercent: 100.5 }).error, /between 0 and 100/));
  test('a negative percentage is refused', () => assert.ok(fees.parseDiscountInput({ discountPercent: -1 }).error));
  test('a negative amount is refused', () => assert.match(fees.parseDiscountInput({ discountAmount: -5 }).error, /negative/));
  test('text is refused', () => assert.ok(fees.parseDiscountInput({ discountPercent: 'abc' }).error));
  test('the amount is rounded to whole rupees', () => assert.equal(fees.parseDiscountInput({ discountAmount: '99.6' }).amount, 100));
});

test.describe('billing cycles (getTotalCycles)', () => {
  test('joined today = 1 bill', () => assert.equal(fees.getTotalCycles(at(2026, 10, 19), at(2026, 10, 19)), 1));
  test('same month, later day = 1 bill', () => assert.equal(fees.getTotalCycles(at(2026, 10, 1), at(2026, 10, 28)), 1));
  test('the next bill is due on the join day of the next month', () => {
    assert.equal(fees.getTotalCycles(at(2026, 7, 10), at(2026, 8, 9)), 1);   // day before the anniversary
    assert.equal(fees.getTotalCycles(at(2026, 7, 10), at(2026, 8, 10)), 2);  // on the anniversary
  });
  test('three months later, past the join day = 4 bills', () => assert.equal(fees.getTotalCycles(at(2026, 7, 10), at(2026, 10, 19)), 4));
  test('three months later, before the join day = 3 bills', () => assert.equal(fees.getTotalCycles(at(2026, 7, 25), at(2026, 10, 19)), 3));
  test('crosses a year boundary', () => assert.equal(fees.getTotalCycles(at(2025, 11, 5), at(2026, 2, 6)), 4));
  test('joined on the 31st: short months are not billed early', () => {
    assert.equal(fees.getTotalCycles(at(2026, 1, 31), at(2026, 2, 28)), 1);
    assert.equal(fees.getTotalCycles(at(2026, 1, 31), at(2026, 3, 31)), 3);
  });
  test('a join date in the future has no bills yet', () => assert.ok(fees.getTotalCycles(at(2026, 12, 1), at(2026, 10, 19)) <= 0));
  test('accepts ISO strings as well as dates', () => assert.equal(fees.getTotalCycles(at(2026, 7, 10).toISOString(), at(2026, 10, 19)), 4));
});

test.describe('discounts (offers)', () => {
  test('no discount history = full fee every month', () => {
    assert.equal(fees.getFeeForCycle(karate(), 0), 1300);
    assert.equal(fees.getNetFee(karate()), 1300);
  });
  test('percentage off', () => {
    const s = karate({ discounts: [{ fromCycle: 0, percent: 10, amount: 0 }] });
    assert.equal(fees.getFeeForCycle(s, 0), 1170);
  });
  test('flat amount off', () => {
    const s = karate({ discounts: [{ fromCycle: 0, percent: 0, amount: 300 }] });
    assert.equal(fees.getFeeForCycle(s, 0), 1000);
  });
  test('percentage and amount combine (10% of 3100 + 100 = 410)', () => {
    const s = karate({ extraClasses: [{ classType: 'Zumba Class', feePlan: '3 Class' }], discounts: [{ fromCycle: 0, percent: 10, amount: 100 }] });
    assert.equal(fees.getDiscountForCycle(s, 0), 410);
    assert.equal(fees.getFeeForCycle(s, 0), 2690);
  });
  test('an offer starts at its cycle and earlier bills keep the full fee', () => {
    const s = karate({ discounts: [{ fromCycle: 2, percent: 50, amount: 0 }] });
    assert.deepEqual([0, 1, 2, 3].map(i => fees.getFeeForCycle(s, i)), [1300, 1300, 650, 650]);
  });
  test('the discount can never exceed the fee', () => {
    const s = karate({ discounts: [{ fromCycle: 0, percent: 90, amount: 5000 }] });
    assert.equal(fees.getFeeForCycle(s, 0), 0);
  });
  test('the net fee is the fee from the latest offer onward', () => {
    const s = karate({ discounts: [{ fromCycle: 0, percent: 10, amount: 0 }, { fromCycle: 3, percent: 50, amount: 0 }] });
    assert.equal(fees.getNetFee(s), 650);
  });
  test('withDiscount appends, and replaces anything at or after the same cycle', () => {
    const history = [{ fromCycle: 0, percent: 10, amount: 0 }, { fromCycle: 3, percent: 20, amount: 0 }];
    const next = fees.withDiscount(history, 3, 30, 0);
    assert.deepEqual(next, [{ fromCycle: 0, percent: 10, amount: 0 }, { fromCycle: 3, percent: 30, amount: 0 }]);
    assert.equal(history.length, 2, 'the original list is not changed');
    assert.deepEqual(fees.withDiscount(undefined, 1, 5, 0), [{ fromCycle: 1, percent: 5, amount: 0 }]);
  });
  test('getExpectedTotal adds up every billed month', () => {
    const s = karate({ discounts: [{ fromCycle: 2, percent: 50, amount: 0 }] });
    assert.equal(fees.getExpectedTotal(s, 4), 1300 + 1300 + 650 + 650);
    assert.equal(fees.getExpectedTotal(s, 0), 0);
  });
});

test.describe('referral rewards', () => {
  test('one reward = 10% off that bill only', () => {
    const s = karate({ referralRewards: [{ cycle: 2, percent: 10 }] });
    assert.deepEqual([1, 2, 3].map(i => fees.getFeeForCycle(s, i)), [1300, 1170, 1300]);
  });
  test('two rewards in the same cycle = 20%', () => {
    const s = karate({ referralRewards: [{ cycle: 2, percent: 10 }, { cycle: 2, percent: 10 }] });
    assert.equal(fees.getFeeForCycle(s, 2), 1040);
    assert.equal(fees.getReferralPercentForCycle(s, 2), 20);
  });
  test('rewards in different cycles do not stack', () => {
    const s = karate({ referralRewards: [{ cycle: 2, percent: 10 }, { cycle: 3, percent: 10 }] });
    assert.equal(fees.getFeeForCycle(s, 2), 1170);
    assert.equal(fees.getFeeForCycle(s, 3), 1170);
  });
  test('adds to an admin offer', () => {
    const s = karate({ discounts: [{ fromCycle: 0, percent: 10, amount: 0 }], referralRewards: [{ cycle: 1, percent: 10 }, { cycle: 1, percent: 10 }] });
    assert.equal(fees.getFeeForCycle(s, 0), 1170);
    assert.equal(fees.getFeeForCycle(s, 1), 910); // 10% + 20% = 30%
  });
  test('never takes the fee below zero', () => {
    const s = karate({ discounts: [{ fromCycle: 0, percent: 90, amount: 0 }], referralRewards: [{ cycle: 0, percent: 10 }, { cycle: 0, percent: 10 }] });
    assert.equal(fees.getFeeForCycle(s, 0), 0);
  });
  test('a one-bill reward does not change the ongoing net fee', () => {
    assert.equal(fees.getNetFee(karate({ referralRewards: [{ cycle: 2, percent: 10 }] })), 1300);
  });
  test('the reward percentage is 10', () => assert.equal(fees.REFERRAL_PERCENT, 10));
  test('the reward is counted in the expected total', () => {
    const s = karate({ referralRewards: [{ cycle: 2, percent: 10 }] });
    assert.equal(fees.getExpectedTotal(s, 3), 1300 + 1300 + 1170);
  });
});

test.describe('month-by-month view (money covers the OLDEST month first)', () => {
  const s = karate();
  test('nothing paid: every month pending', () => {
    const { rows, credit } = fees.getMonthlyBreakdown(s, 3, 0);
    assert.deepEqual(rows.map(r => r.status), ['pending', 'pending', 'pending']);
    assert.equal(credit, 0);
  });
  test('one lump covers the oldest months (2600 pays two months of 1300)', () => {
    const { rows } = fees.getMonthlyBreakdown(s, 4, 2600);
    assert.deepEqual(rows.map(r => [r.paid, r.due, r.status]), [[1300, 0, 'paid'], [1300, 0, 'paid'], [0, 1300, 'pending'], [0, 1300, 'pending']]);
  });
  test('a part-payment leaves one partial month', () => {
    const { rows } = fees.getMonthlyBreakdown(s, 3, 1800);
    assert.deepEqual(rows.map(r => r.status), ['paid', 'partial', 'pending']);
    assert.equal(rows[1].paid, 500);
    assert.equal(rows[1].due, 800);
  });
  test('money left over after every month is credit', () => {
    const { rows, credit } = fees.getMonthlyBreakdown(s, 2, 3000);
    assert.ok(rows.every(r => r.status === 'paid'));
    assert.equal(credit, 400);
  });
  test('the dues always add up to "billed minus paid"', () => {
    for (const paid of [0, 500, 1300, 1800, 2600, 3900, 5200, 9999]) {
      const { rows } = fees.getMonthlyBreakdown(s, 4, paid);
      const due = rows.reduce((a, r) => a + r.due, 0);
      assert.equal(due, Math.max(0, fees.getExpectedTotal(s, 4) - paid), `paid=${paid}`);
    }
  });
  test('uses each month\'s own fee when an offer starts part-way', () => {
    const offer = karate({ discounts: [{ fromCycle: 2, percent: 50, amount: 0 }] });
    const { rows } = fees.getMonthlyBreakdown(offer, 3, 2600);
    assert.deepEqual(rows.map(r => [r.fee, r.due]), [[1300, 0], [1300, 0], [650, 650]]);
  });
  test('a free month (100% off) counts as paid', () => {
    const free = karate({ discounts: [{ fromCycle: 0, percent: 100, amount: 0 }] });
    assert.equal(fees.getMonthlyBreakdown(free, 2, 0).rows.every(r => r.status === 'paid'), true);
  });
  test('getCycleMonth maps a cycle to its calendar month (year rollover)', () => {
    assert.deepEqual(fees.getCycleMonth(at(2026, 11, 15), 0), { month: 10, year: 2026 });
    assert.deepEqual(fees.getCycleMonth(at(2026, 11, 15), 2), { month: 0, year: 2027 });
  });
});

test.describe('pending months', () => {
  test('counts months, not rupees: ₹1,950 owed over 2 months with an offer = 2 (not 3)', () => {
    const s = karate({ discounts: [{ fromCycle: 1, percent: 50, amount: 0 }] });
    assert.equal(fees.getPendingMonths(s, 2, 0), 2);
  });
  test('a fully paid month is not pending', () => assert.equal(fees.getPendingMonths(karate(), 4, 1300), 3));
  test('a part-paid month still counts as pending', () => assert.equal(fees.getPendingMonths(karate(), 4, 1800), 3));
  test('nothing owed = 0', () => assert.equal(fees.getPendingMonths(karate(), 3, 3900), 0));
  test('overpaid = 0', () => assert.equal(fees.getPendingMonths(karate(), 3, 99999), 0));
});

test.describe('where a new offer starts (getDiscountTiming)', () => {
  const today = at(2026, 10, 19);
  const joined = at(2026, 7, 10);                              // 4 bills due: Jul, Aug, Sep, Oct  (cycles 0..3)
  const pay = (amount, month, year) => ({ purpose: 'Monthly Fee', amount, forMonth: month, forYear: year }); // month is 0-based
  const student = () => karate({ createdAt: joined });

  test('current bill unpaid -> applies to the current bill', () => {
    assert.deepEqual(fees.getDiscountTiming(student(), [], today), { fromCycle: 3, appliesFrom: 'current' });
  });
  test('this month paid but older months owed -> starts next month (older months keep their fee)', () => {
    assert.deepEqual(fees.getDiscountTiming(student(), [pay(1300, 9, 2026)], today), { fromCycle: 4, appliesFrom: 'next' });
  });
  test('this month only part-paid -> still the current bill', () => {
    assert.equal(fees.getDiscountTiming(student(), [pay(500, 9, 2026)], today).appliesFrom, 'current');
  });
  test('everything paid -> next month', () => {
    const all = [pay(1300, 6, 2026), pay(1300, 7, 2026), pay(1300, 8, 2026), pay(1300, 9, 2026)];
    assert.deepEqual(fees.getDiscountTiming(student(), all, today), { fromCycle: 4, appliesFrom: 'next' });
  });
  test('a lump payment that clears everything counts as paid', () => {
    assert.equal(fees.getDiscountTiming(student(), [pay(5200, 6, 2026)], today).appliesFrom, 'next');
  });
  test('ignores payments that are not monthly fees', () => {
    assert.equal(fees.getDiscountTiming(student(), [{ purpose: 'Admission', amount: 99999, forMonth: 9, forYear: 2026 }], today).appliesFrom, 'current');
  });
  test('billing has not started -> the first bill gets it', () => {
    assert.deepEqual(fees.getDiscountTiming(karate({ createdAt: at(2026, 12, 1) }), [], today), { fromCycle: 0, appliesFrom: 'current' });
  });
  test('a student who joined today -> the first (current) bill', () => {
    assert.deepEqual(fees.getDiscountTiming(karate({ createdAt: today }), [], today), { fromCycle: 0, appliesFrom: 'current' });
  });
});
