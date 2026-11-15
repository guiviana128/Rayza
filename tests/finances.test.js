import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateFinance,formatBRL,monthKey} from '../src/domain.js';
import {saveRecord,deleteRecord,publicRow} from '../server/records.js';
import {emptyDatabase} from '../server/repository-core.js';
import {backend,page} from './helpers/ui.js';

test('validateFinance: validates amounts, dates, categories and payment modalities', () => {
  const validExpense = {
    title: 'Ração do Bryan',
    amount: 159.90,
    type: 'expense',
    date: '2026-11-15',
    category: 'Ração do Bryan',
    payment_method: 'credito',
    card_name: 'Nubank',
    pix_recipient: '',
    status: 'pendente',
    notes: 'Pacote de 15kg sabor frango'
  };
  const validated = validateFinance(validExpense);
  assert.equal(validated.title, 'Ração do Bryan');
  assert.equal(validated.amount, 159.90);
  assert.equal(validated.category, 'Ração do Bryan');

  // Incomes: Salário, Pagamento da Maria, VR
  const validIncome = {
    title: 'Pagamento da Maria',
    amount: 1200,
    type: 'income',
    date: '2026-11-05',
    category: 'Pagamento da Maria',
    payment_method: 'pix',
    card_name: '',
    pix_recipient: 'Conta Nubank',
    status: 'pago',
    notes: ''
  };
  assert.equal(validateFinance(validIncome).title, 'Pagamento da Maria');

  // Pix with recipient identification
  const validPixExpense = {
    title: 'Veterinário do Bryan',
    amount: 220,
    type: 'expense',
    date: '2026-11-10',
    category: 'Ração do Bryan',
    payment_method: 'pix',
    card_name: '',
    pix_recipient: 'Dra. Camila Chave: 11999999999',
    status: 'pago',
    notes: ''
  };
  assert.equal(validateFinance(validPixExpense).pix_recipient, 'Dra. Camila Chave: 11999999999');

  // Validation failures
  assert.throws(() => validateFinance({...validExpense, title: ''}), /Dê um nome ao registro/);
  assert.throws(() => validateFinance({...validExpense, amount: 0}), /valor válido/);
  assert.throws(() => validateFinance({...validExpense, amount: -50}), /valor válido/);
  assert.throws(() => validateFinance({...validExpense, date: 'invalida'}), /data válida/);
  assert.throws(() => validateFinance({...validExpense, payment_method: 'bitcoin'}), /forma de pagamento/);
  assert.throws(() => validateFinance({...validExpense, status: 'desconhecido'}), /Status deve ser pago ou pendente/);
});

test('server records: save and delete finance records with custom category and status', () => {
  const db = emptyDatabase();
  const id = randomUUID();
  saveRecord(db, 'finances', {
    title: 'Ração do Bryan',
    amount: 250,
    type: 'expense',
    date: '2026-11-15',
    category: 'Ração do Bryan',
    payment_method: 'credito',
    card_name: 'Nubank',
    pix_recipient: '',
    status: 'pendente'
  }, id, true);

  assert.equal(db.finances.length, 1);
  assert.equal(db.finances[0].category, 'Ração do Bryan');
  assert.equal(db.finances[0].status, 'pendente');

  // Toggle status to pago
  saveRecord(db, 'finances', {status: 'pago'}, id);
  assert.equal(db.finances[0].status, 'pago');

  // Delete record
  deleteRecord(db, 'finances', id);
  assert.equal(db.finances.length, 0);
});

test('formatBRL and monthKey utility formatting', () => {
  assert.equal(formatBRL(0), 'R$\u00a00,00');
  assert.ok(formatBRL(150.5).includes('150,50'));
  assert.ok(monthKey(new Date('2026-11-15T12:00:00')).startsWith('2026-11'));
});

const tick = () => new Promise(resolve => setTimeout(resolve, 20));
function click(w, selector) {
  const target = w.document.querySelector(selector);
  assert.ok(target, `Missing ${selector}`);
  target.click();
  return tick();
}
async function submit(w, values) {
  const form = w.document.querySelector('dialog form');
  for (const [name, value] of Object.entries(values)) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.value = value;
  }
  form.dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
  await tick();
}

test('UI finances: create expense (Ração do Bryan), create income (Salário), toggle status and delete', async () => {
  const b = backend();
  b.session = {user: {id: 'rayza', username: 'rayza.huang', user_metadata: {name: 'Rayza'}}};
  const dom = await page(b);
  const w = dom.window;

  try {
    // Navigate to Financeiro tab
    await click(w, '[data-tab="financeiro"]');
    assert.ok(w.document.querySelector('.finance-hero'));
    assert.ok(w.document.querySelector('.finance-period-bar'));

    // Create a new expense: Ração do Bryan
    await click(w, '[data-action="new-expense"]');
    assert.ok(w.document.querySelector('form[data-form="finance"]'));
    await submit(w, {
      title: 'Ração do Bryan',
      amount: '249.90',
      date: '2026-11-15',
      category: 'Ração do Bryan',
      payment_method: 'credito',
      card_name: 'Nubank',
      status: 'pendente'
    });

    const expenseCard = w.document.querySelector('.finance-card.expense');
    assert.ok(expenseCard, 'Expense card must be rendered');
    assert.ok(expenseCard.textContent.includes('Ração do Bryan'));
    assert.ok(expenseCard.textContent.includes('Nubank'));
    assert.ok(expenseCard.textContent.includes('Pendente'));

    // Toggle status to Pago
    await click(w, '[data-action="toggle-finance-status"]');
    assert.ok(w.document.querySelector('.finance-card.expense').textContent.includes('Pago'));

    // Create a new income: Salário
    await click(w, '[data-action="new-income"]');
    await submit(w, {
      title: 'Salário',
      amount: '4500.00',
      date: '2026-11-05',
      category: 'Salário',
      payment_method: 'pix',
      pix_recipient: 'Conta Nubank',
      status: 'pago'
    });

    const incomeCard = w.document.querySelector('.finance-card.income');
    assert.ok(incomeCard, 'Income card must be rendered');
    assert.ok(incomeCard.textContent.includes('Salário'));

    // Verify stats cards rendered
    const statCards = w.document.querySelectorAll('.stat-card');
    assert.ok(statCards.length >= 3);

    // Delete the expense
    const id = expenseCard.querySelector('[data-action="delete-finance"]').dataset.id;
    await click(w, `[data-action="delete-finance"][data-id="${id}"]`);
    await submit(w, {});
    assert.equal(w.document.querySelector('.finance-card.expense'), null);
  } finally {
    w.close();
  }
});
